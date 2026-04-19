import assert from 'node:assert/strict';

import {
  buildCategoryTree,
  searchShopeeCategories,
  suggestShopeeCategories,
} from './shopeeCategoryHelpers.js';

const flatCategories = [
  { category_id: 1, parent_category_id: 0, display_category_name: 'Roupas Femininas', has_children: true },
  { category_id: 2, parent_category_id: 1, display_category_name: 'Outros', has_children: false },
  { category_id: 10, parent_category_id: 0, display_category_name: 'Computadores e Acessorios', has_children: true },
  { category_id: 11, parent_category_id: 10, display_category_name: 'Componentes de Rede', has_children: true },
  { category_id: 12, parent_category_id: 11, display_category_name: 'Outros', has_children: false },
  { category_id: 20, parent_category_id: 0, display_category_name: 'Beleza', has_children: true },
  { category_id: 21, parent_category_id: 20, display_category_name: 'Outros', has_children: false },
];

const categoryTree = buildCategoryTree(flatCategories);

assert.equal(categoryTree.length, 3);
assert.equal(categoryTree[1].children[0].children[0].category_id, 12);

const broadSearch = searchShopeeCategories(categoryTree, 'outros', 10);
assert.equal(broadSearch.length, 3);
assert.deepEqual(
  [...new Set(broadSearch.map((entry) => entry.__rootLabel))].sort(),
  ['Beleza', 'Computadores e Acessorios', 'Roupas Femininas']
);
assert.equal(
  broadSearch[1].__pathLabel,
  'Computadores e Acessorios > Componentes de Rede > Outros'
);

const suggestions = suggestShopeeCategories({
  productName: 'Adaptador de Rede RJ45 USB 2.0 Exbom UL-100',
  categoryTree,
  historicalProducts: [
    {
      name: 'Adaptador de Rede RJ45 USB 2.0 Exbom UL-100',
      sku: 'UL-100',
      shopee_category_id: 12,
    },
    {
      name: 'Meia feminina cano longo',
      sku: 'MEIA-1',
      shopee_category_id: 2,
    },
  ],
});

assert.equal(suggestions.length, 1);
assert.equal(suggestions[0].category_id, 12);
assert.match(suggestions[0].reason, /Historico parecido/i);
assert.equal(
  suggestions[0].__pathLabel,
  'Computadores e Acessorios > Componentes de Rede > Outros'
);

console.log('shopeeCategoryHelpers.test.mjs: ok');
