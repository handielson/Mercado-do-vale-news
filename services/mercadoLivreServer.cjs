const crypto = require('crypto');

const ML_API_ORIGIN = 'https://api.mercadolibre.com';
const ML_AUTH_ORIGIN = 'https://auth.mercadolivre.com.br';
const DEFAULT_REDIRECT_URL = 'https://www.mercadodovale.com.br/api/mercado-livre/oauth/callback';
let refreshPromise = null;

function normalizeAvailableQuantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function parseNotificationResource(payload = {}) {
  const topic = String(payload.topic || '').trim();
  const resource = String(payload.resource || '').trim();
  const match = resource.match(/^\/(orders|shipments)\/(\d+)/);
  if (!match) return null;
  const kind = match[1] === 'orders' ? 'order' : 'shipment';
  if ((kind === 'order' && topic !== 'orders_v2') || (kind === 'shipment' && topic !== 'shipments')) return null;
  return { topic, resourceId: match[2], kind };
}

function classifyShipment(shipment = {}) {
  const status = String(shipment.status || '');
  const substatus = String(shipment.substatus || '');
  return {
    printable: status === 'ready_to_ship' && substatus === 'ready_to_print',
    needsDce: status === 'ready_to_ship' && substatus === 'invoice_pending',
  };
}

function buildEventKey(payload = {}) {
  return crypto.createHash('sha256').update(JSON.stringify({
    id: payload._id || payload.id || '',
    topic: payload.topic || '',
    resource: payload.resource || '',
    sent: payload.sent || '',
    userId: payload.user_id || '',
    applicationId: payload.application_id || '',
  })).digest('hex');
}

function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function redirectUrl() {
  return process.env.MERCADO_LIVRE_REDIRECT_URL || DEFAULT_REDIRECT_URL;
}

function registerAliases(fastify, method, url, options, handler) {
  fastify[method](url, options, handler);
  fastify[method](`/api${url}`, options, handler);
}

