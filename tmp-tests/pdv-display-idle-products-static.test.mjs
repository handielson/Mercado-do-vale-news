import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const displaysPage = read('pages/admin/settings/DisplaysPage.tsx');
const displayPage = read('pages/display/DisplayPage.tsx');
const types = read('types/pdvDisplay.ts');

for (const snippet of [
  "import { productService } from '../../../services/products'",
  'idleProductSearch',
  'searchIdleProducts',
  'handleSelectIdleProduct',
  'SKU, nome ou EAN',
  'productService.search',
  'productService.searchByEAN',
  'category_name',
  "showProductCategory",
  "Mostrar categoria na propaganda",
  "showProductCategory: true",
]) {
  assert.ok(displaysPage.includes(snippet), `DisplaysPage.tsx deve conter ${snippet}`);
}

for (const snippet of [
  'showProductCategory: boolean',
  'category_name?: string',
]) {
  assert.ok(types.includes(snippet), `types/pdvDisplay.ts deve conter ${snippet}`);
}

for (const snippet of [
  'settings.showProductCategory',
  'current.product.category_name',
]) {
  assert.ok(displayPage.includes(snippet), `DisplayPage.tsx deve conter ${snippet}`);
}

assert.doesNotMatch(
  displaysPage,
  /placeholder="Nome do produto"/,
  'Produtos em destaque devem usar busca por SKU/nome/EAN, nao texto livre de nome'
);

console.log('pdv display idle products static checks passed');
