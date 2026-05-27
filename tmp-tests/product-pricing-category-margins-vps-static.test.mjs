import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/products/sections/ProductPricing.tsx', 'utf8');

assert(
  !/from\(['"]categories['"]\)/.test(source),
  'ProductPricing must not read category margins directly from Supabase',
);

assert(
  /vpsApiService\.getCategories\(\)/.test(source),
  'ProductPricing should load category margins from VPS categories',
);

assert(
  /margin_wholesale/.test(source) && /margin_reseller/.test(source),
  'ProductPricing should keep using wholesale and reseller margin fields',
);

console.log('product pricing category margins VPS static checks passed');