async function ensureMercadoLivreTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
    client_id VARCHAR(80) NULL,
    client_secret TEXT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    token_expires_at DATETIME NULL,
    user_id VARCHAR(40) NULL,
    nickname VARCHAR(255) NULL,
    auto_dce_enabled TINYINT(1) NOT NULL DEFAULT 0,
    stock_sync_enabled TINYINT(1) NOT NULL DEFAULT 0,
    connected_at DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query('INSERT IGNORE INTO mercado_livre_settings (id) VALUES (1)');
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_oauth_states (
    state_hash CHAR(64) NOT NULL PRIMARY KEY,
    code_verifier VARCHAR(128) NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ml_oauth_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [pkceColumns] = await pool.query("SHOW COLUMNS FROM mercado_livre_oauth_states LIKE 'code_verifier'");
  if (!pkceColumns.length) {
    await pool.query('ALTER TABLE mercado_livre_oauth_states ADD COLUMN code_verifier VARCHAR(128) NULL AFTER state_hash');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_webhook_events (
    event_key CHAR(64) NOT NULL PRIMARY KEY,
    topic VARCHAR(40) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    seller_id VARCHAR(40) NULL,
    payload JSON NULL,
    status ENUM('received','processed','ignored','error') NOT NULL DEFAULT 'received',
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    INDEX idx_ml_events_status (status, received_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_print_jobs (
    shipment_id VARCHAR(40) NOT NULL PRIMARY KEY,
    order_id VARCHAR(40) NOT NULL,
    pack_id VARCHAR(40) NULL,
    status ENUM('awaiting_dce','ready','printing','printed','intervention') NOT NULL DEFAULT 'awaiting_dce',
    shipment_status VARCHAR(40) NULL,
    shipment_substatus VARCHAR(80) NULL,
    tracking_number VARCHAR(120) NULL,
    payload JSON NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    label_printed_at DATETIME NULL,
    summary_printed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ml_print_queue (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_products (
    product_id CHAR(36) NOT NULL,
    item_id VARCHAR(40) NOT NULL,
    variation_id VARCHAR(40) NOT NULL DEFAULT '',
    seller_sku VARCHAR(255) NULL,
    last_synced_at DATETIME NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, item_id, variation_id),
    INDEX idx_ml_product_item (item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function loadSettings(pool, connection = pool) {
  const [rows] = await connection.query('SELECT * FROM mercado_livre_settings WHERE id = 1 LIMIT 1');
  return rows?.[0] || {};
}

function safeStatus(settings = {}) {
  return {
    configured: Boolean(settings.client_id && settings.client_secret),
    connected: Boolean(settings.access_token && settings.refresh_token && settings.user_id),
    clientId: settings.client_id || '',
    userId: settings.user_id || null,
    nickname: settings.nickname || null,
    tokenExpiresAt: settings.token_expires_at || null,
    autoDceEnabled: Boolean(settings.auto_dce_enabled),
    stockSyncEnabled: Boolean(settings.stock_sync_enabled),
    connectedAt: settings.connected_at || null,
    redirectUrl: redirectUrl(),
    webhookUrl: process.env.MERCADO_LIVRE_WEBHOOK_URL || 'https://www.mercadodovale.com.br/api/mercado-livre/webhook',
  };
}

async function tokenRequest(fields) {
  const response = await fetch(`${ML_API_ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Livre OAuth ${response.status}: ${data.message || data.error || 'falhou'}`);
  return data;
}

async function persistTokens(connection, data, fallbackRefreshToken = null) {
  const expiresIn = Math.max(60, Number(data.expires_in || 21600));
  await connection.query(
    `UPDATE mercado_livre_settings SET access_token = ?, refresh_token = ?,
       token_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND), updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    [data.access_token, data.refresh_token || fallbackRefreshToken, expiresIn],
  );
}

async function refreshAccessToken(pool) {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT * FROM mercado_livre_settings WHERE id = 1 FOR UPDATE');
      const settings = rows?.[0] || {};
      const expiry = settings.token_expires_at ? new Date(settings.token_expires_at).getTime() : 0;
      if (settings.access_token && expiry > Date.now() + 120000) {
        await connection.commit();
        return settings.access_token;
      }
      if (!settings.client_id || !settings.client_secret || !settings.refresh_token) throw new Error('Conta Mercado Livre nao conectada');
      const data = await tokenRequest({
        grant_type: 'refresh_token',
        client_id: settings.client_id,
        client_secret: settings.client_secret,
        refresh_token: settings.refresh_token,
      });
      await persistTokens(connection, data, settings.refresh_token);
      await connection.commit();
      return data.access_token;
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  })();
  try { return await refreshPromise; } finally { refreshPromise = null; }
}

async function getAccessToken(pool) {
  const settings = await loadSettings(pool);
  const expiry = settings.token_expires_at ? new Date(settings.token_expires_at).getTime() : 0;
  if (settings.access_token && expiry > Date.now() + 120000) return settings.access_token;
  return refreshAccessToken(pool);
}

async function mlRequest(pool, resource, options = {}, retry = true) {
  const token = await getAccessToken(pool);
  const response = await fetch(`${ML_API_ORIGIN}${resource}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  if (response.status === 401 && retry) {
    await pool.query('UPDATE mercado_livre_settings SET token_expires_at = NOW() WHERE id = 1');
    await refreshAccessToken(pool);
    return mlRequest(pool, resource, options, false);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercado Livre API ${response.status}: ${body.slice(0, 800)}`);
  }
  return response;
}

async function upsertPrintJob(pool, order, shipment) {
  const shipmentId = String(shipment.id || order.shipping?.id || '');
  if (!shipmentId) return null;
  const state = classifyShipment(shipment);
  const status = state.printable ? 'ready' : state.needsDce ? 'awaiting_dce' : 'intervention';
  const tracking = shipment.tracking_number || shipment.tracking_id || null;
  await pool.query(
    `INSERT INTO mercado_livre_print_jobs
      (shipment_id, order_id, pack_id, status, shipment_status, shipment_substatus, tracking_number, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE order_id=VALUES(order_id), pack_id=VALUES(pack_id),
       status=IF(status='printed','printed',VALUES(status)), shipment_status=VALUES(shipment_status),
       shipment_substatus=VALUES(shipment_substatus), tracking_number=VALUES(tracking_number),
       payload=VALUES(payload), updated_at=CURRENT_TIMESTAMP`,
    [shipmentId, String(order.id), order.pack_id ? String(order.pack_id) : null, status,
      shipment.status || null, shipment.substatus || null, tracking, JSON.stringify({ order, shipment })],
  );
  return { shipmentId, status, state };
}

async function autoLinkOrderItems(pool, order) {
  for (const orderItem of order.order_items || []) {
    const item = orderItem.item || {};
    const sku = String(item.seller_sku || item.seller_custom_field || orderItem.seller_sku || '').trim();
    const itemId = String(item.id || '').trim().toUpperCase();
    const variationId = String(item.variation_id || '').trim();
    if (!sku || !/^MLB\d+$/.test(itemId)) continue;
    const [products] = await pool.query('SELECT id FROM products WHERE sku = ? LIMIT 2', [sku]);
    if (products.length !== 1) continue;
    await pool.query(`INSERT INTO mercado_livre_products (product_id,item_id,variation_id,seller_sku) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE seller_sku=VALUES(seller_sku), updated_at=CURRENT_TIMESTAMP`,
    [products[0].id, itemId, variationId, sku]);
  }
}

async function processNotification(pool, eventKey, parsed) {
  try {
    let order;
    let shipment;
    if (parsed.kind === 'order') {
      order = await (await mlRequest(pool, `/orders/${parsed.resourceId}`)).json();
      const shipmentId = order.shipping?.id;
      if (!shipmentId) throw new Error('Pedido sem remessa associada');
      shipment = await (await mlRequest(pool, `/shipments/${shipmentId}`)).json();
    } else {
      shipment = await (await mlRequest(pool, `/shipments/${parsed.resourceId}`)).json();
      const orderId = shipment.order_id || shipment.order?.id;
      if (!orderId) throw new Error('Remessa sem pedido associado');
      order = await (await mlRequest(pool, `/orders/${orderId}`)).json();
    }
    await autoLinkOrderItems(pool, order);
    let job = await upsertPrintJob(pool, order, shipment);
    const settings = await loadSettings(pool);
    if (job?.state.needsDce && settings.auto_dce_enabled) {
      await mlRequest(pool, `/mlb/order/${order.id}/dce/emission`, { method: 'POST', body: '{}' });
      shipment = await (await mlRequest(pool, `/shipments/${job.shipmentId}`)).json();
      job = await upsertPrintJob(pool, order, shipment);
    }
    await pool.query(
      `UPDATE mercado_livre_webhook_events SET status='processed', processed_at=NOW(), attempts=attempts+1, last_error=NULL WHERE event_key=?`,
      [eventKey],
    );
    return job;
  } catch (error) {
    await pool.query(
      `UPDATE mercado_livre_webhook_events SET status='error', attempts=attempts+1, last_error=? WHERE event_key=?`,
      [String(error.message || error).slice(0, 2000), eventKey],
    ).catch(() => {});
    throw error;
  }
}

async function syncMercadoLivreStockFromBlingTargets(pool, stockTargets = []) {
  const settings = await loadSettings(pool).catch(() => ({}));
  const result = { ok: true, enabled: Boolean(settings.stock_sync_enabled), updated: 0, skipped: 0, errors: [] };
  if (!result.enabled || !settings.access_token) return result;
  for (const target of stockTargets) {
    const productId = String(target?.product_id || target?.id || '');
    if (!productId) { result.skipped += 1; continue; }
    const [links] = await pool.query('SELECT * FROM mercado_livre_products WHERE product_id = ?', [productId]);
    if (!links.length) { result.skipped += 1; continue; }
    const availableQuantity = normalizeAvailableQuantity(target.stock_quantity ?? target.stockQty ?? target.quantity);
    for (const link of links) {
      try {
        const payload = link.variation_id
          ? { variations: [{ id: Number(link.variation_id), available_quantity: availableQuantity }] }
          : { available_quantity: availableQuantity };
        await mlRequest(pool, `/items/${encodeURIComponent(link.item_id)}`, { method: 'PUT', body: JSON.stringify(payload) });
        await pool.query('UPDATE mercado_livre_products SET last_synced_at=NOW(), last_error=NULL WHERE product_id=? AND item_id=? AND variation_id=?', [productId, link.item_id, link.variation_id]);
        result.updated += 1;
      } catch (error) {
        result.ok = false;
        const message = String(error.message || error).slice(0, 1000);
        result.errors.push({ productId, itemId: link.item_id, message });
        await pool.query('UPDATE mercado_livre_products SET last_error=? WHERE product_id=? AND item_id=? AND variation_id=?', [message, productId, link.item_id, link.variation_id]).catch(() => {});
      }
    }
  }
  return result;
}

function registerMercadoLivreRoutes(fastify, { pool, requireSyncKey, requireSyncKeyOrAdmin = requireSyncKey }) {
  const protectedRoute = { preHandler: requireSyncKeyOrAdmin };

  const getSettings = async () => safeStatus(await loadSettings(pool));
  const patchSettings = async (request, reply) => {
    const body = request.body || {};
    const updates = [];
    const values = [];
    const mapping = { clientId: 'client_id', clientSecret: 'client_secret', autoDceEnabled: 'auto_dce_enabled', stockSyncEnabled: 'stock_sync_enabled' };
    for (const [input, column] of Object.entries(mapping)) {
      if (body[input] === undefined) continue;
      updates.push(`${column}=?`);
      values.push(input.endsWith('Enabled') ? (body[input] ? 1 : 0) : String(body[input] || '').trim());
    }
    if (!updates.length) return reply.code(400).send({ error: 'Nenhuma configuracao valida' });
    values.push(1);
    await pool.query(`UPDATE mercado_livre_settings SET ${updates.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, values);
    return safeStatus(await loadSettings(pool));
  };
  registerAliases(fastify, 'get', '/mercado-livre/settings', protectedRoute, getSettings);
  registerAliases(fastify, 'patch', '/mercado-livre/settings', protectedRoute, patchSettings);

  const oauthAuth = async (_request, reply) => {
    const settings = await loadSettings(pool);
    if (!settings.client_id || !settings.client_secret) return reply.code(400).send({ error: 'Configure Client ID e Client Secret' });
    const state = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const pkce = createPkcePair();
    await pool.query('INSERT INTO mercado_livre_oauth_states (state_hash, code_verifier, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [hash, pkce.verifier]);
    const url = new URL(`${ML_AUTH_ORIGIN}/authorization`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', settings.client_id);
    url.searchParams.set('redirect_uri', redirectUrl());
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return { url: url.toString() };
  };
  registerAliases(fastify, 'get', '/mercado-livre/oauth/auth', protectedRoute, oauthAuth);

  const oauthCallback = async (request, reply) => {
    const code = String(request.query?.code || '');
    const state = String(request.query?.state || '');
    if (!code || !state) return reply.code(400).send('Autorizacao invalida ou expirada');
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const connection = await pool.getConnection();
    let oauthState;
    try {
      await connection.beginTransaction();
      const [states] = await connection.query(
        'SELECT code_verifier FROM mercado_livre_oauth_states WHERE state_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [hash],
      );
      oauthState = states?.[0];
      if (!oauthState?.code_verifier) {
        await connection.rollback();
        return reply.code(400).send('Autorizacao invalida ou expirada');
      }
      await connection.query('UPDATE mercado_livre_oauth_states SET used_at=NOW() WHERE state_hash=?', [hash]);
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
    const settings = await loadSettings(pool);
    const data = await tokenRequest({ grant_type: 'authorization_code', client_id: settings.client_id, client_secret: settings.client_secret, code, redirect_uri: redirectUrl(), code_verifier: oauthState.code_verifier });
    const profileResponse = await fetch(`${ML_API_ORIGIN}/users/me`, { headers: { authorization: `Bearer ${data.access_token}` } });
    const profile = await profileResponse.json().catch(() => ({}));
    await persistTokens(pool, data);
    await pool.query('UPDATE mercado_livre_settings SET user_id=?, nickname=?, connected_at=NOW() WHERE id=1', [String(profile.id || data.user_id || ''), profile.nickname || null]);
    return reply.redirect('/admin/settings/mercado-livre?connected=1');
  };
  registerAliases(fastify, 'get', '/mercado-livre/oauth/callback', {}, oauthCallback);

  const webhook = async (request, reply) => {
    const payload = request.body || {};
    const parsed = parseNotificationResource(payload);
    if (!parsed) return reply.code(200).send({ ok: true, ignored: true });
    const settings = await loadSettings(pool);
    if (settings.client_id && payload.application_id && String(payload.application_id) !== String(settings.client_id)) return reply.code(200).send({ ok: true, ignored: true });
    if (settings.user_id && payload.user_id && String(payload.user_id) !== String(settings.user_id)) return reply.code(200).send({ ok: true, ignored: true });
    const eventKey = buildEventKey(payload);
    const [inserted] = await pool.query(
      `INSERT IGNORE INTO mercado_livre_webhook_events (event_key, topic, resource, seller_id, payload) VALUES (?, ?, ?, ?, ?)`,
      [eventKey, parsed.topic, payload.resource, payload.user_id ? String(payload.user_id) : null, JSON.stringify(payload)],
    );
    reply.code(200).send({ ok: true, duplicate: inserted.affectedRows === 0 });
    if (inserted.affectedRows) setImmediate(() => processNotification(pool, eventKey, parsed).catch(error => fastify.log.error({ error }, 'Mercado Livre webhook processing failed')));
    return reply;
  };
  registerAliases(fastify, 'post', '/mercado-livre/webhook', {}, webhook);

  const listJobs = async (request) => {
    const limit = Math.min(100, Math.max(1, Number(request.query?.limit || 30)));
    const [rows] = await pool.query(`SELECT shipment_id, order_id, pack_id, status, shipment_status, shipment_substatus,
      tracking_number, attempts, last_error, label_printed_at, summary_printed_at, created_at, updated_at
      FROM mercado_livre_print_jobs ORDER BY created_at DESC LIMIT ?`, [limit]);
    return { items: rows };
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs', protectedRoute, listJobs);

  const nextJob = async (_request, reply) => {
    const [rows] = await pool.query("SELECT * FROM mercado_livre_print_jobs WHERE status='ready' OR (status='printing' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)) ORDER BY created_at ASC LIMIT 1");
    if (!rows.length) return reply.code(204).send();
    const job = rows[0];
    await pool.query("UPDATE mercado_livre_print_jobs SET status='printing', attempts=attempts+1 WHERE shipment_id=?", [job.shipment_id]);
    return { shipmentId: job.shipment_id, orderId: job.order_id, packId: job.pack_id, trackingNumber: job.tracking_number, payload: job.payload };
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs/next', { preHandler: requireSyncKey }, nextJob);

  const label = async (request, reply) => {
    const shipmentId = String(request.params.shipmentId || '');
    const response = await mlRequest(pool, `/shipment_labels?shipment_ids=${encodeURIComponent(shipmentId)}&response_type=pdf`);
    const pdf = Buffer.from(await response.arrayBuffer());
    return reply.type('application/pdf').header('content-disposition', `inline; filename=ML-${shipmentId}.pdf`).send(pdf);
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs/:shipmentId/label', { preHandler: requireSyncKey }, label);

  const completeJob = async (request, reply) => {
    const shipmentId = String(request.params.shipmentId || '');
    const body = request.body || {};
    if (body.ok === false) {
      await pool.query("UPDATE mercado_livre_print_jobs SET status='intervention', last_error=? WHERE shipment_id=?", [String(body.error || 'Falha de impressao').slice(0, 2000), shipmentId]);
    } else {
      await pool.query("UPDATE mercado_livre_print_jobs SET status='printed', label_printed_at=NOW(), summary_printed_at=IF(?,NOW(),summary_printed_at), last_error=NULL WHERE shipment_id=?", [body.summaryPrinted ? 1 : 0, shipmentId]);
    }
    return reply.send({ ok: true });
  };
  registerAliases(fastify, 'post', '/mercado-livre/print-jobs/:shipmentId/complete', { preHandler: requireSyncKey }, completeJob);

  const emitDce = async (request) => {
    const orderId = String(request.params.orderId || '');
    const response = await mlRequest(pool, `/mlb/order/${encodeURIComponent(orderId)}/dce/emission`, { method: 'POST', body: '{}' });
    return response.json().catch(() => ({ ok: true }));
  };
  registerAliases(fastify, 'post', '/mercado-livre/orders/:orderId/dce', protectedRoute, emitDce);

  const linkProduct = async (request, reply) => {
    const body = request.body || {};
    const productId = String(body.productId || '').trim();
    const itemId = String(body.itemId || '').trim().toUpperCase();
    const variationId = String(body.variationId || '').trim();
    if (!productId || !/^MLB\d+$/.test(itemId)) return reply.code(400).send({ error: 'productId e itemId MLB validos sao obrigatorios' });
    await pool.query(`INSERT INTO mercado_livre_products (product_id,item_id,variation_id,seller_sku) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE seller_sku=VALUES(seller_sku), updated_at=CURRENT_TIMESTAMP`, [productId, itemId, variationId, body.sellerSku || null]);
    return { ok: true };
  };
  registerAliases(fastify, 'post', '/mercado-livre/products/link', protectedRoute, linkProduct);
  registerAliases(fastify, 'get', '/mercado-livre/products/links', protectedRoute, async () => {
    const [rows] = await pool.query('SELECT * FROM mercado_livre_products ORDER BY created_at DESC');
    return { items: rows };
  });
}

module.exports = {
  ensureMercadoLivreTables,
  registerMercadoLivreRoutes,
  syncMercadoLivreStockFromBlingTargets,
  parseNotificationResource,
  classifyShipment,
  normalizeAvailableQuantity,
  buildEventKey,
  createPkcePair,
};
