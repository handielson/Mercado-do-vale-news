'use strict';

const { SHIPPING_DOCUMENT_PATH } = require('./tiktokShopFulfillmentService.cjs');

const PRINTABLE_STATUS = new Set(['AWAITING_COLLECTION']);
const ORDER_ID = /^\d{8,32}$/;

function summaryFromOrder(order, packageId, trackingNumber) {
  const selectedPackage = (order.packages || []).find(pkg => String(pkg.id || pkg.package_id) === String(packageId));
  const lineIds = new Set((selectedPackage?.order_line_item_ids || []).map(String));
  const lines = (order.line_items || []).filter(item => !lineIds.size || lineIds.has(String(item.id || item.line_item_id)));
  return {
    orderSn: String(order.id), marketplaceName: 'TIKTOK SHOP', trackingNumber: String(trackingNumber || ''),
    buyerName: String(order.recipient_address?.name || order.buyer_email || 'Cliente TikTok'),
    shippingCarrier: String(order.delivery_option_name || 'TikTok Shop'), createdAt: Number(order.create_time || 0),
    note: `Pacote ${packageId}`,
    items: lines.map(item => ({
      name: String(item.product_name || item.display_name || 'Produto'),
      sku: String(item.seller_sku || ''), quantity: Number(item.quantity || 1),
      modelName: String(item.sku_name || item.sku_variation || ''),
    })),
  };
}

function isPrintableOrder(order) {
  return ORDER_ID.test(String(order?.id || ''))
    && PRINTABLE_STATUS.has(String(order?.status || '').toUpperCase())
    && !order?.cancellation_request && !order?.cancel_reason;
}

function documentData(payload) {
  const data = payload?.data || {};
  return { url: String(data.doc_url || data.document?.doc_url || ''), trackingNumber: String(data.tracking_number || '') };
}

