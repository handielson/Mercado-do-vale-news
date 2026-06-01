import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/catalog/ProductDetailsModal.tsx'), 'utf8');

assert(
  /vpsApiService\.getProductById/.test(source),
  'ProductDetailsModal should load missing warranty product fields from VPS',
);

assert(
  /brandService[\s\S]*categoryService[\s\S]*warrantyTemplateService/.test(source),
  'ProductDetailsModal should keep warranty support lookups routed through services outside products',
);

assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
  'ProductDetailsModal must not read products directly from Supabase',
);

console.log('product details modal VPS warranty static checks passed');
