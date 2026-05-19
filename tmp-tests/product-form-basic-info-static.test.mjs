import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const basicInfo = readFileSync('components/products/sections/ProductBasicInfo.tsx', 'utf8');

assert.doesNotMatch(
  basicInfo,
  /const autoName = model\.description \|\| model\.name/,
  'model selection must not use model.description as product name',
);

assert.match(
  basicInfo,
  /setValue\('name', model\.name/,
  'model selection must fill product name with only the model name',
);

assert.match(
  basicInfo,
  /productService\.getByEan/,
  'EAN search must fall back to registered products when model_eans does not match',
);

console.log('product-form basic info static checks passed');
