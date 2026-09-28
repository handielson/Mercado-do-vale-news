'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerProductDeadlineRequestRoutes } = require('../services/productDeadlineRequestsServer.cjs');

const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

function fixture({ configured = false } = {}) {
  const rows = [];
  const product = {
    id: PRODUCT_ID, sku: '3D-TESTE', name: 'Peça de teste', status: 'active', is_parent: 0,
    is_print3d: 1, print3d_preorder_enabled: 1, production_days: null, print3d_preorder_limit: null,
    hide_from_catalog: 0, price_retail: 2500, publication_status: 'published', offer_price: 2500,
    offer_title: 'Peça publicada',
  };
  const pool = { async query(sql, params = []) {
    if (sql.includes('FROM products p LEFT JOIN')) return [[product]];
    if (sql.startsWith('INSERT INTO product_deadline_requests')) {
      rows.push({
        id: params[0], public_code: params[1], storefront: params[2], product_id: params[3],
        sku_snapshot: params[4], product_name_snapshot: params[5], quantity_requested: params[6],
        lead_time_label_snapshot: params[7], customer_name: params[8], customer_phone: params[9],
        customer_email: params[10], customer_message: params[11], status: 'new',
        negotiated_business_days: null, admin_notes: null, whatsapp_notification_status: 'pending',
        created_at: new Date().toISOString(),
      });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE product_deadline_requests SET whatsapp_notification_status')) {
      const row = rows.find(item => item.id === params[2]);
      row.whatsapp_notification_status = params[0];
      row.whatsapp_notification_error = params[1];
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: rows.length }]];
    if (sql.startsWith('SELECT * FROM product_deadline_requests')) return [rows];
    if (sql.startsWith('UPDATE product_deadline_requests SET status=')) {
      const row = rows.find(item => item.id === params[3]);
      if (!row) return [{ affectedRows: 0 }];
      Object.assign(row, { status: params[0], negotiated_business_days: params[1], admin_notes: params[2] });
      return [{ affectedRows: 1 }];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  const app = Fastify({ logger: false });
  registerProductDeadlineRequestRoutes(app, {
    pool,
    getBearerAuthContext: async request => request.headers.authorization === 'Bearer admin'
      ? { isAdmin: true, userId: 'admin-1' } : null,
    notifyAdmins: async request => configured
      ? { status: 'sent', message: request.message }
      : { status: 'unconfigured', error: 'Número 3D pendente.' },
  });
  return { app, rows };
}

test('cliente registra quantidade e prazo sob consulta mesmo sem WhatsApp 3D configurado', async t => {
  const { app, rows } = fixture();
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST', url: '/storefronts/loja_3d/deadline-requests',
    payload: { product_id: PRODUCT_ID, quantity: 100, customer_name: 'Cliente Teste', customer_phone: '(87) 99999-9999' },
  });
  assert.equal(response.statusCode, 201);
  assert.match(response.json().public_code, /^PRZ-[A-F0-9]{8}$/);
  assert.equal(response.json().lead_time_label, 'Prazo sob consulta');
  assert.equal(response.json().notification_status, 'unconfigured');
  assert.equal(rows[0].quantity_requested, 100);
  assert.equal(rows[0].customer_phone, '5587999999999');
  assert.equal(rows[0].whatsapp_notification_status, 'unconfigured');
});

test('painel exige administrador e permite registrar a negociação', async t => {
  const { app, rows } = fixture({ configured: true });
  t.after(() => app.close());
  const created = await app.inject({ method: 'POST', url: '/storefronts/loja_3d/deadline-requests', payload: {
    product_id: PRODUCT_ID, quantity: 40, customer_name: 'Cliente Teste', customer_phone: '5587999999999',
  } });
  const id = created.json().id;
  assert.equal((await app.inject('/admin/product-deadline-requests?storefront=loja_3d')).statusCode, 401);
  const headers = { authorization: 'Bearer admin' };
  const listed = await app.inject({ url: '/admin/product-deadline-requests?storefront=loja_3d', headers });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().items[0].quantity_requested, 40);
  const updated = await app.inject({ method: 'PATCH', url: `/admin/product-deadline-requests/${id}`, headers,
    payload: { status: 'negotiating', negotiated_business_days: 18, admin_notes: 'Confirmar acabamento' } });
  assert.equal(updated.statusCode, 200);
  assert.equal(rows[0].status, 'negotiating');
  assert.equal(rows[0].negotiated_business_days, 18);
});

test('filtros administrativos rejeitam site e status desconhecidos', async t => {
  const { app } = fixture();
  t.after(() => app.close());
  const headers = { authorization: 'Bearer admin' };
  assert.equal((await app.inject({ url: '/admin/product-deadline-requests?storefront=outra', headers })).statusCode, 400);
  assert.equal((await app.inject({ url: '/admin/product-deadline-requests?status=qualquer', headers })).statusCode, 400);
});
