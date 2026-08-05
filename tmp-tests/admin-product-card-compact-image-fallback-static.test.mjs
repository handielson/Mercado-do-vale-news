import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

assert.match(
  source,
  /vpsApiService\.getProductById\(product\.id,\s*true\)/,
  'ProductCard must fetch the full product as a visible-card fallback when compact admin rows omit images',
);

assert.match(
  source,
  /const fullProductImages = normalizeImageList\(fullProduct\?\.images\);[\s\S]*setProductImages\(fullProductImages\);[\s\S]*setFetchedImages\(fullProductImages\);/,
  'ProductCard must hydrate both the cover and editable gallery from the full product images',
);

const fullProductLookupIndex = source.indexOf('vpsApiService.getProductById(product.id, true)');
const modelFallbackIndex = source.indexOf('getModelImageWithCache(product.model_id, product.specs?.color)', fullProductLookupIndex);
assert.ok(
  fullProductLookupIndex >= 0 && modelFallbackIndex > fullProductLookupIndex,
  'ProductCard must prefer the real full-product images before the shared model/color fallback',
);

assert.match(
  source,
  /vpsApiService\.getProducts\(\{\s*model_id:\s*product\.model_id,\s*status:\s*'all',\s*limit:\s*200,\s*noCache:\s*true\s*\}\)/s,
  'ProductCard must search same-model sibling products when the current product and model/color gallery have no images',
);

assert.match(
  source,
  /findSiblingImagesForProduct\(\s*siblingProducts,\s*product\s*\)/,
  'ProductCard must choose sibling images through the product-aware helper so color-compatible variants are preferred',
);

console.log('admin product compact image fallback OK');
