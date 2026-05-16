import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { __test__ } from '../api/_lib/shopee-stock-sync.js';

const grouped = __test__.groupRowsByItem(
  [
    { id: 'base-1', stock_quantity: 8 },
    { id: 'offer-1', stock_quantity: 2 },
    { id: 'separate-1', stock_quantity: 1.9 },
  ],
  [
    { product_id: 'base-1', shopee_item_id: 123, shopee_model_id: 9001 },
    { product_id: 'offer-1', shopee_item_id: 123, shopee_model_id: 9002 },
    { product_id: 'separate-1', shopee_item_id: 456, shopee_model_id: null },
  ],
);

assert.deepEqual(grouped.get(123), [
  { model_id: 9001, seller_stock: [{ stock: 8 }] },
  { model_id: 9002, seller_stock: [{ stock: 2 }] },
]);
assert.deepEqual(grouped.get(456), [
  { model_id: 0, seller_stock: [{ stock: 1 }] },
]);
assert.equal(__test__.safeStock(-4), 0);

const webhookSource = readFileSync(new URL('../api/bling-webhook.ts', import.meta.url), 'utf8');
assert.match(webhookSource, /syncShopeeStockFromBlingTargets/);
assert.match(webhookSource, /stockTargets/);

const vpsSource = readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
assert.match(vpsSource, /getShopeeStockTargetsForProductIds/);
assert.match(vpsSource, /pc\.child_product_id IN/);
assert.match(vpsSource, /stockTargets/);

console.log('bling shopee stock sync tests passed');
