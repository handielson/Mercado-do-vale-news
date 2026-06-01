import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const digest = readFileSync(resolve('services/dashboardSalesDigestService.js'), 'utf8');
assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000/.test(digest),
  'dashboard sales digest should load its product catalog from VPS',
);
assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(digest),
  'dashboard sales digest must not read products directly from Supabase',
);

assert.equal(
  existsSync(resolve('services/monitoringService.ts')),
  false,
  'retired Supabase monitoring service should not remain in runtime services',
);
assert.equal(
  existsSync(resolve('types/systemStatus.ts')),
  false,
  'retired Supabase monitoring types should not remain without a VPS-backed implementation',
);

console.log('digest and monitoring product-read static checks passed');
