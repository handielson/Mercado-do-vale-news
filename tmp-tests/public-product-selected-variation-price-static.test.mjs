import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /const\s+\[selectedVariantId,\s*setSelectedVariantId\]\s*=\s*useState<string\s*\|\s*null>\(null\)/,
  'PDP must track whether a variant was explicitly selected',
);

assert.match(
  source,
  /setSelectedVariantId\(String\(sib\.id\)\)/,
  'variant click must mark the selected variant id',
);

assert.match(
  source,
  /setSelectedVariantId\(String\(data\.id\)\)/,
  'direct product routes must select the loaded variation and show its exact price',
);

assert.match(
  source,
  /const\s+shouldShowVariantPriceRange\s*=\s*variantPriceRange\.hasRange\s*&&\s*!selectedVariantId\s*&&\s*!isKitSelected/,
  'PDP must show variant price range only when no variant is selected',
);

assert.equal(
  (source.match(/shouldShowVariantPriceRange\s*\?/g) || []).length,
  2,
  'both buybox price render branches must use the selected-variant-aware range guard',
);

assert.doesNotMatch(
  source,
  /variantPriceRange\.hasRange\s*\?/,
  'buybox must not render the range directly without checking selectedVariantId',
);

console.log('public product selected variation price static checks ok');
