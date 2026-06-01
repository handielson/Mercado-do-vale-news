import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardMetrics = readFileSync('services/dashboardMetricsService.js', 'utf8');
const dashboardDigest = readFileSync('services/dashboardSalesDigestService.js', 'utf8');
const tagResolver = readFileSync('services/tagResolver.ts', 'utf8');

assert.match(
  dashboardMetrics,
  /import\(['"]\.\/saleService['"]\)/,
  'daily dashboard metrics should load sales through the VPS-backed saleService',
);
assert.doesNotMatch(
  dashboardMetrics,
  /from\(['"]sales['"]\)/,
  'daily dashboard metrics must not read sales directly from Supabase',
);

assert.match(
  dashboardDigest,
  /import\(['"]\.\/saleService['"]\)/,
  'dashboard sales digest should load PDV sales through the VPS-backed saleService',
);
assert.doesNotMatch(
  dashboardDigest,
  /from\(['"]sales['"]\)/,
  'dashboard sales digest must not read sales directly from Supabase',
);

assert.match(
  tagResolver,
  /import\s+\{\s*getSales\s+\}\s+from\s+['"]\.\/saleService['"]/,
  'tag resolver should use the VPS-backed saleService for sales tags',
);
assert.doesNotMatch(
  tagResolver,
  /from\(['"]sales['"]\)/,
  'tag resolver must not read sales directly from Supabase',
);

console.log('sales analytics VPS static checks passed');
