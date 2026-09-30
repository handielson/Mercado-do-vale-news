import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const digest = readFileSync(resolve('services/dashboardSalesDigestService.js'), 'utf8');
assert(
  /const pageSize = 2000[\s\S]*vpsApiService\.getProducts\(\{[\s\S]*limit:\s*pageSize,[\s\S]*offset,[\s\S]*if \(page\.length < pageSize\) break/.test(digest),
  'dashboard sales digest should paginate the complete VPS product catalog',
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
