import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/products.ts', 'utf8');

assert(
  /import\s+\{\s*categoryService\s+\}\s+from\s+['"]\.\/categories['"]/.test(source),
  'product service should import categoryService to resolve category metadata from VPS',
);

assert(
  /categoryService\.getById\(categoryId\)/.test(source),
  'product service should resolve serialized category names through categoryService/VPS',
);

assert(
  /isSerializedProductCategory/.test(source),
  'product service should centralize serialized category detection',
);

assert(
  !/supabase\s*\.\s*from\('categories'\)|\.from\('categories'\)/.test(source),
  'product service must not read categories directly from Supabase',
);

console.log('product service serialized category VPS static checks passed');
