import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/inventory.ts'), 'utf8');

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000/.test(source),
  'inventory service should load inventory product reads from VPS',
);

assert(
  /applyInventoryFilters/.test(source) && /sortInventoryProducts/.test(source),
  'inventory service should preserve filtering and sorting after VPS reads',
);

const productFromMatches = source.match(/from\('products'\)|supabase\s*\.\s*from\('products'\)/g) || [];
assert.equal(
  productFromMatches.length,
  0,
  'inventory service must not keep direct Supabase product reads or writes',
);

assert(
  !/from\('products'\)[\s\S]*select\(INVENTORY_PRODUCT_SELECT\)|from\('products'\)[\s\S]*select\('specs/.test(source),
  'inventory service must not keep direct Supabase products reads',
);

console.log('inventory VPS product static checks passed');
