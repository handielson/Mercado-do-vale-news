import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/settings/ModelModal.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /<datalist\s+id=["']model-brand-options-/,
  'model brand autocomplete must use a visible clickable dropdown instead of datalist'
);

assert.match(
  source,
  /filteredBrands\.map\(\(brand\)/,
  'model brand autocomplete must render filtered brand options'
);

assert.match(
  source,
  /onMouseDown=\{\(\) => handleSelectBrand\(brand\)\}/,
  'model brand autocomplete options must be clickable'
);

console.log('model brand autocomplete dropdown regression ok');
