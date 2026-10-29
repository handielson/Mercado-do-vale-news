const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createListingStockHandlers } = require('../services/mercadoLivreListingStock.cjs');

const itemId = 'MLB4282518399';
const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sellerId = '416389239';

function response(body, headers = {}) {
  return { json: async () => body, headers: { get: name => headers[name.toLowerCase()] || null } };
}

function harness({ linked = [{ id: 'product-1', sku: 'LJH074', variation_id: '' }], item, user,
  userProductStock, stockHeaders = {} }) {
  const calls = [];
  const dbQueries = [];
  const pool = { query: async (sql, values) => {
    dbQueries.push({ sql, values });
    return [linked];
  } };
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.startsWith(`/items/${itemId}?`)) return response(item);
    if (url === `/users/${sellerId}`) return response(user);
    if (url === `/user-products/${item.user_product_id}/stock`) return response(userProductStock, stockHeaders);
    throw new Error(`Unexpected Mercado Livre API path: ${url}`);
  };
  return {
    calls,
    dbQueries,
    read: createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request }).read,
  };
}

test('reads traditional listing quantity through GET only', async () => {
  const h = harness({
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      available_quantity: 0, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.equal(result.mode, 'item_available_quantity');
  assert.equal(result.quantityByVariation, true);
  assert.deepEqual(result.quantities, [{ variationId: '', sku: 'LJH074', quantity: 0 }]);
  assert.equal(h.dbQueries.length, 1);
  assert.match(h.dbQueries[0].sql, /^\s*SELECT/i);
  assert.ok(h.calls.length >= 2);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('maps variation quantities to the exact locally linked SKUs', async () => {
  const h = harness({
    linked: [
      { id: 'product-1', sku: 'PHONE-BLK', variation_id: '11' },
      { id: 'product-2', sku: 'PHONE-WHT', variation_id: '12' },
    ],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      variations: [{ id: 11, available_quantity: 3 }, { id: 12, available_quantity: 2 }] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.deepEqual(result.quantities, [
    { variationId: '11', sku: 'PHONE-BLK', quantity: 3 },
    { variationId: '12', sku: 'PHONE-WHT', quantity: 2 },
  ]);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('reads seller warehouse and Full locations without assigning them to a product SKU', async () => {
  const h = harness({
    linked: [{ id: 'product-1', sku: 'LJH074', variation_id: '77' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      user_product_id: 'MLBU123', variations: [{ id: 77 }] },
    user: { id: sellerId, tags: ['warehouse_management'] },
    userProductStock: { id: 'MLBU123', user_id: sellerId, locations: [
      { type: 'seller_warehouse', store_id: '10', network_node_id: 'node-a', quantity: 3 },
      { type: 'meli_facility', store_id: 'full', network_node_id: 'node-b', quantity: 8 },
    ] },
    stockHeaders: { 'x-version': '17' },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.equal(result.mode, 'warehouse_management');
  assert.equal(result.quantityByVariation, false);
  assert.equal(result.stockVersion, '17');
  assert.deepEqual(result.locations.map(row => [row.type, row.quantity]), [
    ['seller_warehouse', 3], ['meli_facility', 8],
  ]);
  assert.ok(result.reason.includes('não atribua esses valores a um SKU'));
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('rejects a listing owned by another Mercado Livre seller', async () => {
  const h = harness({
    item: { id: itemId, seller_id: '999', status: 'active', sub_status: [], tags: [],
      available_quantity: 1, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  await assert.rejects(h.read({ params: { itemId }, query: { parentId } }), /não pertence à conta/);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('registers only read-key GET for listing stock; no ERP stock write route is exposed', () => {
  const server = fs.readFileSync(path.join(__dirname, '../services/mercadoLivreServer.cjs'), 'utf8');
  assert.match(server, /registerAliases\(fastify, 'get', '\/mercado-livre\/products\/items\/:itemId\/stock', erpReadRoute, presentListingError\(listingStock\.read\)\)/);
  assert.doesNotMatch(server, /registerAliases\(fastify, 'post', '\/mercado-livre\/products\/items\/:itemId\/stock'/);
});
