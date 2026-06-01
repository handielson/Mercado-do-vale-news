import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const servicePath = 'services/shopeeProducts.ts';

assert.ok(existsSync(servicePath), 'Shopee product link metadata should have a VPS service');

const service = readFileSync(servicePath, 'utf8');
const useProducts = readFileSync('hooks/useProducts.ts', 'utf8');
const products = readFileSync('services/products.ts', 'utf8');
const productCard = readFileSync('components/products/ProductCard.tsx', 'utf8');

assert.match(
  service,
  /\/table-data\/shopee_products/,
  'Shopee product link service must read shopee_products through VPS table-data',
);

assert.doesNotMatch(
  service,
  /from\('shopee_products'\)/,
  'Shopee product link service must not use Supabase table access',
);

for (const [label, source] of [
  ['useProducts', useProducts],
  ['products service', products],
  ['ProductCard', productCard],
]) {
  assert.match(source, /shopeeProductService/, `${label} should use the VPS Shopee product link service`);
}

assert.doesNotMatch(
  useProducts,
  /from\('shopee_products'\)/,
  'useProducts must not read shopee_products through Supabase',
);

assert.doesNotMatch(
  products,
  /from\('shopee_products'\)/,
  'productService must not read shopee_products through Supabase',
);

console.log('shopee products VPS service static checks passed');
