const test = require('node:test');
const assert = require('node:assert/strict');
const { registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');

const readKey = 'erp-order-billing-details-test-read-key'.padEnd(40, 'b');
const settings = { access_token: 'test-access-token', refresh_token: 'test-refresh-token',
  token_expires_at: '2099-01-01T00:00:00.000Z', user_id: '7', nickname: 'Conta de teste' };
function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status,
    json: async () => payload, text: async () => JSON.stringify(payload) };
}
function appFor(pool) {
  const app = require('fastify')();
  registerMercadoLivreRoutes(app, { pool,
    requireSyncKeyOrAdmin: async (_request, reply) => reply.code(401).send({ error: 'Unauthorized' }) });
  return app;
}

test('faturamento do pedido é GET autenticado, confere vendedor e expõe somente campos financeiros allowlisted', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  const requests = [];
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url); requests.push({ url: parsed, method: options.method || 'GET' });
    if (parsed.pathname === '/orders/123') return response({ id: 123, seller: { id: 7 }, payments: [] });
    if (parsed.pathname === '/billing/integration/group/ML/order/details') return response({
      results: [{ order_id: 123, payer_nickname: 'PRIVATE BUYER',
        payment_info: [{ payment_id: 'abc_123', status: 'approved', payment_method_id: 'master',
          transaction_amount: 150, date_approved: '2026-11-02T21:27:23.000-04:00',
          money_release_date: '2026-11-30T21:27:23.000-04:00', payer_id: 999 }],
        sale_fee: { gross: 40, net: 35, rebate: 2, discount: 3, discount_reason: 'campanha', private: 'x' },
        details: [{ charge_info: { detail_id: 321, detail_description: 'Cargo por venda',
          detail_date: '2026-11-02T00:00:00', detail_amount: 35, detail_type: 'CHARGE', detail_sub_type: 'CV',
          legal_document_number: 'PRIVATE-DOC' } }, { discount_info: { private: true } }],
      }],
    });
    throw new Error(`unexpected external request ${parsed.pathname}`);
  };
  const app = appFor({ query: async () => [[settings]] });
  try {
    const capabilities = await app.inject({ method: 'GET', url: '/api/mercado-livre/settings',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(capabilities.statusCode, 200);
    assert.equal(capabilities.json().billingDetailsReadAvailable, true);
    assert.deepEqual(capabilities.json().erpWriteGates, { stock: false, price: false, publish: false });
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/123/billing-details' });
    assert.equal(unauthenticated.statusCode, 401);
    const result = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/123/billing-details',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.json(), { read_only: true, source: 'mercado_livre_order_billing_details',
      order_id: '123', seller_id: '7', available: true,
      payment_info: [{ payment_id: 'abc_123', status: 'approved', payment_method_id: 'master',
        transaction_amount: '150', date_approved: '2026-11-02T21:27:23.000-04:00',
        money_release_date: '2026-11-30T21:27:23.000-04:00' }],
      sale_fee: { gross: '40', net: '35', rebate: '2', discount: '3', discount_reason: 'campanha' },
      charges: [{ detail_id: '321', description: 'Cargo por venda', date: '2026-11-02T00:00:00',
        amount: '35', type: 'CHARGE', sub_type: 'CV' }] });
    assert.equal(JSON.stringify(result.json()).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(result.json()).includes('999'), false);
    assert.deepEqual(requests.map(row => row.url.pathname), [
      '/orders/123', '/billing/integration/group/ML/order/details']);
    assert.equal(requests[1].url.searchParams.get('order_ids'), '123');
    assert.equal(requests[1].url.searchParams.get('seller_id'), '7');
    assert(requests.every(row => row.method === 'GET'));
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('lê faturamento de pedidos em lote, limita 60 IDs e conserva somente dados allowlisted', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url); requests.push({ url: parsed, method: options.method || 'GET' });
    if (parsed.pathname === '/billing/integration/group/ML/order/details') return response({ results: [
      { order_id: '123', payer_nickname: 'PRIVATE BUYER', payment_info: [
        { payment_id: 'pay_123', status: 'approved', transaction_amount: 150, payer_id: 999 }],
        sale_fee: { gross: 40, net: 35 }, details: [] },
    ] });
    throw new Error(`unexpected external request ${parsed.pathname}`);
  };
  const app = appFor({ query: async () => [[settings]] });
  try {
    const result = await app.inject({ method: 'GET',
      url: '/api/mercado-livre/erp/orders/billing-details?order_ids=123,124',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 200);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.searchParams.get('order_ids'), '123,124');
    assert.equal(requests[0].url.searchParams.get('seller_id'), '7');
    assert.equal(requests[0].method, 'GET');
    assert.deepEqual(result.json().items.map(item => [item.order_id, item.available]), [['123', true], ['124', false]]);
    assert.equal(JSON.stringify(result.json()).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(result.json()).includes('999'), false);
    const tooMany = Array.from({ length: 61 }, (_, index) => String(index + 1)).join(',');
    const rejected = await app.inject({ method: 'GET',
      url: `/api/mercado-livre/erp/orders/billing-details?order_ids=${tooMany}`,
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(rejected.statusCode, 400);
    assert.equal(requests.length, 1);
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('não trata resposta parcial do Mercado Livre como lote completo', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  global.fetch = async url => {
    const parsed = new URL(url);
    if (parsed.pathname === '/billing/integration/group/ML/order/details') {
      return response({ results: [{ order_id: '127' }] }, 206);
    }
    throw new Error(`unexpected external request ${parsed.pathname}`);
  };
  const app = appFor({ query: async () => [[settings]] });
  try {
    const result = await app.inject({ method: 'GET',
      url: '/mercado-livre/erp/orders/billing-details?order_ids=127',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 503);
    assert.deepEqual(result.json(), { error: 'O Mercado Livre retornou faturamento parcial; aguarde antes de consultar novamente.',
      diagnostic: { upstreamStatus: 206 } });
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('não consulta faturamento se o pedido não é do vendedor e representa faturamento ausente sem inventar tarifa zero', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  const paths = [];
  global.fetch = async url => {
    const path = new URL(url).pathname; paths.push(path);
    if (path === '/orders/124') return response({ id: 124, seller: { id: 8 } });
    if (path === '/orders/125') return response({ id: 125, seller: { id: 7 } });
    if (path === '/billing/integration/group/ML/order/details') return response({ results: [] });
    throw new Error(`unexpected request ${path}`);
  };
  const app = appFor({ query: async () => [[settings]] });
  try {
    const mismatch = await app.inject({ method: 'GET', url: '/mercado-livre/erp/orders/124/billing-details',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(mismatch.statusCode, 404);
    assert.deepEqual(paths, ['/orders/124']);
    const missing = await app.inject({ method: 'GET', url: '/mercado-livre/erp/orders/125/billing-details',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(missing.statusCode, 200);
    assert.equal(missing.json().available, false);
    assert.equal(missing.json().sale_fee, null);
    assert.deepEqual(missing.json().charges, []);
    assert.deepEqual(paths, ['/orders/124', '/orders/125', '/billing/integration/group/ML/order/details']);
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('erros upstream expõem somente código técnico allowlisted', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  global.fetch = async url => {
    const path = new URL(url).pathname;
    if (path === '/orders/126') return response({ id: 126, seller: { id: 7 } });
    if (path === '/billing/integration/group/ML/order/details') {
      return response({ error: 'upstream_timeout', private: 'never expose this' }, 502);
    }
    throw new Error(`unexpected request ${path}`);
  };
  const app = appFor({ query: async () => [[settings]] });
  try {
    const result = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders/126/billing-details',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 502);
    assert.deepEqual(result.json(), { error: 'Consulta do faturamento do pedido Mercado Livre indisponível.',
      diagnostic: { upstreamStatus: 502, upstreamCode: 'upstream_timeout' } });
    assert.equal(result.body.includes('never expose this'), false);
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('falha de transporte no faturamento expõe classe técnica fixa, sem mensagem externa', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  global.fetch = async () => { throw new TypeError('fetch failed: private host and token'); };
  const app = appFor({ query: async () => [[settings]] });
  try {
    const result = await app.inject({ method: 'GET',
      url: '/api/mercado-livre/erp/orders/billing-details?order_ids=128',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 502);
    assert.deepEqual(result.json(), { error: 'Consulta do faturamento dos pedidos Mercado Livre indisponível.',
      diagnostic: { failureClass: 'transport_error' } });
    assert.equal(result.body.includes('private host'), false);
    assert.equal(result.body.includes('token'), false);
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});

test('resposta de faturamento em formato inválido é classificada sem ecoar valores', async () => {
  const oldKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const oldFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = readKey;
  global.fetch = async () => response({ results: 'private malformed payload' });
  const app = appFor({ query: async () => [[settings]] });
  try {
    const result = await app.inject({ method: 'GET',
      url: '/api/mercado-livre/erp/orders/billing-details?order_ids=129',
      headers: { 'x-erp-read-key': readKey } });
    assert.equal(result.statusCode, 502);
    assert.deepEqual(result.json(), { error: 'Consulta do faturamento dos pedidos Mercado Livre indisponível.',
      diagnostic: { failureClass: 'invalid_response' } });
    assert.equal(result.body.includes('private malformed payload'), false);
  } finally {
    await app.close(); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = oldKey;
  }
});
