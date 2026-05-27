import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/catalogService.ts'), 'utf8');

const start = source.indexOf('getCategoriesWithNames: async');
const end = source.indexOf('getBrands: async', start);

assert(start >= 0 && end > start, 'catalogService.getCategoriesWithNames should exist');

const methodSource = source.slice(start, end);

assert(
  /vpsApiService\.getCategories\(\)/.test(methodSource),
  'catalogService.getCategoriesWithNames should load category rows from VPS',
);

assert(
  !/supabase\s*\.\s*from\('categories'\)|\.from\('categories'\)/.test(methodSource),
  'catalogService.getCategoriesWithNames must not read categories directly from Supabase',
);

assert(
  /\.map\(\(c:\s*any\)\s*=>\s*\(\{\s*id:\s*c\.id,\s*name:\s*c\.name\s*\}\)\)/.test(methodSource),
  'catalogService.getCategoriesWithNames should normalize VPS category rows to id/name',
);

assert(
  /\.sort\(\(a,\s*b\)\s*=>\s*String\(a\.name\s*\|\|\s*''\)\.localeCompare\(String\(b\.name\s*\|\|\s*''\)\)\)/.test(methodSource),
  'catalogService.getCategoriesWithNames should keep category names sorted',
);

console.log('catalogService categories VPS static checks passed');
