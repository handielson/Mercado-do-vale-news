const crypto = require('crypto');

const APPROVAL_STATUSES = new Set([
  'pending', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'cancelled', 'expired',
]);
const EXECUTION_MODES = new Set(['vps_meta_api', 'lenovo_chrome', 'manual']);
const INSIGHTS_PRESETS = new Set(['last_7d', 'last_14d', 'last_30d', 'this_month']);
const META_CAMPAIGN_SHELL_ACTION = 'meta.create_paused_campaign_bundle.v2';
const META_CAMPAIGN_SHELLS = Object.freeze([
  { itemKey: 'store-carousel', name: 'MDV | Loja inteira | Carrossel | Petrolina + Juazeiro' },
  { itemKey: 'smartphones', name: 'MDV | Smartphones | Petrolina + Juazeiro' },
]);
let metaApprovalWorkerStarted = false;

function jsonParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function jsonValue(value, maxLength = 100000) {
  if (value == null || typeof value !== 'object') return null;
  const serialized = JSON.stringify(value);
  return serialized.length <= maxLength ? serialized : null;
}

function text(value, maxLength) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, maxLength) : '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function marketingConfig() {
  const graphApiVersion = String(process.env.META_GRAPH_API_VERSION || '').trim();
  const appId = String(process.env.META_APP_ID || '').trim();
  const appSecret = String(process.env.META_APP_SECRET || '').trim();
  const redirectUri = String(process.env.META_OAUTH_REDIRECT_URI || '').trim();
  const encryptionKey = String(process.env.META_TOKEN_ENCRYPTION_KEY || '').trim();
  const scopes = String(process.env.META_OAUTH_SCOPES || [
    'ads_read', 'ads_management', 'business_management', 'pages_show_list',
    'pages_read_engagement',
  ].join(',')).split(',').map((item) => item.trim()).filter(Boolean);
  return {
    graphApiVersion, appId, appSecret, redirectUri, encryptionKey, scopes,
    ready: Boolean(graphApiVersion && appId && appSecret && redirectUri && encryptionKey),
  };
}

