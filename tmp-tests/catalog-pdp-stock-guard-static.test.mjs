import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /const\s+isSellableCatalogProduct\s*=\s*\([^)]*item[^)]*\)\s*(?::\s*boolean\s*)?=>[\s\S]*?stock_quantity[\s\S]*?>\s*0/,
  'PublicProductPage must define a single sellable stock guard for PDP variants',
);

assert.match(
  source,
  /const\s+sellableVariantOptions\s*=\s*uniqueVariants\.filter\(isSellableCatalogProduct\)/,
  'PDP variant options must be derived from in-stock variants only',
);

assert.match(
  source,
  /const\s+groupedVariantOptions\s*=\s*Array\.from\(sellableVariantOptions\.reduce/,
  'PDP visible option groups must not include out-of-stock variants',
);

assert.match(
  source,
  /const\s+shareableVariants\s*=\s*sellableVariantOptions[\s\S]*?const\s+variantNames\s*=\s*shareableVariants\.map/,
  'Product share text must list only in-stock variants as available',
);

assert.doesNotMatch(
  source,
  /const\s+variantNames\s*=\s*uniqueVariants\.map/,
  'Product share text must not use all active variants as available',
);

console.log('catalog PDP stock guard static checks passed');
