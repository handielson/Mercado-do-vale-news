import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/dataSyncService.ts', 'utf8');
const importStart = source.indexOf('static async syncGoogleSpreadsheet');
const importEnd = source.indexOf('static async', importStart + 1);

assert(importStart >= 0, 'syncGoogleSpreadsheet should exist');

const importSource = source.slice(importStart, importEnd === -1 ? undefined : importEnd);

assert(
  /vpsApiService\.getBrands\(\)/.test(importSource),
  'syncGoogleSpreadsheet should validate brands from the VPS API',
);

assert(
  !/supabase\s*\.\s*from\('brands'\)|\.from\('brands'\)/.test(importSource),
  'syncGoogleSpreadsheet must not read brands directly from Supabase',
);

assert(
  /validBrands\s*=\s*\(allBrands\s*\?\?\s*\[\]\)[\s\S]*\.map\(\(b:\s*any\)\s*=>\s*String\(b\.name\s*\|\|\s*''\)\.toLowerCase\(\)\)/.test(importSource),
  'syncGoogleSpreadsheet should normalize VPS brand names before validation',
);

console.log('data sync import brands VPS static checks passed');