async function ensureTikTokPrintTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_shop_automation_config (
    id TINYINT NOT NULL PRIMARY KEY,
    activated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query('INSERT IGNORE INTO tiktok_shop_automation_config (id) VALUES (1)');
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_shop_print_jobs (
    package_id VARCHAR(80) NOT NULL PRIMARY KEY,
    order_id VARCHAR(40) NOT NULL,
    status ENUM('ready','printing','printed','intervention') NOT NULL DEFAULT 'ready',
    tracking_number VARCHAR(120) NULL,
    summary JSON NOT NULL,
    label_printed_at DATETIME NULL,
    summary_printed_at DATETIME NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tiktok_print_queue (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function registerTikTokPrintRoutes(fastify, { pool, requireSyncKey, requireSyncKeyOrAdmin, callApi, loadSettings }) {
  const getOrder = async orderId => {
    if (!ORDER_ID.test(String(orderId || ''))) throw new Error('Pedido TikTok inválido.');
    const settings = await loadSettings();
    const result = await callApi(settings, { pathname: '/order/202309/orders', query: { ids: String(orderId) } });
    return result?.payload?.data?.orders?.find(item => String(item.id) === String(orderId)) || null;
  };
  const getDocument = async packageId => {
    const settings = await loadSettings();
    const result = await callApi(settings, { pathname: SHIPPING_DOCUMENT_PATH(packageId), query: { document_type: 'SHIPPING_LABEL', invoice_label: 'true' } });
    return documentData(result?.payload);
  };
  const syncOrder = async orderId => {
    const order = await getOrder(orderId);
    if (!isPrintableOrder(order)) return { queued: 0, reason: 'order_not_ready' };
    let queued = 0;
    for (const pkg of order.packages || []) {
      const packageId = String(pkg.id || pkg.package_id || '');
      if (!packageId) continue;
      const document = await getDocument(packageId);
      if (!document.url) continue;
      const summary = summaryFromOrder(order, packageId, document.trackingNumber || pkg.tracking_number);
      if (!summary.items.length) throw new Error(`Pacote ${packageId} sem itens para conferência.`);
      const [result] = await pool.query(`INSERT IGNORE INTO tiktok_shop_print_jobs
        (package_id,order_id,tracking_number,summary) VALUES (?,?,?,?)`,
      [packageId, String(order.id), summary.trackingNumber, JSON.stringify(summary)]);
      queued += result.affectedRows;
    }
    return { queued };
  };
  const syncPrintJobs = async (request, reply) => {
    try { return await syncOrder(request.body?.order_id); }
    catch (error) { return reply.code(502).send({ error: error.message }); }
  };
  fastify.post('/api/tiktok-shop/print-jobs/sync', { preHandler: requireSyncKeyOrAdmin }, syncPrintJobs);
  fastify.post('/tiktok-shop/print-jobs/sync', { preHandler: requireSyncKeyOrAdmin }, syncPrintJobs);
  const getPrintJobs = async (request, reply) => {
    const orderId = String(request.params?.orderId || '').trim();
    if (!ORDER_ID.test(orderId)) return reply.code(400).send({ error: 'Pedido TikTok inválido.' });
    const [rows] = await pool.query(`SELECT package_id,order_id,status,tracking_number,label_printed_at,summary_printed_at,last_error,updated_at
      FROM tiktok_shop_print_jobs WHERE order_id=? ORDER BY created_at DESC LIMIT 10`, [orderId]);
    return { orderId, jobs: rows };
  };
  fastify.get('/api/tiktok-shop/print-jobs/order/:orderId', { preHandler: requireSyncKeyOrAdmin }, getPrintJobs);
  fastify.get('/tiktok-shop/print-jobs/order/:orderId', { preHandler: requireSyncKeyOrAdmin }, getPrintJobs);
  fastify.get('/api/tiktok-shop/print-jobs/next', { preHandler: requireSyncKey }, async (_request, reply) => {
    const [rows] = await pool.query(`SELECT * FROM tiktok_shop_print_jobs WHERE status='ready'
      OR (status='printing' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)) ORDER BY created_at LIMIT 1`);
    if (!rows.length) return reply.code(204).send();
    const job = rows[0];
    const order = await getOrder(job.order_id);
    if (!isPrintableOrder(order) || !(order.packages || []).some(pkg => String(pkg.id || pkg.package_id) === job.package_id)) {
      await pool.query("UPDATE tiktok_shop_print_jobs SET status='intervention',last_error='Pedido deixou de estar apto' WHERE package_id=?", [job.package_id]);
      return reply.code(204).send();
    }
    const [claim] = await pool.query(`UPDATE tiktok_shop_print_jobs SET status='printing', attempts=attempts+1
      WHERE package_id=? AND (status='ready' OR (status='printing' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)))`, [job.package_id]);
    if (!claim.affectedRows) return reply.code(204).send();
    return { packageId: job.package_id, orderId: job.order_id,
      summary: typeof job.summary === 'string' ? JSON.parse(job.summary) : job.summary,
      labelPrintedAt: job.label_printed_at, summaryPrintedAt: job.summary_printed_at };
  });
  fastify.get('/api/tiktok-shop/print-jobs/:packageId/label', { preHandler: requireSyncKey }, async (request, reply) => {
    const packageId = String(request.params.packageId || '');
    const [rows] = await pool.query('SELECT order_id FROM tiktok_shop_print_jobs WHERE package_id=? LIMIT 1', [packageId]);
    if (!rows.length) return reply.code(404).send({ error: 'Pacote não encontrado' });
    const order = await getOrder(rows[0].order_id);
    if (!isPrintableOrder(order)) return reply.code(409).send({ error: 'Pedido não apto para impressão' });
    const document = await getDocument(packageId);
    const url = new URL(document.url);
    if (url.protocol !== 'https:' || !/(^|\.)(?:tiktokshop\.com|tiktokglobalshop\.com)$/.test(url.hostname)) {
      return reply.code(502).send({ error: 'URL da etiqueta TikTok não confiável' });
    }
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) return reply.code(502).send({ error: 'Etiqueta TikTok indisponível' });
    const pdf = Buffer.from(await response.arrayBuffer());
    if (pdf.length > 15 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== '%PDF-') {
      return reply.code(502).send({ error: 'Documento TikTok não é PDF válido' });
    }
    return reply.type('application/pdf').header('Cache-Control', 'no-store').send(pdf);
  });
  fastify.post('/api/tiktok-shop/print-jobs/:packageId/step', { preHandler: requireSyncKey }, async (request, reply) => {
    const column = { label: 'label_printed_at', summary: 'summary_printed_at' }[String(request.body?.step || '')];
    if (!column) return reply.code(400).send({ error: 'Etapa inválida' });
    const [result] = await pool.query(`UPDATE tiktok_shop_print_jobs SET ${column}=COALESCE(${column},NOW()),last_error=NULL WHERE package_id=?`, [request.params.packageId]);
    return result.affectedRows ? { ok: true } : reply.code(404).send({ error: 'Pacote não encontrado' });
  });
  fastify.post('/api/tiktok-shop/print-jobs/:packageId/complete', { preHandler: requireSyncKey }, async (request, reply) => {
    const packageId = String(request.params.packageId || '');
    if (request.body?.ok === false) {
      await pool.query('UPDATE tiktok_shop_print_jobs SET status=?,last_error=? WHERE package_id=?',
        [request.body.retryable ? 'ready' : 'intervention', String(request.body.error || 'Falha').slice(0, 1000), packageId]);
      return { ok: true };
    }
    const [rows] = await pool.query('SELECT label_printed_at,summary_printed_at FROM tiktok_shop_print_jobs WHERE package_id=?', [packageId]);
    if (!rows.length) return reply.code(404).send({ error: 'Pacote não encontrado' });
    if (!rows[0].label_printed_at || !rows[0].summary_printed_at) return reply.code(409).send({ error: 'Impressão incompleta' });
    await pool.query("UPDATE tiktok_shop_print_jobs SET status='printed',last_error=NULL WHERE package_id=?", [packageId]);
    return { ok: true };
  });
  return { syncOrder };
}

module.exports = { ensureTikTokPrintTable, registerTikTokPrintRoutes, summaryFromOrder, isPrintableOrder, documentData };
