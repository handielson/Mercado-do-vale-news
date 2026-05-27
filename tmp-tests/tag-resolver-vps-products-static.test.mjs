import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/tagResolver.ts'), 'utf8');

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*cfg\.status\s*\?\?\s*'all'[\s\S]*limit:\s*5000/.test(source),
  'tagResolver should use VPS for product count and stock sum tags',
);

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'active'[\s\S]*limit:\s*limit\s*\*\s*3/.test(source),
  'tagResolver should use VPS for product list tags',
);

assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
  'tagResolver must not read products directly from Supabase',
);

console.log('tag resolver VPS product static checks passed');
