import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBlingImportSelection,
  isBlingKitProduct,
  isBlingStructureProduct,
} from '../services/blingVariationImport.ts';

test('formato E identifica um kit vendável e formato V identifica um pai', () => {
  assert.equal(isBlingKitProduct({ id: 1, formato: 'E' }), true);
  assert.equal(isBlingStructureProduct({ id: 1, formato: 'E' }), false);
  assert.equal(isBlingStructureProduct({ id: 2, formato: 'V' }), true);
});

test('selecionar um kit não expande um grupo de variações', () => {
  const kit = { id: 1, formato: 'E', codigo: 'KIT5SLNBKUPG' };
  const linkedProduct = { id: 2, formato: 'S', variacao: { produtoPai: { id: kit.id } } };

  assert.deepEqual(buildBlingImportSelection([kit], [kit, linkedProduct]), {
    products: [kit],
    missingParentIds: [],
  });
});

test('selecionar uma variação traz primeiro o pai V e inclui os irmãos', () => {
  const parent = { id: 1, formato: 'V' };
  const first = { id: 2, formato: 'S', variacao: { produtoPai: { id: parent.id } } };
  const sibling = { id: 3, formato: 'S', variacao: { produtoPai: { id: parent.id } } };
  const kit = { id: 4, formato: 'E' };

  const result = buildBlingImportSelection([first], [kit, parent, first, sibling]);
  assert.equal(result.products[0], parent);
  assert.deepEqual(new Set(result.products), new Set([parent, first, sibling]));
  assert.equal(result.products.length, 3);
  assert.deepEqual(result.missingParentIds, []);
});
