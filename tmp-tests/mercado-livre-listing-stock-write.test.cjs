const test = require('node:test');
const assert = require('node:assert/strict');
const { createListingStockHandlers } = require('../services/mercadoLivreListingStock.cjs');
const { erpWriteKeyMatches, isErpWriteKeyConfigured, isErpStockWriteEnabled, registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');

const itemId = 'MLB4282518399';
const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sellerId = '416389239';
const userProductId = 'MLBU123456789';
const key = 'local-test-erp-write-key-at-least-32-chars';

function response(body, headers = {}) {
  return { json: async () => body, headers: { get: name => headers[name.toLowerCase()] || null } };
}

test('dedicated ERP key compares in constant time and rejects missing, short, different, or oversized secrets', () => {
  assert.equal(isErpWriteKeyConfigured(key), true);
  assert.equal(isErpWriteKeyConfigured('short'), false);
  assert.equal(isErpWriteKeyConfigured('x'.repeat(257)), false);
  assert.equal(erpWriteKeyMatches(key, key), true);
  assert.equal(erpWriteKeyMatches(`${key}x`, key), false);
  assert.equal(erpWriteKeyMatches(undefined, key), false);
  assert.equal(erpWriteKeyMatches(key, 'short'), false);
});

test('stock writes require both an explicit enable flag and a valid dedicated key', () => {
  const previousKey = process.env.MDV_ERP_WRITE_KEY;
  const previousFlag = process.env.MDV_ERP_STOCK_WRITE_ENABLED;
  try {
    process.env.MDV_ERP_WRITE_KEY = key;
    delete process.env.MDV_ERP_STOCK_WRITE_ENABLED;
    assert.equal(isErpStockWriteEnabled(), false);
    process.env.MDV_ERP_STOCK_WRITE_ENABLED = 'true';
    assert.equal(isErpStockWriteEnabled(), false);
    process.env.MDV_ERP_STOCK_WRITE_ENABLED = '1';
    assert.equal(isErpStockWriteEnabled(), true);
    process.env.MDV_ERP_WRITE_KEY = 'short';
    assert.equal(isErpStockWriteEnabled(), false);
  } finally {
    if (previousKey === undefined) delete process.env.MDV_ERP_WRITE_KEY;
    else process.env.MDV_ERP_WRITE_KEY = previousKey;
    if (previousFlag === undefined) delete process.env.MDV_ERP_STOCK_WRITE_ENABLED;
    else process.env.MDV_ERP_STOCK_WRITE_ENABLED = previousFlag;
  }
});

test('stock write routes reject the general sync key and require the dedicated ERP write key', async () => {
  const previous = process.env.MDV_ERP_WRITE_KEY;
  const previousFlag = process.env.MDV_ERP_STOCK_WRITE_ENABLED;
  process.env.MDV_ERP_WRITE_KEY = key;
  delete process.env.MDV_ERP_STOCK_WRITE_ENABLED;
  const app = require('fastify')();
  const pool = { query: async () => [[]] };
  const requireSyncKeyOrAdmin = async (_request, reply) => reply.code(401).send({ error: 'Unauthorized' });
  registerMercadoLivreRoutes(app, { pool, requireSyncKey: requireSyncKeyOrAdmin, requireSyncKeyOrAdmin });
  try {
    const payload = { quantity: 4, expectedQuantity: 3, confirm: false };
    const disabled = await app.inject({ method: 'POST', url: `/mercado-livre/products/items/${itemId}/stock?parentId=${parentId}`,
      headers: { 'x-erp-write-key': key }, payload });
    assert.equal(disabled.statusCode, 503);
    process.env.MDV_ERP_STOCK_WRITE_ENABLED = '1';
    const noKey = await app.inject({ method: 'POST', url: `/mercado-livre/products/items/${itemId}/stock?parentId=${parentId}`, payload });
    const generalKey = await app.inject({ method: 'POST', url: `/mercado-livre/products/items/${itemId}/stock?parentId=${parentId}`,
      headers: { 'x-sync-key': key }, payload });
    const dedicatedKey = await app.inject({ method: 'POST', url: `/mercado-livre/products/items/${itemId}/stock?parentId=${parentId}`,
      headers: { 'x-erp-write-key': key }, payload });
    assert.equal(noKey.statusCode, 401);
    assert.equal(generalKey.statusCode, 401);
    assert.equal(dedicatedKey.statusCode, 400);
    assert.match(dedicatedKey.json().error, /Confirme explicitamente/);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.MDV_ERP_WRITE_KEY;
    else process.env.MDV_ERP_WRITE_KEY = previous;
    if (previousFlag === undefined) delete process.env.MDV_ERP_STOCK_WRITE_ENABLED;
    else process.env.MDV_ERP_STOCK_WRITE_ENABLED = previousFlag;
  }
});

test('updates only all seller warehouse locations using the checked x-version and verifies Full is unchanged', async () => {
  const item = { id: itemId, seller_id: sellerId, user_product_id: userProductId,
    status: 'active', sub_status: [], tags: ['user_product_listing'], variations: [] };
  const before = { id: userProductId, user_id: sellerId, locations: [
    { type: 'seller_warehouse', store_id: '10', network_node_id: 'node-a', quantity: 4 },
    { type: 'meli_facility', store_id: 'full', network_node_id: 'full-node', quantity: 8 },
  ] };
  const after = { id: userProductId, user_id: sellerId, locations: [
    { type: 'seller_warehouse', store_id: '10', network_node_id: 'node-a', quantity: 5 },
    { type: 'meli_facility', store_id: 'full', network_node_id: 'full-node', quantity: 8 },
  ] };
  const calls = [];
  const pool = { query: async () => [[{ id: 'product-1', sku: 'LJH074', variation_id: '' }]] };
  let stockReads = 0;
  const request = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url === `/items/${itemId}?include_attributes=all`) return response(item);
    if (url === `/users/${sellerId}`) return response({ id: sellerId, tags: ['warehouse_management'] });
    if (url === `/user-products/${userProductId}/stock`) {
      stockReads += 1;
      return response(stockReads === 1 ? before : after, { 'x-version': stockReads === 1 ? '17' : '18' });
    }
    if (url === `/user-products/${userProductId}/stock/type/seller_warehouse`) return response({ ok: true });
    throw new Error(`Unexpected API path: ${url}`);
  };
  const handlers = createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request });
  const result = await handlers.updateWarehouse({
    params: { userProductId }, query: { itemId, parentId },
    body: { userProductId, expectedVersion: '17', confirm: true,
      expectedLocations: [{ store_id: '10', network_node_id: 'node-a', quantity: 4 }],
      locations: [{ store_id: '10', network_node_id: 'node-a', quantity: 5 }] },
  });

  const put = calls.find(call => call.method === 'PUT');
  assert.deepEqual(result, { ok: true, itemId, userProductId, stockVersion: '18',
    locations: [{ store_id: '10', network_node_id: 'node-a', quantity: 5 }],
    alreadyCurrent: false, reactivated: false });
  assert.equal(put.url, `/user-products/${userProductId}/stock/type/seller_warehouse`);
  assert.equal(put.headers['x-version'], '17');
  assert.deepEqual(JSON.parse(put.body), { locations: [
    { store_id: '10', network_node_id: 'node-a', quantity: 5 },
  ] });
  assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(stockReads, 2);
});

