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

assert.match(
  source,
  /if \(!isMounted \|\| fetchedImageUrl\) return;/,
  'ProductCard must only use the full-product fallback after the model/color image fallback is missing',
);

console.log('admin product compact image fallback OK');
