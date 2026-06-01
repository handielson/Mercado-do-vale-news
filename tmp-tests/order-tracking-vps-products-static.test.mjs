import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('pages/store/OrderTrackingPage.tsx'), 'utf8');

assert(
  /vpsApiService\.getProductsByIds\(allProductIds\)/.test(source),
  'OrderTrackingPage should enrich order items with product data from VPS by ids',
);

assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
  'OrderTrackingPage must not read products directly from Supabase',
);

assert(
  /unitService\.listByIds/.test(source),
  'OrderTrackingPage should load released serialized unit data through unitService',
);

assert(
  !/from\('units'\)|supabase\s*\.\s*from\('units'\)/.test(source),
  'OrderTrackingPage must not read units directly from Supabase',
);

console.log('order tracking VPS products static checks passed');
