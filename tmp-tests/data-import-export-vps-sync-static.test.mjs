import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/import/DataImportExportPage.tsx', 'utf8');

assert.match(
  page,
  /vpsApiService\.getProducts\(\{[\s\S]*offset/,
  'VPS sync should page products from the VPS instead of Supabase',
);

assert.match(
  page,
  /vpsApiService\.bulkSyncPricesStock\(mergedRows\)/,
  'VPS sync should keep using the bulk price/stock endpoint',
);

assert.doesNotMatch(
  page,
  /from\('products'\)/,
  'Data import/export page must not read products directly through Supabase',
);

console.log('data import/export VPS sync static checks passed');
