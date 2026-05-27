import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const orderService = readFileSync(resolve('services/orderService.ts'), 'utf8');
assert(
  /vpsApiService\.getProductsByIds\(productIds\)/.test(orderService),
  'orderService should load product costs from VPS by ids',
);
assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(orderService),
  'orderService must not read products directly from Supabase',
);

const averagePriceService = readFileSync(resolve('services/averagePriceService.ts'), 'utf8');
assert(
  /vpsApiService\.getProducts\(\{\s*model_id:\s*variation\.model_id[\s\S]*status:\s*'active'/.test(averagePriceService),
  'averagePriceService should load variation products from VPS',
);
assert(
  /product\.specs\?\.ram[\s\S]*product\.specs\?\.storage/.test(averagePriceService),
  'averagePriceService should preserve RAM/storage filtering after loading model products from VPS',
);

const productFromMatches = averagePriceService.match(/from\('products'\)|supabase\s*\.\s*from\('products'\)/g) || [];
assert.equal(
  productFromMatches.length,
  1,
  'averagePriceService should only keep the remaining Supabase products write for price propagation',
);

console.log('order and average price VPS product static checks passed');
