import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('components/products/selectors/ModelSelect.tsx', 'utf8');

assert.match(source, /filterModelsForSearch/, 'ModelSelect must use the shared local filter');
assert.match(source, /type="text"/, 'ModelSelect must render a text input instead of only a closed select');
assert.match(source, /placeholder="Buscar modelo/, 'ModelSelect input must explain that it searches models');
assert.match(source, /filteredModels\.map/, 'ModelSelect must render filtered model options');
assert.match(source, /handleRefreshModels/, 'ModelSelect refresh button must call the explicit refresh handler');
assert.match(source, /onChange\(model\.name,\s*model\)/, 'ModelSelect must pass the selected model object to the parent');

console.log('model select searchable static checks passed');
