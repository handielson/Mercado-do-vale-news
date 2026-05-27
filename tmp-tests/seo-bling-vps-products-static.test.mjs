import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const seoSource = readFileSync(resolve('pages/admin/settings/seoDashboardData.js'), 'utf8');
const blingPageSource = readFileSync(resolve('pages/admin/settings/BlingPage.tsx'), 'utf8');

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit/.test(seoSource),
  'SEO dashboard data should load products from VPS',
);

assert(
  !/from\('products'\)/.test(seoSource),
  'SEO dashboard data must not read products directly from Supabase',
);

assert(
  /import \{ vpsApiService \} from ['"]\.\.\/\.\.\/\.\.\/services\/vpsApiService['"]/.test(blingPageSource),
  'Bling settings page should import the VPS API service',
);

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000/.test(blingPageSource),
  'Bling settings product diagnostics should load products from VPS',
);

const productFromMatches = blingPageSource.match(/from\('products'\)|supabase\s*\.\s*from\('products'\)/g) || [];
assert.equal(
  productFromMatches.length,
  1,
  'Bling settings page should only keep the Supabase products update that links bling_id',
);

console.log('SEO and Bling page VPS product static checks passed');
