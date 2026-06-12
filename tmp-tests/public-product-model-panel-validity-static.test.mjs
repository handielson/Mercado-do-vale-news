import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /const \[hasValidModelPanel, setHasValidModelPanel\]/,
  'public product page must track whether product.model_id resolves to a real model',
);

assert.match(
  source,
  /setHasValidModelPanel\(Boolean\(modelData\?\.\id\)\)/,
  'public product page must validate model_id before enabling model panel link',
);

assert.match(
  source,
  /hasValidModelPanel && productModelId/,
  'admin model panel button must only be visible for valid model ids',
);

console.log('public product model panel validity static checks passed');