function encryptToken(token, secret) {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptToken(row, secret) {
  if (!row?.token_ciphertext || !row?.token_iv || !row?.token_auth_tag) return '';
  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(row.token_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.token_auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.token_ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function ensureMarketingCampaignTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_approval_requests (
      id CHAR(36) PRIMARY KEY,
      channel VARCHAR(40) NOT NULL DEFAULT 'instagram',
      action_type VARCHAR(60) NOT NULL,
      title VARCHAR(255) NOT NULL,
      target_type VARCHAR(60) NOT NULL,
      target_id VARCHAR(255) NULL,
      target_name VARCHAR(255) NULL,
      status ENUM('pending', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
      execution_mode ENUM('vps_meta_api', 'lenovo_chrome', 'manual') NOT NULL DEFAULT 'vps_meta_api',
      current_state JSON NULL,
      proposed_state JSON NOT NULL,
      evidence JSON NULL,
      financial_impact JSON NULL,
      success_criteria JSON NULL,
      rollback_plan TEXT NOT NULL,
      execution_payload JSON NULL,
      execution_result JSON NULL,
      requested_by VARCHAR(80) NULL,
      requested_by_label VARCHAR(255) NULL,
      reviewed_by VARCHAR(80) NULL,
      review_note TEXT NULL,
      runner_id VARCHAR(120) NULL,
      idempotency_key VARCHAR(160) NOT NULL,
      approval_expires_at DATETIME NULL,
      approved_at DATETIME NULL,
      rejected_at DATETIME NULL,
      execution_started_at DATETIME NULL,
      executed_at DATETIME NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_marketing_approval_idempotency (idempotency_key),
      INDEX idx_marketing_approval_queue (status, created_at),
      INDEX idx_marketing_approval_channel (channel, status),
      INDEX idx_marketing_approval_expiry (status, approval_expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_approval_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      approval_id CHAR(36) NOT NULL,
      event_type VARCHAR(60) NOT NULL,
      actor_id VARCHAR(80) NULL,
      actor_label VARCHAR(255) NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_marketing_approval_events_request (approval_id, id),
      INDEX idx_marketing_approval_events_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_approval_execution_items (
      approval_id CHAR(36) NOT NULL,
      provider VARCHAR(32) NOT NULL DEFAULT 'meta',
      item_key VARCHAR(80) NOT NULL,
      payload_hash CHAR(64) NOT NULL,
      external_id VARCHAR(120) NULL,
      state ENUM('pending', 'creating', 'succeeded', 'ambiguous', 'failed') NOT NULL DEFAULT 'pending',
      external_status VARCHAR(80) NULL,
      last_error TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (approval_id, item_key),
      UNIQUE KEY uq_marketing_execution_external (provider, external_id),
      INDEX idx_marketing_execution_state (state, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_marketing_connections (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      status ENUM('disconnected', 'connected', 'expired', 'error') NOT NULL DEFAULT 'disconnected',
      graph_api_version VARCHAR(24) NOT NULL,
      token_ciphertext TEXT NULL,
      token_iv VARCHAR(64) NULL,
      token_auth_tag VARCHAR(64) NULL,
      token_expires_at DATETIME NULL,
      granted_scopes JSON NULL,
      available_ad_accounts JSON NULL,
      available_pages JSON NULL,
      selected_ad_account_id VARCHAR(80) NULL,
      selected_page_id VARCHAR(80) NULL,
      selected_instagram_account_id VARCHAR(80) NULL,
      instagram_username VARCHAR(255) NULL,
      last_audit JSON NULL,
      last_audit_at DATETIME NULL,
      last_error TEXT NULL,
      connected_by VARCHAR(80) NULL,
      connected_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_marketing_oauth_states (
      state_hash CHAR(64) NOT NULL PRIMARY KEY,
      requested_by VARCHAR(80) NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_meta_oauth_state_expiry (expires_at, used_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function parseApproval(row) {
  if (!row) return null;
  const parsed = { ...row };
  for (const field of [
    'current_state', 'proposed_state', 'evidence', 'financial_impact',
    'success_criteria', 'execution_payload', 'execution_result',
  ]) parsed[field] = jsonParse(parsed[field], null);
  parsed.attempt_count = Number(parsed.attempt_count || 0);
  return parsed;
}

async function approvalEvent(connection, approvalId, eventType, actor, details = null) {
  await connection.query(
    `INSERT INTO marketing_approval_events
      (approval_id, event_type, actor_id, actor_label, details) VALUES (?, ?, ?, ?, ?)`,
    [approvalId, text(eventType, 60), text(actor?.id, 80) || null, text(actor?.label, 255) || null, jsonValue(details)],
  );
}

async function findApproval(connection, id, lock = false) {
  const [rows] = await connection.query(
    `SELECT * FROM marketing_approval_requests WHERE id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows?.[0] || null;
}

async function expireApprovals(pool) {
  await pool.query(
    `UPDATE marketing_approval_requests SET status = 'expired', updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('pending', 'approved') AND approval_expires_at IS NOT NULL AND approval_expires_at <= NOW()`,
  );
}

function registerApprovalRoutes(fastify, { pool, requireAdminBearerToken, requireSyncKeyOrAdmin, getBearerAuthContext }) {
  function requireRunner(request, reply, done) {
    const configured = String(process.env.MARKETING_RUNNER_SECRET || '').trim();
    const received = String(request.headers['x-marketing-runner-key'] || '').trim();
    if (!configured) return reply.code(503).send({ error: 'Marketing runner is not configured' });
    if (!received || received !== configured) return reply.code(401).send({ error: 'Invalid marketing runner key' });
    done();
  }

  fastify.get('/admin/marketing/approvals', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    await expireApprovals(pool);
    const status = text(req.query?.status, 30);
    if (status && !APPROVAL_STATUSES.has(status)) return reply.code(400).send({ error: 'Invalid approval status' });
    const channel = text(req.query?.channel, 40);
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 100) || 100));
    const clauses = [];
    const params = [];
    if (status) { clauses.push('status = ?'); params.push(status); }
    if (channel) { clauses.push('channel = ?'); params.push(channel); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM marketing_approval_requests ${where}
       ORDER BY FIELD(status, 'pending', 'approved', 'executing', 'failed', 'succeeded', 'rejected', 'cancelled', 'expired'), created_at DESC LIMIT ?`,
      [...params, limit],
    );
    const [countRows] = await pool.query('SELECT status, COUNT(*) AS total FROM marketing_approval_requests GROUP BY status');
    return { ok: true, items: rows.map(parseApproval), counts: Object.fromEntries(countRows.map((row) => [row.status, Number(row.total || 0)])) };
  });

  fastify.post('/admin/marketing/approvals', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
    const body = req.body || {};
    const auth = await getBearerAuthContext(req);
    const idempotencyKey = text(body.idempotency_key, 160);
    const title = text(body.title, 255);
    const actionType = text(body.action_type, 60);
    const targetType = text(body.target_type, 60);
    const targetId = text(body.target_id, 255);
    const targetName = text(body.target_name, 255);
    const rollbackPlan = text(body.rollback_plan, 10000);
    const proposedState = jsonValue(body.proposed_state);
    const financialImpact = jsonValue(body.financial_impact);
    const successCriteria = jsonValue(body.success_criteria);
    const executionMode = EXECUTION_MODES.has(body.execution_mode) ? body.execution_mode : 'vps_meta_api';
    if (!idempotencyKey || !title || !actionType || !targetType || (!targetId && !targetName)
      || !rollbackPlan || !proposedState || !financialImpact || !successCriteria) {
      return reply.code(400).send({ error: 'Required approval fields are missing' });
    }
    const [existing] = await pool.query('SELECT * FROM marketing_approval_requests WHERE idempotency_key = ? LIMIT 1', [idempotencyKey]);
    if (existing?.[0]) return parseApproval(existing[0]);
    const id = crypto.randomUUID();
    const requestedBy = auth.userId || text(body.requested_by, 80) || 'marketing-agent';
    const requestedByLabel = text(body.requested_by_label, 255) || (auth.isAdmin ? 'Administrador Gestão MV' : 'Agente de Marketing');
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO marketing_approval_requests
          (id, channel, action_type, title, target_type, target_id, target_name, execution_mode,
           current_state, proposed_state, evidence, financial_impact, success_criteria, rollback_plan,
           execution_payload, requested_by, requested_by_label, idempotency_key, approval_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATE_ADD(NOW(), INTERVAL 24 HOUR)))`,
        [
          id, text(body.channel, 40) || 'instagram', actionType, title, targetType,
          targetId || null, targetName || null, executionMode, jsonValue(body.current_state), proposedState,
          jsonValue(body.evidence), financialImpact, successCriteria, rollbackPlan, jsonValue(body.execution_payload),
          requestedBy, requestedByLabel, idempotencyKey, body.approval_expires_at || null,
        ],
      );
      await approvalEvent(connection, id, 'requested', { id: requestedBy, label: requestedByLabel }, { execution_mode: executionMode, action_type: actionType });
      await connection.commit();
      return reply.code(201).send(parseApproval(await findApproval(pool, id)));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });

  fastify.post('/admin/marketing/approvals/:id/decision', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    const decision = req.body?.decision;
    const note = text(req.body?.note, 10000);
    if (!['approve', 'reject'].includes(decision)) return reply.code(400).send({ error: 'Decision must be approve or reject' });
    if (decision === 'reject' && !note) return reply.code(400).send({ error: 'A rejection note is required' });
    const auth = await getBearerAuthContext(req);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const current = await findApproval(connection, req.params.id, true);
      if (!current) { await connection.rollback(); return reply.code(404).send({ error: 'Approval request not found' }); }
      if (current.status !== 'pending') { await connection.rollback(); return reply.code(409).send({ error: `Approval request is already ${current.status}` }); }
      if (current.requested_by && current.requested_by === (auth.userId || auth.customerId)) {
        await connection.rollback();
        return reply.code(403).send({ error: 'The requester cannot approve their own marketing action' });
      }
      if (current.approval_expires_at && new Date(current.approval_expires_at).getTime() <= Date.now()) {
        await connection.query("UPDATE marketing_approval_requests SET status = 'expired' WHERE id = ?", [current.id]);
        await approvalEvent(connection, current.id, 'expired', { id: auth.userId, label: 'Gestão MV' });
        await connection.commit();
        return reply.code(409).send({ error: 'Approval request expired' });
      }
      const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
      await connection.query(
        `UPDATE marketing_approval_requests SET status = ?, reviewed_by = ?, review_note = ?,
         approved_at = IF(? = 'approved', NOW(), approved_at), rejected_at = IF(? = 'rejected', NOW(), rejected_at)
         WHERE id = ?`,
        [nextStatus, auth.userId || auth.customerId, note || null, nextStatus, nextStatus, current.id],
      );
      await approvalEvent(connection, current.id, nextStatus, { id: auth.userId || auth.customerId, label: 'Administrador Gestão MV' }, { note: note || null });
      await connection.commit();
      return parseApproval(await findApproval(pool, current.id));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.get('/admin/marketing/approvals/:id/events', { preHandler: requireAdminBearerToken }, async (req) => {
    const [rows] = await pool.query(
      'SELECT id, approval_id, event_type, actor_id, actor_label, details, created_at FROM marketing_approval_events WHERE approval_id = ? ORDER BY id ASC',
      [req.params.id],
    );
    return { ok: true, items: rows.map((row) => ({ ...row, details: jsonParse(row.details, null) })) };
  });

  fastify.get('/marketing-runner/approvals', { preHandler: requireRunner }, async (req) => {
    await expireApprovals(pool);
    const mode = EXECUTION_MODES.has(req.query?.execution_mode) ? req.query.execution_mode : 'vps_meta_api';
    const [rows] = await pool.query(
      "SELECT * FROM marketing_approval_requests WHERE status = 'approved' AND execution_mode = ? ORDER BY approved_at ASC, created_at ASC LIMIT 20",
      [mode],
    );
    return { ok: true, items: rows.map(parseApproval) };
  });

  fastify.post('/marketing-runner/approvals/:id/claim', { preHandler: requireRunner }, async (req, reply) => {
    const runnerId = text(req.body?.runner_id, 120);
    if (!runnerId) return reply.code(400).send({ error: 'runner_id is required' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const current = await findApproval(connection, req.params.id, true);
      if (!current) { await connection.rollback(); return reply.code(404).send({ error: 'Approval request not found' }); }
      if (current.status !== 'approved') { await connection.rollback(); return reply.code(409).send({ error: `Approval request is ${current.status}` }); }
      await connection.query(
        "UPDATE marketing_approval_requests SET status = 'executing', runner_id = ?, execution_started_at = NOW(), attempt_count = attempt_count + 1 WHERE id = ?",
        [runnerId, current.id],
      );
      await approvalEvent(connection, current.id, 'claimed', { id: runnerId, label: runnerId });
      await connection.commit();
      return parseApproval(await findApproval(pool, current.id));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.post('/marketing-runner/approvals/:id/complete', { preHandler: requireRunner }, async (req, reply) => {
    const runnerId = text(req.body?.runner_id, 120);
    const succeeded = req.body?.succeeded === true;
    if (!runnerId) return reply.code(400).send({ error: 'runner_id is required' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const current = await findApproval(connection, req.params.id, true);
      if (!current) { await connection.rollback(); return reply.code(404).send({ error: 'Approval request not found' }); }
      if (current.status !== 'executing' || current.runner_id !== runnerId) {
        await connection.rollback();
        return reply.code(409).send({ error: 'Approval is not claimed by this runner' });
      }
      const nextStatus = succeeded ? 'succeeded' : 'failed';
      await connection.query(
        'UPDATE marketing_approval_requests SET status = ?, execution_result = ?, last_error = ?, executed_at = NOW() WHERE id = ?',
        [nextStatus, jsonValue(req.body?.result), succeeded ? null : text(req.body?.error, 10000) || 'Execution failed', current.id],
      );
      await approvalEvent(connection, current.id, nextStatus, { id: runnerId, label: runnerId }, { error: succeeded ? null : text(req.body?.error, 10000) || 'Execution failed' });
      await connection.commit();
      return parseApproval(await findApproval(pool, current.id));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });
}

function sanitizeConnection(row, config = marketingConfig()) {
  const adAccounts = jsonParse(row?.available_ad_accounts, []);
  const pages = jsonParse(row?.available_pages, []);
  return {
    configured: config.ready,
    missingConfiguration: [
      !config.graphApiVersion && 'META_GRAPH_API_VERSION', !config.appId && 'META_APP_ID',
      !config.appSecret && 'META_APP_SECRET', !config.redirectUri && 'META_OAUTH_REDIRECT_URI',
      !config.encryptionKey && 'META_TOKEN_ENCRYPTION_KEY',
    ].filter(Boolean),
    status: row?.status || 'disconnected',
    graphApiVersion: config.graphApiVersion || row?.graph_api_version || null,
    redirectUri: config.redirectUri || null,
    grantedScopes: jsonParse(row?.granted_scopes, []),
    availableAdAccounts: adAccounts,
    availablePages: pages,
    selectedAdAccount: adAccounts.find((item) => item.id === row?.selected_ad_account_id) || null,
    selectedPage: pages.find((item) => item.id === row?.selected_page_id) || null,
    selectedInstagramAccountId: row?.selected_instagram_account_id || null,
    instagramUsername: row?.instagram_username || null,
    tokenExpiresAt: row?.token_expires_at || null,
    connectedAt: row?.connected_at || null,
    lastAudit: jsonParse(row?.last_audit, null),
    lastAuditAt: row?.last_audit_at || null,
    lastError: row?.last_error || null,
  };
}

async function connectionRow(pool) {
  const [rows] = await pool.query('SELECT * FROM meta_marketing_connections WHERE id = 1 LIMIT 1');
  return rows?.[0] || null;
}

async function graphRequest(pathname, token, params = {}) {
  const config = marketingConfig();
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${String(pathname).replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  url.searchParams.set('access_token', token);
  url.searchParams.set('appsecret_proof', crypto.createHmac('sha256', config.appSecret).update(token).digest('hex'));
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const meta = data?.error || {};
    const detail = meta.error_user_msg || meta.error_user_title || meta.message;
    const error = new Error(detail || `Meta Graph API returned ${response.status}`);
    error.statusCode = response.status;
    error.metaCode = meta.code;
    error.metaSubcode = meta.error_subcode;
    error.metaUserTitle = meta.error_user_title;
    error.metaUserMessage = meta.error_user_msg;
    throw error;
  }
  return data;
}

async function graphPost(pathname, token, params = {}) {
  const config = marketingConfig();
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${String(pathname).replace(/^\/+/, '')}`);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
  }
  body.set('access_token', token);
  body.set('appsecret_proof', crypto.createHmac('sha256', config.appSecret).update(token).digest('hex'));
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const meta = data?.error || {};
    const detail = meta.error_user_msg || meta.error_user_title || meta.message;
    const error = new Error(detail || `Meta Graph API returned ${response.status}`);
    error.statusCode = response.status;
    error.metaCode = meta.code;
    error.metaSubcode = meta.error_subcode;
    error.metaUserTitle = meta.error_user_title;
    error.metaUserMessage = meta.error_user_msg;
    throw error;
  }
  return data;
}

function campaignShellPayloadHash(item, accountId) {
  return sha256(JSON.stringify({
    schemaVersion: 2,
    accountId,
    itemKey: item.itemKey,
    name: item.name,
    objective: 'OUTCOME_SALES',
    buyingType: 'AUCTION',
    status: 'PAUSED',
    specialAdCategories: [],
    isAdsetBudgetSharingEnabled: false,
  }));
}

function formatMetaExecutionError(error) {
  return [
    text(error?.message, 8000) || 'Meta execution failed',
    error?.metaCode ? `Meta code ${error.metaCode}` : null,
    error?.metaSubcode ? `subcode ${error.metaSubcode}` : null,
  ].filter(Boolean).join(' · ');
}

async function markApprovalExecution(pool, approvalId, succeeded, result, errorMessage = null) {
  const nextStatus = succeeded ? 'succeeded' : 'failed';
  await pool.query(
    `UPDATE marketing_approval_requests
     SET status=?, execution_result=?, last_error=?, executed_at=NOW()
     WHERE id=? AND status='executing'`,
    [nextStatus, jsonValue(result), succeeded ? null : text(errorMessage, 10000) || 'Execution failed', approvalId],
  );
  const connection = await pool.getConnection();
  try {
    await approvalEvent(connection, approvalId, nextStatus, { id: 'vps-meta-api', label: 'VPS Meta API' }, {
      result: succeeded ? result : null,
      error: succeeded ? null : text(errorMessage, 10000) || 'Execution failed',
    });
  } finally { connection.release(); }
}

async function executePausedCampaignBundle(pool, approval) {
  const payload = approval.execution_payload;
  if (!payload || payload.schema_version !== 2 || payload.operation !== 'meta.create_paused_campaign_bundle') {
    throw new Error('Unsupported Meta campaign approval payload');
  }
  if (!Array.isArray(payload.campaigns) || payload.campaigns.length !== META_CAMPAIGN_SHELLS.length) {
    throw new Error('Meta campaign bundle must contain exactly two campaigns');
  }
  const row = await connectionRow(pool);
  const config = marketingConfig();
  const scopes = jsonParse(row?.granted_scopes, []);
  if (!config.ready || !row || row.status !== 'connected') throw new Error('Meta connection is not ready');
  if (!scopes.includes('ads_management')) throw new Error('Meta ads_management permission is missing');
  if (row.selected_ad_account_id !== payload.connection_snapshot?.ad_account_id) {
    throw new Error('Selected Meta ad account changed after approval');
  }
  const token = decryptToken(row, config.encryptionKey);
  const remote = await graphRequest(`${row.selected_ad_account_id}/campaigns`, token, {
    fields: 'id,name,status,effective_status,objective',
    limit: 100,
  });
  const remoteByName = new Map((remote?.data || []).map((item) => [item.name, item]));
  const results = [];
  for (const expected of META_CAMPAIGN_SHELLS) {
    const approved = payload.campaigns.find((item) => item.item_key === expected.itemKey);
    if (!approved || approved.name !== expected.name || approved.status !== 'PAUSED'
      || approved.meta_objective !== 'OUTCOME_SALES' || approved.buying_type !== 'AUCTION'
      || JSON.stringify(approved.special_ad_categories) !== '[]'
      || approved.is_adset_budget_sharing_enabled !== false) {
      throw new Error(`Invalid approved campaign shell: ${expected.itemKey}`);
    }
    const payloadHash = campaignShellPayloadHash(expected, row.selected_ad_account_id);
    const [itemRows] = await pool.query(
      'SELECT * FROM marketing_approval_execution_items WHERE approval_id=? AND item_key=? LIMIT 1',
      [approval.id, expected.itemKey],
    );
    const saved = itemRows?.[0] || null;
    if (saved?.state === 'succeeded' && saved.external_id) {
      results.push({ itemKey: expected.itemKey, campaignId: saved.external_id, status: saved.external_status || 'PAUSED', reused: true });
      continue;
    }
    let campaign = saved?.external_id ? await graphRequest(saved.external_id, token, { fields: 'id,name,status,effective_status,objective' }) : remoteByName.get(expected.name);
    if (!campaign) {
      await pool.query(
        `INSERT INTO marketing_approval_execution_items
          (approval_id,item_key,payload_hash,state) VALUES (?,?,?,'creating')
         ON DUPLICATE KEY UPDATE payload_hash=VALUES(payload_hash),state='creating',last_error=NULL`,
        [approval.id, expected.itemKey, payloadHash],
      );
      let created;
      try {
        created = await graphPost(`${row.selected_ad_account_id}/campaigns`, token, {
          name: expected.name,
          objective: 'OUTCOME_SALES',
          buying_type: 'AUCTION',
          status: 'PAUSED',
          special_ad_categories: '[]',
          is_adset_budget_sharing_enabled: 'false',
        });
      } catch (error) {
        const state = error.metaCode ? 'failed' : 'ambiguous';
        const diagnostic = formatMetaExecutionError(error);
        await pool.query(
          `UPDATE marketing_approval_execution_items
           SET state=?,last_error=? WHERE approval_id=? AND item_key=?`,
          [state, text(diagnostic, 10000), approval.id, expected.itemKey],
        );
        throw error;
      }
      campaign = await graphRequest(created.id, token, { fields: 'id,name,status,effective_status,objective' });
    }
    if (!campaign?.id || campaign.name !== expected.name || !['PAUSED', 'CAMPAIGN_PAUSED'].includes(campaign.effective_status || campaign.status)) {
      throw new Error(`Meta did not confirm paused state for ${expected.itemKey}`);
    }
    await pool.query(
      `INSERT INTO marketing_approval_execution_items
        (approval_id,item_key,payload_hash,external_id,state,external_status,last_error)
       VALUES (?,?,?,?, 'succeeded', ?, NULL)
       ON DUPLICATE KEY UPDATE external_id=VALUES(external_id),state='succeeded',external_status=VALUES(external_status),last_error=NULL`,
      [approval.id, expected.itemKey, payloadHash, campaign.id, campaign.effective_status || campaign.status || 'PAUSED'],
    );
    results.push({ itemKey: expected.itemKey, campaignId: campaign.id, status: campaign.effective_status || campaign.status || 'PAUSED', reused: Boolean(remoteByName.get(expected.name)) });
  }
  return { operation: payload.operation, campaigns: results, financialImpact: 0 };
}

async function runNextMetaApproval(pool) {
  const connection = await pool.getConnection();
  let approval = null;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM marketing_approval_requests
       WHERE status='approved' AND execution_mode='vps_meta_api' AND action_type=?
       ORDER BY approved_at ASC, created_at ASC LIMIT 1 FOR UPDATE`,
      [META_CAMPAIGN_SHELL_ACTION],
    );
    approval = rows?.[0] || null;
    if (!approval) { await connection.rollback(); return null; }
    if ((approval.approval_expires_at && new Date(approval.approval_expires_at).getTime() <= Date.now())
      || !approval.reviewed_by || approval.reviewed_by === approval.requested_by) {
      await connection.query("UPDATE marketing_approval_requests SET status='expired',last_error='Invalid or expired approval' WHERE id=?", [approval.id]);
      await approvalEvent(connection, approval.id, 'expired', { id: 'vps-meta-api', label: 'VPS Meta API' }, { reason: 'invalid_or_expired_approval' });
      await connection.commit();
      return null;
    }
    await connection.query(
      "UPDATE marketing_approval_requests SET status='executing',runner_id='vps-meta-api',execution_started_at=NOW(),attempt_count=attempt_count+1 WHERE id=?",
      [approval.id],
    );
    await approvalEvent(connection, approval.id, 'claimed', { id: 'vps-meta-api', label: 'VPS Meta API' });
    await connection.commit();
    approval = parseApproval({ ...approval, status: 'executing', runner_id: 'vps-meta-api' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  try {
    const result = await executePausedCampaignBundle(pool, approval);
    await markApprovalExecution(pool, approval.id, true, result);
    return result;
  } catch (error) {
    await markApprovalExecution(pool, approval.id, false, null, formatMetaExecutionError(error));
    return null;
  }
}

function startMetaApprovalWorker(pool) {
  if (metaApprovalWorkerStarted) return;
  metaApprovalWorkerStarted = true;
  const timer = setInterval(() => {
    runNextMetaApproval(pool).catch((error) => console.error('[meta-approval-worker]', text(error.message, 1000)));
  }, 15000);
  timer.unref?.();
}

async function discoverAssets(token) {
  const [adAccounts, pages, permissions] = await Promise.all([
    graphRequest('me/adaccounts', token, { fields: 'id,account_id,name,account_status,currency,timezone_name,business_name', limit: 100 }),
    graphRequest('me/accounts', token, { fields: 'id,name,instagram_business_account{id,username,name,profile_picture_url}', limit: 100 }),
    graphRequest('me/permissions', token),
  ]);
  return {
    adAccounts: Array.isArray(adAccounts?.data) ? adAccounts.data : [],
    pages: Array.isArray(pages?.data) ? pages.data : [],
    grantedScopes: (permissions?.data || []).filter((item) => item.status === 'granted').map((item) => item.permission),
  };
}

function dateText(date) { return date.toISOString().slice(0, 10); }

function insightRanges(preset) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let since;
  if (preset === 'this_month') since = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  else {
    const days = Number(String(preset).match(/\d+/)?.[0] || 7);
    since = new Date(today);
    since.setUTCDate(since.getUTCDate() - days + 1);
  }
  const duration = Math.max(1, Math.round((today.getTime() - since.getTime()) / 86400000) + 1);
  const previousUntil = new Date(since);
  previousUntil.setUTCDate(previousUntil.getUTCDate() - 1);
  const previousSince = new Date(previousUntil);
  previousSince.setUTCDate(previousSince.getUTCDate() - duration + 1);
  return {
    current: { since: dateText(since), until: dateText(today) },
    previous: { since: dateText(previousSince), until: dateText(previousUntil) },
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(items, types) {
  if (!Array.isArray(items)) return 0;
  for (const type of types) {
    const match = items.find((item) => item.action_type === type);
    if (match) return number(match.value);
  }
  return 0;
}

const MESSAGE_ACTIONS = [
  'onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply',
  'messaging_conversation_started_7d', 'messaging_first_reply',
];
const PURCHASE_ACTIONS = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];

function normalizeInsight(row, campaigns) {
  const spend = number(row.spend);
  const impressions = number(row.impressions);
  const reach = number(row.reach);
  const clicks = number(row.clicks);
  const linkClicks = number(row.inline_link_clicks) || actionValue(row.actions, ['link_click', 'outbound_click']);
  const conversations = actionValue(row.actions, MESSAGE_ACTIONS);
  const purchases = actionValue(row.actions, PURCHASE_ACTIONS);
  const purchaseValue = actionValue(row.action_values, PURCHASE_ACTIONS);
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name || campaigns.get(row.campaign_id)?.name || row.campaign_id,
    status: campaigns.get(row.campaign_id)?.effective_status || 'UNKNOWN',
    dateStart: row.date_start || null,
    dateStop: row.date_stop || null,
    currency: row.account_currency || null,
    metrics: {
      spend, impressions, reach,
      frequency: number(row.frequency) || (reach ? impressions / reach : 0),
      cpm: number(row.cpm) || (impressions ? spend / impressions * 1000 : 0),
      clicks, uniqueClicks: number(row.unique_clicks), linkClicks,
      outboundClicks: actionValue(row.outbound_clicks, ['outbound_click']),
      ctr: number(row.ctr) || (impressions ? clicks / impressions * 100 : 0),
      cpc: number(row.cpc) || (clicks ? spend / clicks : 0),
      costPerLinkClick: linkClicks ? spend / linkClicks : 0,
      engagements: number(row.inline_post_engagement), conversations,
      costPerConversation: conversations ? spend / conversations : 0,
      purchases, costPerPurchase: purchases ? spend / purchases : 0,
      purchaseValue, roas: spend ? purchaseValue / spend : 0,
      videoPlays: actionValue(row.video_play_actions, ['video_view']),
      thruPlays: actionValue(row.video_thruplay_watched_actions, ['video_view']),
    },
    actions: Array.isArray(row.actions) ? row.actions : [],
    actionValues: Array.isArray(row.action_values) ? row.action_values : [],
  };
}

function insightTotals(items) {
  const additive = [
    'spend', 'impressions', 'reach', 'clicks', 'uniqueClicks', 'linkClicks', 'outboundClicks',
    'engagements', 'conversations', 'purchases', 'purchaseValue', 'videoPlays', 'thruPlays',
  ];
  const totals = Object.fromEntries(additive.map((key) => [key, 0]));
  for (const item of items) for (const key of additive) totals[key] += number(item.metrics?.[key]);
  totals.frequency = totals.reach ? totals.impressions / totals.reach : 0;
  totals.cpm = totals.impressions ? totals.spend / totals.impressions * 1000 : 0;
  totals.ctr = totals.impressions ? totals.clicks / totals.impressions * 100 : 0;
  totals.cpc = totals.clicks ? totals.spend / totals.clicks : 0;
  totals.costPerLinkClick = totals.linkClicks ? totals.spend / totals.linkClicks : 0;
  totals.costPerConversation = totals.conversations ? totals.spend / totals.conversations : 0;
  totals.costPerPurchase = totals.purchases ? totals.spend / totals.purchases : 0;
  totals.roas = totals.spend ? totals.purchaseValue / totals.spend : 0;
  return totals;
}

async function campaignInsights(token, accountId, range, campaigns) {
  const result = await graphRequest(`${accountId}/insights`, token, {
    level: 'campaign', time_range: JSON.stringify(range), time_increment: 'all_days',
    action_report_time: 'conversion', action_breakdowns: 'action_type', limit: 100,
    fields: [
      'date_start', 'date_stop', 'account_currency', 'campaign_id', 'campaign_name', 'spend',
      'impressions', 'reach', 'frequency', 'clicks', 'unique_clicks', 'inline_link_clicks',
      'inline_post_engagement', 'outbound_clicks', 'ctr', 'cpc', 'cpm', 'actions',
      'action_values', 'video_play_actions', 'video_thruplay_watched_actions',
    ].join(','),
  });
  return (Array.isArray(result?.data) ? result.data : []).map((row) => normalizeInsight(row, campaigns));
}

function registerMetaRoutes(fastify, { pool, requireAdminBearerToken, getBearerAuthContext, getPublicAppUrl }) {
  function redirect(reply, query) {
    const target = new URL('/admin/settings/marketing', getPublicAppUrl());
    target.searchParams.set('tab', 'campaigns');
    for (const [key, value] of Object.entries(query)) target.searchParams.set(key, String(value));
    return reply.redirect(target.toString());
  }

  fastify.get('/admin/marketing/meta/status', { preHandler: requireAdminBearerToken }, async () => ({
    ok: true, connection: sanitizeConnection(await connectionRow(pool)),
  }));

  fastify.post('/admin/marketing/meta/campaign-draft-approvals', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    const config = marketingConfig();
    const row = await connectionRow(pool);
    const scopes = jsonParse(row?.granted_scopes, []);
    if (!config.ready || !row || row.status !== 'connected') return reply.code(409).send({ error: 'Meta is not connected' });
    if (!row.selected_ad_account_id || !row.selected_page_id || !row.selected_instagram_account_id) {
      return reply.code(409).send({ error: 'Select Meta assets before preparing campaigns' });
    }
    if (!scopes.includes('ads_management')) return reply.code(409).send({ error: 'Meta ads_management permission is missing' });
    const [preferenceRows] = await pool.query(
      "SELECT value_json FROM admin_preferences WHERE preference_key='marketing.instagram.campaign_portfolio' LIMIT 1",
    );
    const portfolio = jsonParse(preferenceRows?.[0]?.value_json, null);
    const configured = Array.isArray(portfolio?.campaigns) ? portfolio.campaigns : [];
    const byId = new Map(configured.map((item) => [item.id, item]));
    const budgets = META_CAMPAIGN_SHELLS.map((shell) => {
      const item = byId.get(shell.itemKey);
      const amount = Number(item?.authorizedAmount || 0);
      const days = Math.max(1, Math.min(90, Number(item?.durationDays || 0)));
      if (!Number.isFinite(amount) || amount <= 0 || !days) return null;
      return {
        itemKey: shell.itemKey,
        name: shell.name,
        budgetType: item.budgetType === 'lifetime' ? 'lifetime' : 'daily',
        authorizedAmount: amount,
        durationDays: days,
        periodLimit: item.budgetType === 'lifetime' ? amount : amount * days,
      };
    });
    if (budgets.some((item) => !item)) return reply.code(409).send({ error: 'Configure both campaign budgets first' });
    const payload = {
      schema_version: 2,
      operation: 'meta.create_paused_campaign_bundle',
      connection_snapshot: {
        connection_id: 1,
        ad_account_id: row.selected_ad_account_id,
        page_id: row.selected_page_id,
        instagram_account_id: row.selected_instagram_account_id,
        graph_api_version: config.graphApiVersion,
      },
      campaigns: META_CAMPAIGN_SHELLS.map((item) => ({
        item_key: item.itemKey,
        name: item.name,
        logical_objective: 'sales',
        meta_objective: 'OUTCOME_SALES',
        buying_type: 'AUCTION',
        status: 'PAUSED',
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
      })),
    };
    const idempotencyKey = `meta-shells-v2:${sha256(JSON.stringify(payload)).slice(0, 120)}`;
    const [existingRows] = await pool.query(
      'SELECT * FROM marketing_approval_requests WHERE idempotency_key=? LIMIT 1',
      [idempotencyKey],
    );
    if (existingRows?.[0]) return { ok: true, approval: parseApproval(existingRows[0]), reused: true };
    const id = crypto.randomUUID();
    const auth = await getBearerAuthContext(req);
    const proposedState = {
      campaigns: budgets,
      externalCreation: { status: 'PAUSED', budgetApplied: false, adSetsCreated: false, adsCreated: false },
      audiencePlan: {
        firstMonth: 'Broad local audience within Petrolina-PE and Juazeiro-BA',
        competitorPhysicalTest: 'Only after 15-30 days of baseline data and without increasing the monthly cap',
        competitorInstagramVisitors: 'Not targetable; use only authorized first-party audiences and broad signals',
      },
    };
    const financialImpact = {
      currency: 'BRL',
      immediateMaximum: 0,
      authorizedMonthlyCeiling: budgets.reduce((sum, item) => sum + item.periodLimit, 0),
      reason: 'This approval creates only paused campaign shells without budget, ad sets or ads',
    };
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO marketing_approval_requests
          (id,channel,action_type,title,target_type,target_name,execution_mode,current_state,proposed_state,
           evidence,financial_impact,success_criteria,rollback_plan,execution_payload,requested_by,requested_by_label,
           idempotency_key,approval_expires_at)
         VALUES (?, 'instagram', ?, ?, 'meta_campaign_bundle', ?, 'vps_meta_api', ?, ?, ?, ?, ?, ?, ?,
                 'marketing-agent', 'Agente especialista de campanhas', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
        [
          id,
          META_CAMPAIGN_SHELL_ACTION,
          'Criar duas campanhas Meta pausadas para o Mercado do Vale',
          META_CAMPAIGN_SHELLS.map((item) => item.name).join(' + '),
          jsonValue({ activeCampaigns: row.last_audit ? jsonParse(row.last_audit, {})?.campaignSummary?.active || 0 : null }),
          jsonValue(proposedState),
          jsonValue({ source: 'Meta audit + saved Gestão MV portfolio', requestedByAdmin: auth.userId || auth.customerId || null }),
          jsonValue(financialImpact),
          jsonValue({ required: 'Exactly two campaigns confirmed PAUSED; zero ad sets, ads and spend' }),
          'Os containers permanecem pausados. Qualquer exclusão ou arquivamento exige nova aprovação.',
          jsonValue(payload),
          idempotencyKey,
        ],
      );
      await approvalEvent(connection, id, 'requested', { id: 'marketing-agent', label: 'Agente especialista de campanhas' }, {
        action_type: META_CAMPAIGN_SHELL_ACTION,
        execution_mode: 'vps_meta_api',
        financial_impact: 0,
      });
      await connection.commit();
      return reply.code(201).send({ ok: true, approval: parseApproval(await findApproval(pool, id)), reused: false });
    } catch (error) {
      await connection.rollback();
      if (error?.code === 'ER_DUP_ENTRY') {
        const [rows] = await pool.query('SELECT * FROM marketing_approval_requests WHERE idempotency_key=? LIMIT 1', [idempotencyKey]);
        if (rows?.[0]) return { ok: true, approval: parseApproval(rows[0]), reused: true };
      }
      throw error;
    } finally { connection.release(); }
  });

  fastify.post('/admin/marketing/meta/oauth/start', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    const config = marketingConfig();
    if (!config.ready) return reply.code(503).send({ error: 'Meta integration is not configured', connection: sanitizeConnection(await connectionRow(pool), config) });
    const auth = await getBearerAuthContext(req);
    const state = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      'INSERT INTO meta_marketing_oauth_states (state_hash, requested_by, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [sha256(state), auth.userId || auth.customerId || null],
    );
    await pool.query('DELETE FROM meta_marketing_oauth_states WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)');
    const url = new URL(`https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`);
    url.searchParams.set('client_id', config.appId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', config.scopes.join(','));
    url.searchParams.set('response_type', 'code');
    return { ok: true, authorizationUrl: url.toString() };
  });

  fastify.get('/integrations/meta/oauth/callback', async (req, reply) => {
    const config = marketingConfig();
    const query = req.query || {};
    if (!config.ready) return redirect(reply, { meta: 'error', reason: 'not_configured' });
    if (query.error) return redirect(reply, { meta: 'error', reason: query.error_reason || query.error });
    if (!query.code || !query.state) return redirect(reply, { meta: 'error', reason: 'missing_code_or_state' });
    const db = await pool.getConnection();
    let stateRow;
    try {
      await db.beginTransaction();
      const [rows] = await db.query(
        'SELECT * FROM meta_marketing_oauth_states WHERE state_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE',
        [sha256(query.state)],
      );
      stateRow = rows?.[0];
      if (!stateRow) { await db.rollback(); return redirect(reply, { meta: 'error', reason: 'invalid_or_expired_state' }); }
      await db.query('UPDATE meta_marketing_oauth_states SET used_at = NOW() WHERE state_hash = ?', [sha256(query.state)]);
      await db.commit();
    } catch (error) {
      await db.rollback().catch(() => {});
      throw error;
    } finally { db.release(); }

    try {
      const tokenUrl = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);
      tokenUrl.searchParams.set('client_id', config.appId);
      tokenUrl.searchParams.set('client_secret', config.appSecret);
      tokenUrl.searchParams.set('redirect_uri', config.redirectUri);
      tokenUrl.searchParams.set('code', String(query.code));
      const tokenResponse = await fetch(tokenUrl, { headers: { Accept: 'application/json' } });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData?.access_token) throw new Error(tokenData?.error?.message || `Token exchange returned ${tokenResponse.status}`);
      let accessToken = tokenData.access_token;
      let expiresIn = Number(tokenData.expires_in || 3600);
      const longUrl = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);
      longUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longUrl.searchParams.set('client_id', config.appId);
      longUrl.searchParams.set('client_secret', config.appSecret);
      longUrl.searchParams.set('fb_exchange_token', accessToken);
      const longResponse = await fetch(longUrl, { headers: { Accept: 'application/json' } });
      const longData = await longResponse.json().catch(() => ({}));
      if (longResponse.ok && longData?.access_token) { accessToken = longData.access_token; expiresIn = Number(longData.expires_in || expiresIn); }
      const assets = await discoverAssets(accessToken);
      const encrypted = encryptToken(accessToken, config.encryptionKey);
      const oneAdAccount = assets.adAccounts.length === 1 ? assets.adAccounts[0] : null;
      const instagramPages = assets.pages.filter((page) => page.instagram_business_account?.id);
      const onePage = instagramPages.length === 1 ? instagramPages[0] : null;
      await pool.query(
        `INSERT INTO meta_marketing_connections
          (id, status, graph_api_version, token_ciphertext, token_iv, token_auth_tag, token_expires_at,
           granted_scopes, available_ad_accounts, available_pages, selected_ad_account_id, selected_page_id,
           selected_instagram_account_id, instagram_username, last_error, connected_by, connected_at)
         VALUES (1, 'connected', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?, ?, ?, ?, ?, ?, NULL, ?, NOW())
         ON DUPLICATE KEY UPDATE status='connected', graph_api_version=VALUES(graph_api_version),
           token_ciphertext=VALUES(token_ciphertext), token_iv=VALUES(token_iv), token_auth_tag=VALUES(token_auth_tag),
           token_expires_at=VALUES(token_expires_at), granted_scopes=VALUES(granted_scopes),
           available_ad_accounts=VALUES(available_ad_accounts), available_pages=VALUES(available_pages),
           selected_ad_account_id=VALUES(selected_ad_account_id), selected_page_id=VALUES(selected_page_id),
           selected_instagram_account_id=VALUES(selected_instagram_account_id), instagram_username=VALUES(instagram_username),
           last_error=NULL, connected_by=VALUES(connected_by), connected_at=NOW()`,
        [
          config.graphApiVersion, encrypted.ciphertext, encrypted.iv, encrypted.authTag, Math.max(60, expiresIn),
          JSON.stringify(assets.grantedScopes), JSON.stringify(assets.adAccounts), JSON.stringify(assets.pages),
          oneAdAccount?.id || null, onePage?.id || null, onePage?.instagram_business_account?.id || null,
          onePage?.instagram_business_account?.username || null, stateRow.requested_by || null,
        ],
      );
      return redirect(reply, { meta: 'connected' });
    } catch (error) {
      await pool.query(
        `INSERT INTO meta_marketing_connections (id,status,graph_api_version,last_error) VALUES (1,'error',?,?)
         ON DUPLICATE KEY UPDATE status='error',last_error=VALUES(last_error)`,
        [config.graphApiVersion, text(error.message, 2000)],
      ).catch(() => {});
      return redirect(reply, { meta: 'error', reason: 'connection_failed' });
    }
  });

  fastify.patch('/admin/marketing/meta/selection', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    const row = await connectionRow(pool);
    if (!row || row.status !== 'connected') return reply.code(409).send({ error: 'Meta is not connected' });
    const adAccount = jsonParse(row.available_ad_accounts, []).find((item) => item.id === req.body?.adAccountId);
    const page = jsonParse(row.available_pages, []).find((item) => item.id === req.body?.pageId);
    if (!adAccount || !page?.instagram_business_account?.id) return reply.code(400).send({ error: 'Select a discovered ad account and Instagram Page' });
    await pool.query(
      'UPDATE meta_marketing_connections SET selected_ad_account_id=?,selected_page_id=?,selected_instagram_account_id=?,instagram_username=?,last_error=NULL WHERE id=1',
      [adAccount.id, page.id, page.instagram_business_account.id, page.instagram_business_account.username || null],
    );
    return { ok: true, connection: sanitizeConnection(await connectionRow(pool)) };
  });

  fastify.post('/admin/marketing/meta/audit', { preHandler: requireAdminBearerToken }, async (_req, reply) => {
    const config = marketingConfig();
    const row = await connectionRow(pool);
    if (!config.ready || !row || row.status !== 'connected') return reply.code(409).send({ error: 'Meta is not connected and configured' });
    if (!row.selected_ad_account_id || !row.selected_page_id || !row.selected_instagram_account_id) return reply.code(409).send({ error: 'Select Meta assets before auditing' });
    try {
      const token = decryptToken(row, config.encryptionKey);
      const [account, campaigns, instagram] = await Promise.all([
        graphRequest(row.selected_ad_account_id, token, { fields: 'id,account_id,name,account_status,currency,timezone_name,amount_spent,balance,spend_cap' }),
        graphRequest(`${row.selected_ad_account_id}/campaigns`, token, { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time', limit: 100 }),
        graphRequest(row.selected_instagram_account_id, token, { fields: 'id,username,name,followers_count,media_count,profile_picture_url' }),
      ]);
      const items = Array.isArray(campaigns?.data) ? campaigns.data : [];
      const audit = {
        mode: 'read_only', capturedAt: new Date().toISOString(), account, instagram,
        campaignSummary: {
          total: items.length,
          active: items.filter((item) => item.effective_status === 'ACTIVE').length,
          paused: items.filter((item) => item.effective_status === 'PAUSED').length,
        },
        campaigns: items,
      };
      await pool.query("UPDATE meta_marketing_connections SET last_audit=?,last_audit_at=NOW(),last_error=NULL,status='connected' WHERE id=1", [JSON.stringify(audit)]);
      return { ok: true, audit, connection: sanitizeConnection(await connectionRow(pool), config) };
    } catch (error) {
      const status = error.metaCode === 190 ? 'expired' : 'error';
      await pool.query('UPDATE meta_marketing_connections SET status=?,last_error=? WHERE id=1', [status, text(error.message, 2000)]);
      return reply.code(error.statusCode === 401 ? 401 : 502).send({ error: error.message, status });
    }
  });

  fastify.get('/admin/marketing/meta/insights', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    const preset = INSIGHTS_PRESETS.has(req.query?.datePreset) ? req.query.datePreset : 'last_7d';
    const config = marketingConfig();
    const row = await connectionRow(pool);
    if (!config.ready || !row || row.status !== 'connected' || !row.selected_ad_account_id) {
      return reply.code(409).send({ error: 'Connect and select a Meta ad account before reading insights' });
    }
    try {
      const token = decryptToken(row, config.encryptionKey);
      const ranges = insightRanges(preset);
      const campaignsResult = await graphRequest(`${row.selected_ad_account_id}/campaigns`, token, { fields: 'id,name,effective_status', limit: 100 });
      const campaigns = new Map((campaignsResult?.data || []).map((item) => [item.id, item]));
      const [current, previous] = await Promise.all([
        campaignInsights(token, row.selected_ad_account_id, ranges.current, campaigns),
        campaignInsights(token, row.selected_ad_account_id, ranges.previous, campaigns),
      ]);
      return {
        ok: true, mode: 'read_only', datePreset: preset,
        attribution: 'Meta action_report_time=conversion; a janela efetiva segue a configuração unificada da conta/campanha',
        ranges,
        current: { totals: insightTotals(current), campaigns: current },
        previous: { totals: insightTotals(previous), campaigns: previous },
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      const status = error.metaCode === 190 ? 'expired' : 'error';
      await pool.query('UPDATE meta_marketing_connections SET status=?,last_error=? WHERE id=1', [status, text(error.message, 2000)]);
      return reply.code(error.statusCode === 401 ? 401 : 502).send({ error: error.message, status });
    }
  });
}

function registerMarketingCampaignRoutes(fastify, dependencies) {
  registerApprovalRoutes(fastify, dependencies);
  registerMetaRoutes(fastify, dependencies);
  startMetaApprovalWorker(dependencies.pool);
}

module.exports = { ensureMarketingCampaignTables, registerMarketingCampaignRoutes };
