import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');
const statusStart = source.indexOf('const handleToggleStatus');
const statusEnd = source.indexOf('const handleSyncStock', statusStart);
const stockEnd = source.indexOf('const handleOpenStockLocationModal', statusEnd);
const shopeeStart = source.indexOf('const clearStaleShopeeLink');
const shopeeEnd = source.indexOf('const openShopeeSyncModal', shopeeStart);
const statusHandler = source.slice(statusStart, statusEnd);
const stockHandler = source.slice(statusEnd, stockEnd);
const shopeeHandler = source.slice(shopeeStart, shopeeEnd);

assert.ok(statusStart > -1, 'ProductCard should have handleToggleStatus');
assert.ok(statusEnd > -1, 'ProductCard should have handleSyncStock');
assert.ok(shopeeStart > -1 && shopeeEnd > shopeeStart, 'ProductCard should have clearStaleShopeeLink');

assert.match(
  statusHandler,
  /vpsApiService\.getProductById\(product\.id,\s*true\)[\s\S]*vpsApiService\.updateProduct\(product\.id,\s*\{[\s\S]*status:\s*newStatus/,
  'status toggle should persist status through VPS product update',
);

assert.match(
  stockHandler,
  /vpsApiService\.getProductById\(product\.id,\s*true\)[\s\S]*vpsApiService\.updateProduct\(product\.id,\s*\{[\s\S]*stock_quantity:\s*realStock/,
  'Bling stock sync should persist stock_quantity through VPS product update',
);

assert.match(
  shopeeHandler,
  /vpsApiService\.getProductById\(product\.id,\s*true\)[\s\S]*vpsApiService\.updateProduct\(product\.id,\s*\{[\s\S]*shopee_item_id:\s*null/,
  'stale Shopee link cleanup should clear products.shopee_item_id through VPS product update',
);

for (const handler of [statusHandler, stockHandler, shopeeHandler]) {
  assert.doesNotMatch(
    handler,
    /supabase\s*\.[\s\S]*from\(['"]products['"]\)[\s\S]*update\(/,
    'ProductCard status/stock/Shopee cleanup handlers should not write products directly to Supabase',
  );
}

console.log('product card status and stock VPS static checks passed');
