import assert from 'node:assert/strict';
import {
  getCategoryDisplayCountMap,
  mergeCategoryDisplayCounts,
} from './catalogCategoryCounts.js';

const categories = [
  { id: 'eletronicos', name: 'Eletronicos', count: 8, parent_id: null },
  { id: 'cuidado', name: 'Cuidado Pessoal', count: 8, parent_id: 'eletronicos' },
  { id: 'cameras', name: 'Cameras', count: 8, parent_id: 'eletronicos' },
];

const groups = [
  { representativeProduct: { category_id: 'cuidado' } },
  { representativeProduct: { category_id: 'cuidado' } },
  { representativeProduct: { category_id: 'cuidado' } },
  { representativeProduct: { category_id: 'cuidado' } },
  { representativeProduct: { category_id: 'cuidado' } },
];

const displayCounts = getCategoryDisplayCountMap(categories, groups);

assert.equal(displayCounts.get('cuidado'), 5);
assert.equal(displayCounts.get('eletronicos'), 5);
assert.equal(displayCounts.get('cameras'), 0);

assert.deepEqual(
  mergeCategoryDisplayCounts(categories, groups, { onlyCategoryIds: ['cuidado'] }),
  [
    { id: 'eletronicos', name: 'Eletronicos', count: 8, parent_id: null },
    { id: 'cuidado', name: 'Cuidado Pessoal', count: 5, parent_id: 'eletronicos' },
    { id: 'cameras', name: 'Cameras', count: 8, parent_id: 'eletronicos' },
  ],
);

assert.deepEqual(
  mergeCategoryDisplayCounts(categories, groups),
  [
    { id: 'eletronicos', name: 'Eletronicos', count: 5, parent_id: null },
    { id: 'cuidado', name: 'Cuidado Pessoal', count: 5, parent_id: 'eletronicos' },
    { id: 'cameras', name: 'Cameras', count: 0, parent_id: 'eletronicos' },
  ],
);

console.log('catalogCategoryCounts.test.mjs: ok');
