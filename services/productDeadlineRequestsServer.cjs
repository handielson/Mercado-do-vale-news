'use strict';

const crypto = require('crypto');
const { STOREFRONTS, STATUSES, normalizeDeadlineRequest, normalizeAdminUpdate, deadlineLabel, buildAdminNotification } = require('./productDeadlineRequest.cjs');

async function ensureProductDeadlineRequestsTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS product_deadline_requests (
    id CHAR(36) NOT NULL PRIMARY KEY,
    public_code VARCHAR(20) NOT NULL,
    storefront ENUM('mercado_do_vale','loja_3d') NOT NULL,
    product_id CHAR(36) NOT NULL,
    sku_snapshot VARCHAR(191) NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    quantity_requested INT UNSIGNED NOT NULL,
    lead_time_label_snapshot VARCHAR(120) NOT NULL,
    customer_name VARCHAR(160) NOT NULL,
    customer_phone VARCHAR(32) NOT NULL,
    customer_email VARCHAR(254) NULL,
    customer_message VARCHAR(1000) NULL,
    status ENUM('new','contacted','negotiating','approved','declined','closed') NOT NULL DEFAULT 'new',
    negotiated_business_days SMALLINT UNSIGNED NULL,
    admin_notes VARCHAR(2000) NULL,
    whatsapp_notification_status ENUM('pending','sent','unconfigured','failed') NOT NULL DEFAULT 'pending',
    whatsapp_notification_error VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_deadline_request_code (public_code),
    KEY idx_product_deadline_storefront_status (storefront,status,created_at),
    KEY idx_product_deadline_product (product_id,created_at),
    KEY idx_product_deadline_phone (customer_phone,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

function publicCode() {
  return `PRZ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function eligibleProduct(row, storefront) {
  if (!row || row.status !== 'active' || Number(row.is_parent) === 1 || Number(row.print3d_preorder_enabled) !== 1) return false;
  if (storefront === 'loja_3d') return Number(row.is_print3d) === 1 && row.publication_status === 'published' && Number(row.offer_price) > 0;
  return (row.publication_status === 'published' && Number(row.offer_price) > 0)
    || (row.publication_status == null && Number(row.is_print3d) === 0 && Number(row.hide_from_catalog || 0) === 0 && Number(row.price_retail) > 0);
}

function registerProductDeadlineRequestRoutes(app, { pool, getBearerAuthContext, notifyAdmins }) {
  const admin = async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(request);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
  };

  app.post('/storefronts/:storefront/deadline-requests', {
    config: { rateLimit: { max: 8, timeWindow: '1 minute' } }, bodyLimit: 16 * 1024,
  }, async (request, reply) => {
    let input;
    try { input = normalizeDeadlineRequest(request.params.storefront, request.body); }
    catch (error) { return reply.code(error.statusCode || 400).send({ error: error.message }); }
    try {
      const [rows] = await pool.query(`SELECT p.id,p.sku,p.name,p.status,p.is_parent,p.is_print3d,p.print3d_preorder_enabled,
          p.production_days,p.print3d_preorder_limit,p.hide_from_catalog,p.price_retail,
          o.publication_status,o.price_retail AS offer_price,o.title AS offer_title
        FROM products p LEFT JOIN product_storefront_offers o ON o.product_id=p.id AND o.storefront=?
        WHERE p.id=? LIMIT 1`, [input.storefront, input.product_id]);
      const product = rows[0];
      if (!eligibleProduct(product, input.storefront)) return reply.code(404).send({ error: 'Produto indisponível para solicitação neste site.' });
      const id = crypto.randomUUID();
      const code = publicCode();
      const snapshot = {
        ...input, id, public_code: code, product_name: product.offer_title || product.name, sku: product.sku,
        lead_time_label: deadlineLabel(product.production_days),
      };
      await pool.query(`INSERT INTO product_deadline_requests
        (id,public_code,storefront,product_id,sku_snapshot,product_name_snapshot,quantity_requested,lead_time_label_snapshot,
         customer_name,customer_phone,customer_email,customer_message)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [id, code, input.storefront, input.product_id, product.sku, snapshot.product_name,
        input.quantity, snapshot.lead_time_label, input.customer_name, input.customer_phone, input.customer_email, input.customer_message]);
      let notification = { status: 'unconfigured' };
      try { notification = await notifyAdmins({ ...snapshot, message: buildAdminNotification(snapshot) }); }
      catch (error) { notification = { status: 'failed', error: error.message }; }
      const notificationStatus = ['sent', 'unconfigured'].includes(notification?.status) ? notification.status : 'failed';
      await pool.query(`UPDATE product_deadline_requests SET whatsapp_notification_status=?,whatsapp_notification_error=? WHERE id=?`,
        [notificationStatus, notification?.error ? String(notification.error).slice(0, 255) : null, id]);
      reply.header('Cache-Control', 'no-store');
      return reply.code(201).send({ ok: true, id, public_code: code, storefront: input.storefront,
        lead_time_label: snapshot.lead_time_label, notification_status: notificationStatus });
    } catch (error) {
      request.log?.error({ err: error }, 'product-deadline-request-create');
      return reply.code(500).send({ error: 'Não foi possível registrar a solicitação agora.' });
    }
  });

  app.get('/admin/product-deadline-requests', { preHandler: admin }, async (request, reply) => {
    const storefront = String(request.query?.storefront || '').trim();
    const status = String(request.query?.status || '').trim();
    const search = String(request.query?.search || '').trim().slice(0, 120);
    if (storefront && !STOREFRONTS.includes(storefront)) return reply.code(400).send({ error: 'Site inválido.' });
    if (status && !STATUSES.includes(status)) {
      return reply.code(400).send({ error: 'Status inválido.' });
    }
    const page = Math.max(1, Math.min(10000, Number(request.query?.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(request.query?.page_size) || 25));
    const where = ['1=1']; const params = [];
    if (storefront) { where.push('storefront=?'); params.push(storefront); }
    if (status) { where.push('status=?'); params.push(status); }
    if (search) { where.push('(public_code LIKE ? OR sku_snapshot LIKE ? OR product_name_snapshot LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push(...Array(5).fill(`%${search}%`)); }
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM product_deadline_requests WHERE ${where.join(' AND ')}`, params);
    const [items] = await pool.query(`SELECT * FROM product_deadline_requests WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
    return { items, total: Number(count.total), page, page_size: pageSize };
  });

  app.patch('/admin/product-deadline-requests/:id', { preHandler: admin, bodyLimit: 8 * 1024 }, async (request, reply) => {
    let update;
    try { update = normalizeAdminUpdate(request.body); }
    catch (error) { return reply.code(error.statusCode || 400).send({ error: error.message }); }
    const [result] = await pool.query(`UPDATE product_deadline_requests SET status=?,negotiated_business_days=?,admin_notes=? WHERE id=?`,
      [update.status, update.negotiated_business_days, update.admin_notes, request.params.id]);
    if (!result.affectedRows) return reply.code(404).send({ error: 'Solicitação não encontrada.' });
    return { ok: true, id: request.params.id, ...update };
  });
}

module.exports = { ensureProductDeadlineRequestsTable, registerProductDeadlineRequestRoutes, eligibleProduct };
