import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.resolve(__dirname, '../pages/store/PublicProductPage.tsx');
const source = readFileSync(pagePath, 'utf8');

assert.match(
  source,
  /const\s+variantPriceRange\s*=\s*useMemo\(/,
  'PDP must calculate a memoized price range across the visible variant pool',
);

assert.match(
  source,
  /variantPriceRange\.hasRange\s*\?\s*\(/,
  'PDP buybox must render a min-to-max price range when sibling variants have different prices',
);

assert.match(
  source,
  /formatDisplayPrice\(variantPriceRange\.min\)[\s\S]*formatDisplayPrice\(variantPriceRange\.max\)/,
  'PDP price range must be formatted from the lowest price to the highest price',
);

console.log('pdp variant price range static guard ok');
