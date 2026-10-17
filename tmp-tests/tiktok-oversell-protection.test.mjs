import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  createTikTokOrderStockProtection,
  normalizeOrderLines,
  shouldProtectOrder,
  isCancelledOrder,
} = require('../services/tiktokOrderStockProtection.cjs');

assert.deepEqual(normalizeOrderLines({ line_items: [
  { seller_sku: ' tt370c ', quantity: 1 },
  { seller_sku: 'TT370C', quantity: 2 },
  { seller_sku: '', quantity: 4 },
] }), [{ sku: 'TT370C', quantity: 3 }]);
assert.deepEqual(normalizeOrderLines({ line_items: [
  { id: 'line-1', seller_sku: 'TT370C' },
  { id: 'line-2', seller_sku: 'TT370C', quantity: null },
] }), [{ sku: 'TT370C', quantity: 2 }], 'real TikTok line items without quantity count as one unit each');
assert.equal(shouldProtectOrder('AWAITING_SHIPMENT'), true);
assert.equal(shouldProtectOrder('AWAITING_COLLECTION'), true);
assert.equal(shouldProtectOrder('ON_HOLD'), true);
assert.equal(shouldProtectOrder('UNPAID'), false);
assert.equal(shouldProtectOrder('CANCELLED'), false);
assert.equal(shouldProtectOrder('COMPLETED'), false, 'historical terminal orders must not be decremented during polling');
assert.equal(isCancelledOrder('CANCELLED'), true);
assert.equal(isCancelledOrder('RETURNED'), false, 'returns must wait for physical Bling stock instead of adding stock early');

const events = new Map();
const db = {
  async query(sql, params = []) {
    if (sql.startsWith('SET TRANSACTION') || sql.startsWith('UPDATE tiktok_order_stock_events')) return [{ affectedRows: 1 }];
    if (sql.startsWith('INSERT IGNORE INTO tiktok_order_stock_events')) {
      const key = params[0];
      if (events.has(key)) return [{ affectedRows: 0 }];
      events.set(key, true);
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT id FROM products')) return [[{ id: 'product-1' }]];
    if (sql.includes('SUM(GREATEST')) return [[{ available: 1 }]];
    throw new Error(`Unexpected SQL: ${sql}`);
  },
  async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
};
const pool = {
  async query(sql) { if (sql.startsWith('CREATE TABLE')) return [{}]; throw new Error(`Unexpected pool SQL: ${sql}`); },
  async getConnection() { return db; },
};
let decrements = 0;
const protection = createTikTokOrderStockProtection({
  pool,
  decrementStock: async (_db, input) => {
    decrements++;
    assert.equal(input.product_id, 'product-1');
    assert.equal(input.quantity, 1);
    assert.equal(input.reference_type, 'tiktok_order');
    return { status: 200, decrements: [{}] };
  },
});
const order = { id: 'order-1', status: 'AWAITING_SHIPMENT', line_items: [{ seller_sku: 'TT370C' }] };
const first = await protection.protectOrder(order);
const duplicate = await protection.protectOrder(order);
assert.equal(first.productIds[0], 'product-1');
assert.equal(duplicate.results[0].duplicate, true);
assert.equal(decrements, 1, 'duplicate webhook/polling must not decrement twice');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /loadTikTokShopOrderForStockVps/);
  assert.match(source, /tiktokOrderStockProtectionVps\.protectOrder\(order\)/);
  assert.match(source, /tiktokOrderStockProtectionVps\.restoreOrder\(order\)/);
  assert.match(source, /tiktokOrderStockProtectionVps\.absorbProducts/);
  assert.match(source, /sort_field:\s*'update_time'/);
  assert.match(source, /update_time_ge/);
  assert.match(source, /setInterval\(\(\) => void pollTikTokStockProtection\(\), 60_000\)/);
  assert.match(source, /requested_quantity-tse\.applied_quantity/);
  assert.match(source, /targetByProductId\.get\(String\(local\.id\)\)/);
  assert.match(source, /WHERE p\.parent_id IN/);
}

console.log('TikTok oversell protection checks passed.');
