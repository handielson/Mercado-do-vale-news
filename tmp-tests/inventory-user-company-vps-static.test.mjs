import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/inventory.ts', 'utf8');

assert.match(
  source,
  /loadUserCompanyId\(userId\)/,
  'adjustStock should resolve the current user company through a VPS-backed helper',
);

assert.match(
  source,
  /\/table-data\/users/,
  'inventory service should load user company data from VPS table-data',
);

assert.doesNotMatch(
  source,
  /from\(['"]users['"]\)/,
  'inventory service must not read users directly through Supabase',
);

console.log('inventory user company VPS static checks passed');
