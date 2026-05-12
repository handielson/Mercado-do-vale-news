import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cardSource = readFileSync('components/products/ProductCard.tsx', 'utf8');
const hookSource = readFileSync('hooks/useProducts.ts', 'utf8');
const vpsSource = readFileSync('vps_server.js', 'utf8');
const localServerSource = readFileSync('server.js', 'utf8');

assert.match(
  hookSource,
  /description:\s*row\.description\s*\|\|\s*undefined/,
  'admin product list mapping must preserve description when the API returns it'
);

assert.match(
  vpsSource,
  /id,\s*model_id,\s*category_id,\s*brand,\s*name,\s*sku,\s*ean,\s*alternative_eans,\s*description,/,
  'VPS /products list must select description for Shopee export hydration'
);

assert.match(
  localServerSource,
  /id,\s*model_id,\s*category_id,\s*brand,\s*name,\s*sku,\s*ean,\s*alternative_eans,\s*description,/,
  'local /products list must select description for Shopee export hydration'
);

assert.match(
  cardSource,
  /setShopeeModalProductSource/,
  'ProductCard must keep a hydrated product source for the Shopee modal'
);

assert.match(
  cardSource,
  /const hydratedProduct = await vpsApiService\.getProductById\(product\.id,\s*true\)/,
  'ProductCard must fetch the full product before opening the Shopee modal'
);

assert.match(
  cardSource,
  /mapProductToShopeeLocalProduct\(shopeeModalProductSource/,
  'Shopee modal must receive the hydrated product source, including description'
);

console.log('shopee modal product hydration static checks passed');
