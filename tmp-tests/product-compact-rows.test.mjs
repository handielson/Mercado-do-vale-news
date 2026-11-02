import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompactRow, variantLabel } from '../components/products/productCompactRows.js';

const base = o => ({ status: 'active', track_inventory: true, price_retail: 129900, stock_quantity: 0, images: [], specs: {}, ...o });
const parent = base({ id: 'p0', name: 'Redmi Note 15 4G', sku: 'RN15', is_parent: 1, images: ['pai.jpg'] });
const azul = base({ id: 'p1', sku: 'RN15-AZL', parent_id: 'p0', stock_quantity: 0, specs: { color: 'Azul', ram: '8GB', storage: '256GB' } });
const preto = base({ id: 'p2', sku: 'RN15-PRT', parent_id: 'p0', stock_quantity: 3, price_retail: 139900, specs: { color: 'Preto', ram: '8GB', storage: '256GB' } });
const family = (matched) => ({ key: 'f', isFamily: true, parent, representative: parent, familyProducts: [parent, azul, preto], matchedProducts: matched, totalStock: 3 });

test('produto solto: preço, estoque, foto e cor/memória', () => {
  const row = getCompactRow({ key: 'x', isFamily: false, representative: base({ id: 'a', name: 'Fone', sku: 'F1', stock_quantity: 4, price_retail: 19990, images: ['', 'f.jpg'], specs: { color: 'Branco' } }) });
  assert.equal(row.price, 'R$ 199,90');
  assert.equal(row.image, 'f.jpg');
  assert.equal(row.subtitle, 'Branco');
  assert.deepEqual(row.chips.map(chip => chip.label), ['4 em estoque']);
});

test('família: faixa de preço, variações ordenadas, estoque total', () => {
  const row = getCompactRow(family([parent, azul, preto]));
  assert.equal(row.price, 'R$ 1.299,00 a R$ 1.399,00');
  assert.equal(row.image, 'pai.jpg');
  assert.deepEqual(row.variants.map(v => [v.label, v.stock]), [['Azul · 8GB/256GB', 0], ['Preto · 8GB/256GB', 3]]);
  assert.deepEqual(row.chips.map(chip => chip.label), ['2 variações', '3 em estoque']);
  assert.equal(row.variants.some(v => v.matched), false, 'sem busca nada fica destacado');
});

test('família: busca que achou uma variação destaca só ela', () => {
  const row = getCompactRow(family([preto]));
  assert.deepEqual(row.variants.map(v => v.matched), [false, true]);
});

test('rótulo da variação cai para o SKU sem specs', () => {
  assert.equal(variantLabel(base({ sku: 'ZZ' })), 'ZZ');
});
