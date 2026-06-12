import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /function removeDisabledCategorySpecs\(specs: Record<string, any> \| undefined, config: CategoryConfig \| null\)/,
  'product form must sanitize specs according to the selected category config',
);

assert.match(
  source,
  /requirement === 'off' \|\| requirement === 'hidden'/,
  'category fields marked off/hidden must be removed from specs before saving',
);

assert.match(
  source,
  /customField\.requirement === 'off' \|\| customField\.requirement === 'hidden'/,
  'custom fields marked off/hidden must be removed from specs before saving',
);

assert.match(
  source,
  /mergedData\.specs = removeDisabledCategorySpecs\(mergedData\.specs, categoryConfig\)/,
  'sanitization must run on the payload before duplicate checks and submit',
);

console.log('product form disabled category specs static checks passed');
