import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');
const modelSelectSource = fs.readFileSync('components/products/selectors/ModelSelect.tsx', 'utf8');

assert.match(
  source,
  /resolveBlingModelSuggestion/,
  'ProductForm should resolve a model suggestion from the Bling SKU product before autofill',
);

assert.match(
  source,
  /model_id:\s*localProduct\?\.model_id\s*\|\|\s*blingModelSuggestion\?\.id\s*\|\|\s*null/,
  'Bling SKU autofill should preselect an existing local model when the Bling name matches',
);

assert.match(
  source,
  /productName:\s*resolveBlingProductDisplayName\(product\)/,
  'Bling SKU autofill should carry the Bling product name for empty product-name fields',
);

assert.match(
  source,
  /setValue\('name',\s*link\.productName/,
  'Bling SKU autofill should fill product name only through the form autofill path',
);

assert.match(
  source,
  /normalizedSuggestion\.includes\(normalizedName\)/,
  'Bling SKU autofill should match an active model when the Bling name includes variation details',
);

assert.match(
  source,
  /model_id:\s*watch\('model_id'\)\s*\|\|\s*undefined/,
  'Serialized batch rows should retain the selected model id',
);

assert.match(
  source,
  /mergedData\.model_id\s*=\s*getValues\('model_id'\)\s*\|\|\s*mergedData\.model_id/,
  'Saving should use the latest automatically resolved model id',
);

assert.match(
  modelSelectSource,
  /setNewModelName\(searchTerm\.trim\(\)\)/,
  'Model create dialog should start from the typed suggestion to avoid retyping and duplicates',
);

console.log('product-form Bling model autofill static checks passed');
