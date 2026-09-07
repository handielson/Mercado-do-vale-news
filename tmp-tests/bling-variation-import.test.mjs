import assert from 'node:assert/strict';
import {
  buildBlingImportSelection,
  expandBlingSearchFamilies,
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

const searchedFamily = await expandBlingSearchFamilies([products[0]], async id => {
  assert.equal(id, 10);
  return { id: 10, variacoes: [products[1], products[2]] };
});
assert.deepEqual(searchedFamily.map(p => p.id), [10, 11, 12]);
assert.deepEqual([...expandBlingSelectionIds([11], searchedFamily)], [10, 11, 12]);
const deduped = await expandBlingSearchFamilies([products[0], products[1]], async () => ({ data: { variacoes: [products[1], products[2]] } }));
assert.equal(deduped.length, 3);
await assert.rejects(expandBlingSearchFamilies([products[0]], async () => ({})), /variações/);
await assert.rejects(expandBlingSearchFamilies([products[0]], async () => { throw new Error('429'); }), /429/);
assert.deepEqual(await expandBlingSearchFamilies([products[3]], async () => { throw new Error('Não deve consultar produto simples'); }), [products[3]]);

console.log('bling variation import tests passed');
