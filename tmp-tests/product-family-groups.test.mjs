import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductFamilyGroups, paginateProductFamilyGroups } from '../utils/productFamilies.mjs';

const parent = { id: 'parent-1', name: 'Suporte', sku: 'SUP', is_parent: true, stock_quantity: 0, price_retail: 0 };
const white = { id: 'child-1', name: 'Suporte Branco', sku: 'SUP-B', parent_id: parent.id, stock_quantity: 2, price_retail: 2500 };
const black = { id: 'child-2', name: 'Suporte Preto', sku: 'SUP-P', parent_id: parent.id, stock_quantity: 3, price_retail: 2900 };
const simple = { id: 'simple-1', name: 'Cabo', sku: 'CAB', stock_quantity: 4, price_retail: 1000 };

test('pai e filhos formam uma unica familia com estoque e faixa de preco', () => {
  const groups = buildProductFamilyGroups([parent, white, black, simple], [parent, white, black, simple]);
  assert.equal(groups.length, 2);
  const family = groups.find(group => group.familyId === parent.id);
  assert.equal(family.parent.id, parent.id);
  assert.deepEqual(family.products.map(product => product.id), [white.id, black.id]);
  assert.equal(family.totalVariationCount, 2);
  assert.equal(family.totalStock, 5);
  assert.equal(family.minPrice, 2500);
  assert.equal(family.maxPrice, 2900);
});

test('busca por SKU filho preserva o pai como contexto e marca a familia para expansao', () => {
  const [family] = buildProductFamilyGroups([black], [parent, white, black, simple]);
  assert.equal(family.parent.id, parent.id);
  assert.deepEqual(family.products.map(product => product.id), [black.id]);
  assert.deepEqual(family.selectionProducts.map(product => product.id), [parent.id, white.id, black.id]);
  assert.equal(family.totalVariationCount, 2);
  assert.equal(family.totalStock, 5);
  assert.equal(family.matchedProducts[0].sku, 'SUP-P');
});

test('busca pelo pai exibe todas as variacoes da familia', () => {
  const [family] = buildProductFamilyGroups([parent], [parent, white, black, simple]);
  assert.deepEqual(family.products.map(product => product.id), [white.id, black.id]);
  assert.deepEqual(family.matchedProducts.map(product => product.id), [parent.id]);
});

test('paginacao trabalha com familias inteiras', () => {
  const groups = buildProductFamilyGroups([parent, white, black, simple], [parent, white, black, simple]);
  const page1 = paginateProductFamilyGroups(groups, 1, 1);
  const page2 = paginateProductFamilyGroups(groups, 2, 1);
  assert.equal(page1.groups.length, 1);
  assert.equal(page1.groups[0].products.length, 2);
  assert.equal(page2.groups[0].representative.id, simple.id);
  assert.equal(page2.totalPages, 2);
});

test('variacao sem pai recebe aviso de vinculo incompleto', () => {
  const [group] = buildProductFamilyGroups([{ ...black, parent_id: 'missing' }], [black]);
  assert.equal(group.isFamily, true);
  assert.equal(group.orphaned, true);
  assert.equal(group.parent, null);
});
