import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/SEODashboardPage.tsx', 'utf8');
const data = readFileSync('pages/admin/settings/seoDashboardData.js', 'utf8');

assert.match(
  data,
  /vpsApiService\.getProducts/,
  'SEO dashboard product reads should come from the VPS',
);

assert.match(
  page,
  /vpsApiService\.getProductById\(p\.id,\s*true\)/,
  'SEO dashboard should hydrate the current product from the VPS before updating SEO fields',
);

assert.match(
  page,
  /vpsApiService\.updateProduct\(p\.id,/,
  'SEO dashboard should write product SEO fields through the VPS',
);

assert.doesNotMatch(
  page,
  /from\('products'\)/,
  'SEO dashboard must not update products directly through Supabase',
);

console.log('SEO dashboard product VPS static checks passed');
