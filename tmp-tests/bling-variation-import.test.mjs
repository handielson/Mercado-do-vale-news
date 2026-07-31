import assert from 'node:assert/strict';
import {
  buildBlingImportSelection,
  expandBlingSelectionIds,
  toggleBlingSelectionGroup,
} from '../services/blingVariationImport.ts';

const products = [
  { id: 10, formato: 'V', nome: 'Pai', codigo: 'PAI', stock_quantity: 0 },
  { id: 11, nome: 'Vermelho', codigo: 'VERM', stock_quantity: 2, variacao: { produtoPai: { id: 10 } } },
  { id: 12, nome: 'Azul', codigo: 'AZUL', stock_quantity: 0, variacao: { produtoPai: { id: 10 } } },
  { id: 20, formato: 'S', nome: 'Simples', codigo: 'SIMPLES', stock_quantity: 1 },
];

const parentOnly = buildBlingImportSelection([products[0]], products);
assert.deepEqual(parentOnly.products.map((product) => product.id), [10]);

const fullGroup = buildBlingImportSelection([products[1]], products);
assert.deepEqual(fullGroup.products.map((product) => product.id), [10, 11, 12]);

const missingParent = buildBlingImportSelection(
  [{ id: 11, variacao: { produtoPai: { id: 99 } } }],
  [{ id: 11, variacao: { produtoPai: { id: 99 } } }],
);
assert.deepEqual(missingParent.missingParentIds, [99]);

assert.deepEqual([...expandBlingSelectionIds([11], products)], [10, 11, 12]);
assert.deepEqual([...toggleBlingSelectionGroup([], 10, products)], [10]);
assert.deepEqual([...toggleBlingSelectionGroup([], 11, products)], [10, 11, 12]);
assert.deepEqual([...toggleBlingSelectionGroup([10, 11, 12], 11, products)], [10]);
assert.deepEqual([...toggleBlingSelectionGroup([10, 11, 12], 10, products)], []);

console.log('bling variation import tests passed');
