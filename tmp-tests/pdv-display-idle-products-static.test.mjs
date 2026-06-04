import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const displaysPage = read('pages/admin/settings/DisplaysPage.tsx');
const displayPage = read('pages/display/DisplayPage.tsx');
const types = read('types/pdvDisplay.ts');

for (const snippet of [
  "import { productService } from '../../../services/products'",
  "import { categoryService } from '../../../services/categories'",
  'idleProductSearch',
  'searchIdleProducts',
  'handleSelectIdleProduct',
  'idleCategories',
  'addIdleCategory',
  'updateIdleCategory',
  'removeIdleCategory',
  'SKU, nome ou EAN',
  'Produtos por categoria',
  'Adicionar categoria',
  'Selecionar categoria',
  'productService.search',
  'productService.searchByEAN',
  'category_name',
  'category_id',
]) {
  assert.ok(displaysPage.includes(snippet), `DisplaysPage.tsx deve conter ${snippet}`);
}

for (const snippet of [
  'category_name?: string',
  'categories: Array<{',
  'category_id: string',
  'category_name?: string',
]) {
  assert.ok(types.includes(snippet), `types/pdvDisplay.ts deve conter ${snippet}`);
}

for (const snippet of [
  'categoryProductPages',
  'loadCategoryProducts',
  'productService.listByCategory',
  'shuffleArray',
  'chunkProducts',
  "type: 'product-page'",
  'current.productPage.products',
]) {
  assert.ok(displayPage.includes(snippet), `DisplayPage.tsx deve conter ${snippet}`);
}

assert.doesNotMatch(
  displaysPage,
  /placeholder="Nome do produto"/,
  'Produtos em destaque devem usar busca por SKU/nome/EAN, nao texto livre de nome'
);

console.log('pdv display idle products static checks passed');
