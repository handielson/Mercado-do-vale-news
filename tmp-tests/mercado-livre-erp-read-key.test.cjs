const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesMercadoLivreErpReadKey, mercadoLivreOrderToErpReview, validErpOrderDate,
  registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');

const key = 'erp-read-only-test-key-'.padEnd(40, 'r');

test('a chave de leitura exige de 32 a 256 bytes e comparação segura', () => {
  assert.equal(matchesMercadoLivreErpReadKey(key, key), true);
  assert.equal(matchesMercadoLivreErpReadKey(key, 'different-read-key-'.padEnd(40, 'x')), false);
  assert.equal(matchesMercadoLivreErpReadKey(key, 'short'), false);
  assert.equal(matchesMercadoLivreErpReadKey('x'.repeat(257), 'x'.repeat(257)), false);
  assert.equal(matchesMercadoLivreErpReadKey(undefined, key), false);
});

test('a projeção de pedido mantém dados comerciais e remove dados pessoais', () => {
  const result = mercadoLivreOrderToErpReview({
    id: 123, pack_id: 456, status: 'paid', currency_id: 'BRL', total_amount: 25.99,
    date_created: '2026-10-27T12:30:00.000-03:00', buyer: { nickname: 'private-buyer' },
    shipping: { receiver_address: { street_name: 'private-address' } },
    payments: [{ id: 789, status: 'approved', currency_id: 'BRL', transaction_amount: 25.99,
      total_paid_amount: 25.99, transaction_amount_refunded: 0, marketplace_fee: 3.12,
      shipping_cost: 4.5, taxes_amount: 0, payer_id: 111, card_id: 222,
      authorization_code: 'private-payment-code' }],
    order_items: [{ quantity: 1, unit_price: 25.99, item: { id: 'MLB123456', variation_id: 7,
      title: 'Caneca azul', seller_sku: 'CAN-AZUL' } }],
  });
  assert.deepEqual(result.items[0], { item_id: 'MLB123456', variation_id: '7', title: 'Caneca azul',
    seller_sku: 'CAN-AZUL', quantity: 1, unit_price_cents: 2599 });
  assert.equal(result.total_cents, 2599);
  assert.equal(result.payments[0].marketplace_fee_cents, 312);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('payer_id'), false);
  assert.equal(JSON.stringify(result).includes('card_id'), false);
});

test('a rota read-only de pedidos aplica autenticação, filtros e não registra POST', async () => {
  const previousKey = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const previousFetch = global.fetch;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = key;
  const networkCalls = [];
  const poolQueries = [];
  const pool = { query: async sql => {
    poolQueries.push(String(sql));
    return [[{ access_token: 'test-access', refresh_token: 'test-refresh', user_id: '7',
      nickname: 'Conta de teste', token_expires_at: '2099-01-01T00:00:00.000Z' }]];
  } };
  global.fetch = async (url, options = {}) => {
    networkCalls.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => ({ paging: { total: 1 }, results: [{
      id: 123, pack_id: 456, status: 'paid', currency_id: 'BRL', total_amount: 25.99,
      date_created: '2026-10-27T12:30:00.000-03:00', buyer: { nickname: 'private-buyer' },
      payments: [{ id: 789, status: 'approved', currency_id: 'BRL', transaction_amount: 25.99,
        total_paid_amount: 25.99, transaction_amount_refunded: 0, marketplace_fee: 3.12,
        shipping_cost: 4.5, taxes_amount: 0, payer_id: 111 }],
      order_items: [{ quantity: 1, unit_price: 25.99, item: { id: 'MLB123456', variation_id: 7,
        title: 'Caneca azul', seller_sku: 'CAN-AZUL' } }],
    }] }) };
  };
  const app = require('fastify')();
  const requireSyncKeyOrAdmin = async (_request, reply) => reply.code(401).send({ error: 'Unauthorized' });
  registerMercadoLivreRoutes(app, { pool, requireSyncKeyOrAdmin });

  try {
    const invalid = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders?start_date=2026-02-30&end_date=2026-03-01',
      headers: { 'x-erp-read-key': key } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(networkCalls.length, 0);

    const response = await app.inject({ method: 'GET',
      url: '/api/mercado-livre/erp/orders?limit=50&offset=0&start_date=2026-10-27&end_date=2026-10-27&date_field=updated',
      headers: { 'x-erp-read-key': key } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.json().total, 1);
    assert.equal(response.json().items[0].items[0].seller_sku, 'CAN-AZUL');
    assert.equal(response.body.includes('private-buyer'), false);
    assert.equal(response.body.includes('payer_id'), false);
    assert.equal(networkCalls.length, 1);
    assert.equal(networkCalls[0].options.method, undefined);
    assert.equal(networkCalls[0].options.headers.authorization, 'Bearer test-access');
    const requested = new URL(networkCalls[0].url);
    assert.equal(requested.pathname, '/orders/search');
    assert.equal(requested.searchParams.get('seller'), '7');
    assert.equal(requested.searchParams.get('sort'), 'date_desc');
    assert.equal(requested.searchParams.get('order.date_last_updated.from'), '2026-10-27T00:00:00.000-03:00');
    assert.equal(requested.searchParams.get('order.date_last_updated.to'), '2026-10-27T23:59:59.999-03:00');
    assert(poolQueries.every(sql => /^SELECT\b/i.test(sql.trim())));

    const writeAttempt = await app.inject({ method: 'POST', url: '/api/mercado-livre/erp/orders',
      headers: { 'x-erp-read-key': key }, payload: {} });
    assert.equal(writeAttempt.statusCode, 404);
    assert.equal(networkCalls.length, 1);
    assert.equal(validErpOrderDate('2026-10-27'), '2026-10-27T00:00:00.000-03:00');
    assert.equal(validErpOrderDate('2026-02-30'), null);

    const invalidDateField = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders?date_field=closed',
      headers: { 'x-erp-read-key': key } });
    assert.equal(invalidDateField.statusCode, 400);
    const invalidWindow = await app.inject({ method: 'GET', url: '/api/mercado-livre/erp/orders?limit=50&offset=9951',
      headers: { 'x-erp-read-key': key } });
    assert.equal(invalidWindow.statusCode, 400);
  } finally {
    await app.close();
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = previousKey;
  }
});

