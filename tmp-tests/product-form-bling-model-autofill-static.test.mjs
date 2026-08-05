import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');
const modelSelectSource = fs.readFileSync('components/products/selectors/ModelSelect.tsx', 'utf8');
const basicInfoSource = fs.readFileSync('components/products/sections/ProductBasicInfo.tsx', 'utf8');

assert.match(
  source,
  /resolveBlingModelSuggestion/,
  'ProductForm should resolve a model suggestion from the Bling SKU product before autofill',
);

assert.match(
  source,
  /const resolvedModelId = localProduct\?\.model_id \|\| blingModelSuggestion\?\.id \|\| null/,
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
  basicInfoSource,
  /String\(product\.bling_id \|\| ''\) === String\(blingParentId\)/,
  'Product form should resolve the local parent by the Bling parent id',
);

assert.match(
  basicInfoSource,
  /setValue\('parent_id', parent\.id, \{ shouldValidate: true, shouldDirty: true \}\)/,
  'Resolved Bling parent should fill the local products.parent_id field',
);

assert.match(
  source,
  /fetchBlingProductDetail\(parentId\)[\s\S]*importBlingProducts\([\s\S]*\[parentDetail\]/,
  'Missing Bling structure parents should be imported during automatic SKU linking',
);

assert.match(
  source,
  /\/admin\/migrate\/close-parent-linkage/,
  'Importing a missing parent should also close existing sibling parent links',
);

assert.match(
  source,
  /setValue\('parent_id', link\.parentProduct\.id, \{ shouldDirty: true, shouldValidate: true \}\)/,
  'The newly imported parent should immediately fill the current form',
);

assert.match(
  modelSelectSource,
  /setNewModelName\(searchTerm\.trim\(\)\)/,
  'Model create dialog should start from the typed suggestion to avoid retyping and duplicates',
);

console.log('product-form Bling model autofill static checks passed');
