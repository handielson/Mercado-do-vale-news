import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/admin/SectionsTab.tsx'), 'utf8');

assert(
  !source.includes("import('@/services/supabase')"),
  'SectionsTab catalog option loading must not dynamically import Supabase',
);

assert(
  !/from\('categories'\)|from\('products'\)/.test(source),
  'SectionsTab must not read categories/products directly from Supabase',
);

assert(
  /vpsApiService\.getCategories/.test(source),
  'SectionsTab should load section categories from VPS',
);

assert(
  /vpsApiService\.getProducts/.test(source),
  'SectionsTab should load section product options from VPS',
);

console.log('sections tab catalog options VPS static checks passed');