test('a chave ERP autoriza consultas GET selecionadas e não revela configuração OAuth', async () => {
  const previous = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = key;
  const app = require('fastify')();
  const pool = { query: async () => [[{
    access_token: 'private-access-token', refresh_token: 'private-refresh-token',
    client_id: 'private-client-id', client_secret: 'private-client-secret',
    user_id: '7', nickname: 'Conta de teste',
  }]] };
  const requireSyncKeyOrAdmin = async (_request, reply) => reply.code(401).send({ error: 'Unauthorized' });
  registerMercadoLivreRoutes(app, { pool, requireSyncKeyOrAdmin });

  try {
    for (const path of ['/mercado-livre/settings', '/api/mercado-livre/settings']) {
      const response = await app.inject({ method: 'GET', url: path, headers: { 'x-erp-read-key': key } });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { connected: true, userId: '7', nickname: 'Conta de teste' });
      assert(!response.body.includes('private-'));
    }

    for (const [path, method] of [
      ['/mercado-livre/settings', 'PATCH'],
      ['/api/mercado-livre/settings', 'PATCH'],
      ['/mercado-livre/products/items/MLB123/price', 'POST'],
      ['/api/mercado-livre/products/items/MLB123/price', 'POST'],
    ]) {
      assert.equal((await app.inject({ method, url: path, headers: { 'x-erp-read-key': key }, payload: { stockSyncEnabled: true } })).statusCode, 401);
    }

    for (const path of [
      '/mercado-livre/products/candidates', '/api/mercado-livre/products/candidates',
      '/mercado-livre/products/links', '/api/mercado-livre/oauth/auth',
    ]) {
      assert.equal((await app.inject({ method: 'GET', url: path, headers: { 'x-erp-read-key': key } })).statusCode, 401);
    }

    for (const path of [
      '/mercado-livre/products/discover', '/api/mercado-livre/products/discover',
      '/mercado-livre/products/items/MLB123/price', '/api/mercado-livre/products/items/MLB123/price',
      '/mercado-livre/preparation/categories/MLB123', '/api/mercado-livre/preparation/categories/MLB123',
    ]) {
      const response = await app.inject({ method: 'GET', url: path, headers: { 'x-erp-read-key': key } });
      assert.notEqual(response.statusCode, 401, `${path} must pass the dedicated GET allowlist`);
    }
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = previous;
  }
});
