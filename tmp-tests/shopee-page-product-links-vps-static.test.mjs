import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const service = readFileSync('services/shopeeProducts.ts', 'utf8');

assert.match(
  page,
  /shopeeProductService/,
  'Shopee admin page should use the VPS Shopee product link service',
);

assert.doesNotMatch(
  page,
  /from\('shopee_products'\)/,
  'Shopee admin page must not read or write shopee_products through Supabase',
);

for (const method of [
  'upsert',
  'updateByProductId',
  'deleteByShopeeItemId',
  'getItemIdByProductIdMap',
]) {
  assert.match(
    service,
    new RegExp(`(?:async function ${method}\\(|${method}\\s*[:=])`),
    `Shopee product link service should expose ${method}`,
  );
}

assert.match(
  service,
  /\/table-data\/shopee_products\/\$\{encodeURIComponent\(productId\)\}\?pk=product_id/,
  'Shopee product link service should update product links by product_id on the VPS',
);

console.log('Shopee page product link VPS static checks passed');
