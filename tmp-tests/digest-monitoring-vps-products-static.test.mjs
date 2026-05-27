import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const monitoring = readFileSync(resolve('services/monitoringService.ts'), 'utf8');
assert(
  /from\('performance_metrics'\)/.test(monitoring),
  'monitoring service should use a non-products table for Supabase health checks',
);
assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(monitoring),
  'monitoring service must not read products directly from Supabase',
);

console.log('digest and monitoring product-read static checks passed');
