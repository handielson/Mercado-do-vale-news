import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
const colorSelect = readFileSync('components/products/selectors/ColorSelect.tsx', 'utf8');

assert.match(
  form,
  /modelService\.getById\(initialData\.model_id\)/,
  'product edit form must preload model by model_id when the denormalized model name is missing',
);

assert.match(
  form,
  /setValue\('model', model\.name/,
  'product edit form must fill the visible model input after resolving model_id',
);

assert.match(
  colorSelect,
  /color\.name === value \|\| color\.id === value \|\| color\.slug === value/,
  'color selector must accept persisted color name, id, or slug',
);

assert.match(
  colorSelect,
  /value=\{selectedValue\}/,
  'color selector must show the resolved color name in the select control',
);

console.log('product form edit prefill static checks passed');
