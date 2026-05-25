import assert from 'node:assert/strict';

import { filterModelsForSearch } from '../components/products/selectors/modelSelectFilter.js';

const models = [
  { id: '1', name: 'Película 9D para Redmi Note 10S | Note 10 4G', slug: 'pelicula-9d-redmi-note-10s' },
  { id: '2', name: 'Realme C55', slug: 'realme-c55' },
  { id: '3', name: 'Poco M5S', slug: 'poco-m5s' },
];

assert.deepEqual(
  filterModelsForSearch(models, 'redmi 10s').map((model) => model.id),
  ['1'],
  'filters by multiple words typed in any part of the model name',
);

assert.deepEqual(
  filterModelsForSearch(models, 'pelicula').map((model) => model.id),
  ['1'],
  'matches without accents',
);

assert.deepEqual(
  filterModelsForSearch(models, '', 'Realme C55').map((model) => model.id),
  ['1', '2', '3'],
  'empty search keeps the full list visible',
);

assert.deepEqual(
  filterModelsForSearch(models, 'Realme C55', 'Realme C55').map((model) => model.id),
  ['1', '2', '3'],
  'the selected value does not filter the list until the user types a different term',
);

console.log('model select filter tests passed');
