import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailPage = readFileSync('pages/admin/products/ProductDetailPage.tsx', 'utf8');
const publicPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  detailPage,
  /const productSlug = product\?\.slug \|\| product\?\.id/,
  'admin product detail must link public site using real slug or real product id, not a generated name slug',
);

assert.doesNotMatch(
  detailPage,
  /product\.name\.toLowerCase\(\)\.normalize/,
  'admin product detail must not invent a public product slug from the product name',
);

assert.match(
  publicPage,
  /getProducts\(\{ sku: slug, status: 'all', limit: 5, noCache: true \}\)/,
  'public product page must resolve direct SKU routes such as /produto/CSPR15CRSBB',
);

console.log('product detail public link static checks passed');
