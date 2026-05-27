import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('utils/catalogMessageGenerator.ts'), 'utf8');

assert(
  !source.includes("import('@/services/supabase')"),
  'catalog message generator must not dynamically import Supabase',
);

assert(
  !/from\('categories'\)|from\('products'\)/.test(source),
  'catalog message generator must not read categories/products directly from Supabase',
);

assert(
  /vpsApiService\.getCategories/.test(source),
  'category catalog message should resolve category names from VPS',
);

assert(
  /vpsApiService\.getProducts/.test(source),
  'catalog messages should load products from VPS',
);

console.log('catalog message generator VPS static checks passed');
