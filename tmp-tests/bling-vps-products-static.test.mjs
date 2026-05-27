import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/blingService.ts'), 'utf8');

assert(
  /getVpsProductsForBlingModel/.test(source),
  'bling service should share model product reads through the VPS helper',
);

assert(
  /vpsApiService\.getProductById\(productId,\s*true\)/.test(source),
  'stock sync should read the sold product from VPS',
);

assert(
  /existingVpsProducts\s*=\s*\(await vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000/.test(source),
  'Bling import should check duplicates from VPS products',
);

const productFromMatches = source.match(/from\('products'\)|supabase\s*\.\s*from\('products'\)/g) || [];
assert.equal(
  productFromMatches.length,
  3,
  'bling service should only keep Supabase products calls for import/reimport mutations',
);

assert(
  !/from\('products'\)[\s\S]*select\('bling_id/.test(source),
  'bling service must not keep direct Supabase products reads for bling_id lookups',
);

console.log('bling VPS product static checks passed');
