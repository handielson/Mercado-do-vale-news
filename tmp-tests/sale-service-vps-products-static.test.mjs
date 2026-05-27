import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/saleService.ts'), 'utf8');

assert(
  /vpsApiService\.getProductsByIds\(productIds\)/.test(source),
  'saleService should load promotion product categories from VPS',
);

assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
  'saleService must not read products directly from Supabase',
);

console.log('sale service VPS product static checks passed');
