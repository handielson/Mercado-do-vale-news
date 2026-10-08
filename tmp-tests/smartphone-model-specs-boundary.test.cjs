const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isModelProductRead, projectProductPayload, registerSmartphoneModelSpecsBoundary } = require('../services/smartphoneModelSpecsBoundary.cjs');
test('projects model specs for catalog, table data and PDV reads only', () => {
  for (const url of ['/products', '/products/by-ids', '/products/by-slug/phone', '/products/by-ean/789', '/products/p/combo', '/table-data/products', '/pdv/product-search', '/storefronts/mdv/products/p']) assert.equal(isModelProductRead({ method: 'GET', url }), true);
  for (const url of ['/products/category-counts', '/models', '/table-data/models', '/sales', '/pdv/receipt-share/token']) assert.equal(isModelProductRead({ method: 'GET', url }), false);
  assert.equal(isModelProductRead({ method: 'PATCH', url: '/products/p' }), false);
});
test('one batched lookup preserves nested shapes, dates and operational values', async () => {
  const date = new Date('2026-10-08');
  const payload = { rows: [{ id: 'p', sku: 'S', specs: { network: '5G' }, stock_quantity: 4, price_retail: 100, created_at: date, children: [{ id: 'c', sku: 'C', specs: {}, price_retail: 200 }] }], total: 2 };
  let calls = 0;
  const result = await projectProductPayload({}, payload, async (_, products) => { calls++; assert.equal(products.length, 2); return products.map(product => ({ ...product, specs: { network: '4G' } })); });
  assert.equal(calls, 1);
  assert.equal(result.rows[0].specs.network, '4G');
  assert.equal(result.rows[0].children[0].specs.network, '4G');
  assert.equal(result.rows[0].stock_quantity, 4);
  assert.equal(result.rows[0].created_at, date);
  assert.equal(result.total, 2);
  assert.equal(payload.rows[0].specs.network, '5G');
});
test('skips errors and unrelated payloads and fails closed on model lookup error', async () => {
  let hook, calls = 0;
  registerSmartphoneModelSpecsBoundary({ addHook: (_, handler) => { hook = handler; } }, { db: {}, applyProducts: async () => { calls++; throw Error('lookup failed'); } });
  const product = { id: 'p', sku: 'S', specs: {} };
  assert.equal(await hook({ method: 'GET', url: '/sales' }, { statusCode: 200 }, product), product);
  assert.equal(await hook({ method: 'GET', url: '/products' }, { statusCode: 500 }, product), product);
  assert.equal(calls, 0);
  await assert.rejects(hook({ method: 'GET', url: '/products' }, { statusCode: 200 }, [product]), /lookup failed/);
});