test('rejects stale location version before any stock write', async () => {
  const item = { id: itemId, seller_id: sellerId, user_product_id: userProductId,
    status: 'active', sub_status: [], tags: ['user_product_listing'], variations: [] };
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url === `/items/${itemId}?include_attributes=all`) return response(item);
    if (url === `/users/${sellerId}`) return response({ id: sellerId, tags: ['warehouse_management'] });
    if (url === `/user-products/${userProductId}/stock`) return response({ id: userProductId, user_id: sellerId,
      locations: [{ type: 'seller_warehouse', store_id: '10', network_node_id: 'node-a', quantity: 4 }] },
      { 'x-version': '18' });
    throw new Error(`Unexpected API path: ${url}`);
  };
  const handlers = createListingStockHandlers({
    pool: { query: async () => [[{ id: 'product-1', sku: 'LJH074', variation_id: '' }]] },
    settings: async () => ({ user_id: sellerId }), request,
  });
  await assert.rejects(handlers.updateWarehouse({ params: { userProductId }, query: { itemId, parentId },
    body: { expectedVersion: '17', confirm: true,
      expectedLocations: [{ store_id: '10', network_node_id: 'node-a', quantity: 4 }],
      locations: [{ store_id: '10', network_node_id: 'node-a', quantity: 5 }] },
  }), /versão do estoque remoto mudou/);
  assert.equal(calls.some(call => call.method === 'PUT'), false);
});

test('blocks price writes before making any Mercado Livre request', async () => {
  const { createListingPriceHandlers } = require('../services/mercadoLivreListingPrice.cjs');
  const calls = [];
  const handlers = createListingPriceHandlers({ pool: {}, settings: async () => ({}),
    request: async (...args) => { calls.push(args); throw new Error('Unexpected external request'); } });
  await assert.rejects(handlers.update({ body: { priceCents: 2000, expectedPriceCents: 1000 } }),
    error => error.statusCode === 409 && /endpoint oficial/.test(error.message));
  assert.deepEqual(calls, []);
});
