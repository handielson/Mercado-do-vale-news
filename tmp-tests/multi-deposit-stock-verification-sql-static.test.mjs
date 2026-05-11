import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/verify_multi_deposit_stock.sql', 'utf8').toLowerCase();

for (const objectName of [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_movements',
  'stock_location_divergences',
]) {
  assert.match(sql, new RegExp(objectName), `verification SQL should check ${objectName}`);
}

for (const functionName of [
  'add_product_stock_location',
  'adjust_product_stock_location',
  'transfer_product_stock_location',
  'decrement_product_stock_by_priority',
  'reserve_product_stock_by_priority',
  'consume_order_stock_reservations',
  'release_order_stock_reservations',
  'restore_product_stock_from_sale_movements',
  'restore_product_stock_from_order_movements',
]) {
  assert.match(sql, new RegExp(functionName), `verification SQL should check ${functionName}`);
}

assert.match(sql, /raise exception 'missing table:/, 'verification SQL should fail loudly when a table is missing');
assert.match(sql, /default_deposit_count/, 'verification SQL should report default deposit coverage by company');
assert.match(sql, /default_location_count/, 'verification SQL should report default location coverage by company');
assert.match(sql, /divergent_products/, 'verification SQL should report divergence count');
assert.match(sql, /security_type/, 'verification SQL should expose function security mode');

console.log('multi-deposit stock verification SQL static checks passed');
