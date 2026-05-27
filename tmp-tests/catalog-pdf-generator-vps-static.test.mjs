import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('utils/catalogPDFGenerator.ts'), 'utf8');

assert(
  !source.includes("import('@/services/supabase')"),
  'catalog PDF generator must not dynamically import Supabase',
);

assert(
  !/from\('company_settings'\)|from\('categories'\)|from\('products'\)/.test(source),
  'catalog PDF generator must not read company settings/categories/products directly from Supabase',
);

assert(
  /vpsApiService\.getCompanySettings/.test(source),
  'catalog PDF should load company settings from VPS',
);

assert(
  /vpsApiService\.getCategories/.test(source),
  'catalog PDF should resolve category names from VPS',
);

assert(
  /vpsApiService\.getProducts/.test(source),
  'catalog PDF should load products from VPS',
);

console.log('catalog PDF generator VPS static checks passed');
