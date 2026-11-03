const test = require('node:test');
const assert = require('node:assert/strict');
const { registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');

const readKey = 'erp-payment-details-read-only-test-key'.padEnd(40, 'r');
const settings = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_expires_at: '2099-01-01T00:00:00.000Z',
  user_id: '7',
  nickname: 'Conta de teste',
};

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function appFor(pool) {
  const app = require('fastify')();
  const requireSyncKeyOrAdmin = async (_request, reply) => reply.code(401).send({ error: 'Unauthorized' });
  registerMercadoLivreRoutes(app, { pool, requireSyncKeyOrAdmin });
  return app;
}

test('consulta de pagamentos é somente GET, autenticada e retorna campos allowlisted', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  const requests = [];
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  const pool = { query: async () => [[settings]] };
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    const parsed = new URL(url);
    if (parsed.pathname === '/orders/123') {
      return response({ id: 123, seller: { id: 7 }, currency_id: 'BRL', payments: [{ id: 789 }] });
    }
    if (parsed.pathname === '/v1/payments/789') {
      return response({
        id: 789,
        collector_id: 7,
        order: { id: 123 },
        status: 'approved',
        status_detail: 'accredited',
        currency_id: 'BRL',
        payment_method_id: 'pix',
        payment_type_id: 'bank_transfer',
        transaction_amount: 25.99,
        transaction_details: { total_paid_amount: 25.99, net_received_amount: 23.5 },
        transaction_amount_refunded: 0,
        coupon_amount: 0,
        taxes_amount: 0,
        shipping_amount: 0,
        marketplace_fee: 2.49,
        money_release_date: '2026-11-01T12:00:00.000-03:00',
        date_approved: '2026-10-31T12:00:00.000-03:00',
        date_last_updated: '2026-10-31T12:01:00.000-03:00',
        fee_details: [{ type: 'application_fee', fee_payer: 'collector', amount: 2.49 }],
        payer: { email: 'private@example.test', identification: { number: '12345678900' } },
        card: { last_four_digits: '1234' },
      });
    }
    throw new Error(`unexpected external request ${parsed.pathname}`);
  };
  const app = appFor(pool);
  try {
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/123/payments' });
    assert.equal(unauthenticated.statusCode, 401);

    const settingsResponse = await app.inject({ method: 'GET', url: '/api/mercado-livre/settings',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(settingsResponse.statusCode, 200);
    assert.equal(settingsResponse.json().paymentDetailsReadAvailable, true);

    const result = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/123/payments',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.json(), {
      read_only: true,
      source: 'mercado_pago_payment_details',
      order_id: '123',
      seller_id: '7',
      payments: [{
        payment_id: '789', status: 'approved', currency: 'BRL', status_detail: 'accredited',
        payment_method_id: 'pix', payment_type_id: 'bank_transfer', transaction_amount: '25.99',
        total_paid_amount: '25.99', transaction_amount_refunded: '0', coupon_amount: '0',
        taxes_amount: '0', shipping_amount: '0', marketplace_fee: '2.49',
        net_received_amount: '23.5', overpaid_amount: null,
        money_release_date: '2026-11-01T12:00:00.000-03:00',
        date_approved: '2026-10-31T12:00:00.000-03:00',
        date_last_updated: '2026-10-31T12:01:00.000-03:00',
        fee_details: [{ type: 'application_fee', fee_payer: 'collector', amount: '2.49' }],
      }],
    });
    assert.equal(JSON.stringify(result.json()).includes('private@example.test'), false);
    assert.equal(JSON.stringify(result.json()).includes('12345678900'), false);
    assert.equal(JSON.stringify(result.json()).includes('1234'), false);
    assert.deepEqual(requests.map(request => new URL(request.url).pathname),
      ['/orders/123', '/v1/payments/789']);
    assert.deepEqual(requests.map(request => new URL(request.url).origin),
      ['https://api.mercadolibre.com', 'https://api.mercadopago.com']);
    assert(requests.every(request => request.method === 'GET'));
  } finally {
    await app.close();
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('não consulta pagamentos quando o pedido não pertence ao vendedor conectado', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  const paths = [];
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  const app = appFor({ query: async () => [[settings]] });
  global.fetch = async url => {
    const path = new URL(url).pathname;
    paths.push(path);
    return response({ id: 123, seller: { id: 8 }, currency_id: 'BRL', payments: [{ id: 789 }] });
  };
  try {
    const result = await app.inject({ method: 'GET', url: '/mercado-livre/erp/orders/123/payments',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 404);
    assert.deepEqual(paths, ['/orders/123']);
  } finally {
    await app.close();
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('pedido sem pagamentos retorna lista vazia e falha de permissão não expõe resposta remota', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  const queries = [];
  const pool = { query: async (...args) => { queries.push(args); return [[settings]]; } };
  const app = appFor(pool);
  global.fetch = async url => {
    const path = new URL(url).pathname;
    if (path === '/orders/123') return response({ id: 123, seller: { id: 7 }, currency_id: 'BRL' });
    if (path === '/orders/124') return response({ id: 124, seller: { id: 7 }, currency_id: 'BRL', payments: [{ id: 790 }] });
    if (path === '/v1/payments/790') return response({ message: 'private token detail' }, 403);
    throw new Error(`unexpected external request ${path}`);
  };
  try {
    const empty = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/123/payments',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json().payments, []);
    assert.equal(queries.some(([sql]) => /^(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)), false);

    const denied = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/124/payments',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(denied.statusCode, 409);
    assert.equal(denied.json().error, 'A conexão OAuth atual não permite consultar os pagamentos.');
    assert.equal(denied.body.includes('private token detail'), false);
  } finally {
    await app.close();
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});
