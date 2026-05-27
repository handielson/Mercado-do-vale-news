import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('pages/admin/CashbackPage.tsx'), 'utf8');

assert(
  /vpsApiService\.getCategories\(true\)/.test(source),
  'Cashback promotions should load categories from the VPS API with a fresh read',
);

assert(
  !/supabase\s*\.\s*from\('categories'\)|\.from\('categories'\)/.test(source),
  'Cashback promotions must not read categories directly from Supabase',
);

assert(
  /\.map\(\(row:\s*any\)\s*=>\s*\(\{\s*id:\s*row\.id,\s*name:\s*row\.name\s*\}\)\)/.test(source),
  'Cashback promotions should normalize VPS category rows to id/name options',
);

console.log('Cashback categories VPS static checks passed');
