import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/import/LegacySalesImportTab.tsx', 'utf8');

assert.match(
  source,
  /\/table-data\/sales/,
  'Legacy sales import should use VPS table-data for sales',
);

assert.match(
  source,
  /\/table-data\/sale_items\/bulk/,
  'Legacy sales import should bulk insert sale items through the VPS',
);

assert.doesNotMatch(
  source,
  /from\('sales'\)|from\('sale_items'\)/,
  'Legacy sales import must not read or mutate sales/sale_items through Supabase',
);

console.log('legacy sales import VPS sales static checks passed');
