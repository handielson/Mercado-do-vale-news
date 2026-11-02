import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminProductCardSummary } from '../components/products/productCardStatus.js';

const norm = text => String(text).replace(/\s/g, ' ');

test('card fechado mostra preço e estoque', () => {
  const s = getAdminProductCardSummary({ status: 'active', price_retail: 129900, stock_quantity: 3, track_inventory: true });
  assert.equal(norm(s.price), 'R$ 1.299,00');
  assert.deepEqual(s.chips.map(c => c.label), ['3 em estoque']);
});

test('sem estoque, vendido (celular) e inativo aparecem no lugar do estoque', () => {
  assert.deepEqual(getAdminProductCardSummary({ status: 'active', price_retail: 3990, stock_quantity: 0 }).chips.map(c => c.label), ['Sem Estoque']);
  assert.deepEqual(getAdminProductCardSummary({ status: 'active', price_retail: 99900, stock_quantity: 0, specs: { imei1: '490154203237518' } }).chips.map(c => c.label), ['Vendido']);
  assert.deepEqual(getAdminProductCardSummary({ status: 'inactive', price_retail: 3990, stock_quantity: 5 }).chips.map(c => c.label), ['Inativo']);
});

test('sem preço vira alerta; estoque livre não mostra quantidade', () => {
  assert.deepEqual(getAdminProductCardSummary({ status: 'active', price_retail: 0, stock_quantity: 2 }).chips.map(c => c.label), ['2 em estoque', 'Sem preço']);
  const free = getAdminProductCardSummary({ status: 'active', price_retail: 5000, track_inventory: false });
  assert.deepEqual(free.chips, []);
});

test('produto pai não mostra preço/estoque próprios (o resumo da família já mostra)', () => {
  const s = getAdminProductCardSummary({ is_parent: 1, status: 'active', price_retail: 129900, stock_quantity: 0 });
  assert.equal(s.price, null);
  assert.deepEqual(s.chips, []);
});
