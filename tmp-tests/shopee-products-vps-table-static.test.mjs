import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS shopee_products/,
    `${file} must create shopee_products so Shopee products and bulk tabs can load product links through table-data`,
  );

  for (const column of [
    'product_id',
    'shopee_item_id',
    'shopee_category_id',
    'shopee_category_name',
    'shopee_price',
    'shopee_model_id',
    'shopee_model_sku',
    'shopee_model_name',
    'shopee_tier_index',
    'status',
    'last_synced_at',
  ]) {
    assert.match(source, new RegExp(`${column}\\s+`), `${file} shopee_products migration must include ${column}`);
  }

  assert.match(source, /UNIQUE KEY idx_shopee_products_product/, `${file} must keep one Shopee link row per local product`);
  assert.match(source, /idx_shopee_products_item/, `${file} must index Shopee item lookups`);
  assert.match(source, /idx_shopee_products_item_model/, `${file} must index Shopee item\/model variation lookups`);
  assert.match(source, /idx_shopee_products_status/, `${file} must index product link status filters`);
}

console.log('shopee products VPS table static checks passed');
