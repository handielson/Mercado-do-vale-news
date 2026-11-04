// Etiqueta de preço por variação: card da família, Página da família e página do produto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { labelPrintProduct } from '../components/products/labelPrintProduct.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('variação com preço próprio mantém o preço; sem preço usa o do pai', () => {
  const parent = { id: 'p', price_retail: 129900 };
  const own = { id: 'c1', parent_id: 'p', price_retail: 99900, sku: 'C1' };
  assert.equal(labelPrintProduct(own, parent), own);
  assert.equal(labelPrintProduct({ id: 'c2', parent_id: 'p', price_retail: 0 }, parent).price_retail, 129900);
  assert.equal(labelPrintProduct({ id: 'c3', price_retail: 0 }, null).price_retail, 0);
  assert.equal(labelPrintProduct(parent, parent), parent);
  assert.equal(labelPrintProduct(null, parent), null);
});

test('card da família: cada variação tem botão de etiqueta próprio', () => {
  const source = read('components/products/ProductList.tsx');
  assert.match(source, /setLabelProduct\(product\)/);
  assert.match(source, /Imprimir etiqueta da variação/);
  assert.match(source, /<LazyLabelPrintModal product=\{labelProduct\} parent=\{group\.parent\}/);
});

test('Página da família: "Etiqueta" por SKU com o cadastro da variação', () => {
  const source = read('pages/admin/products/ModelProductAggregatorPage.tsx');
  assert.match(source, /onPrintLabel=\{\(\) => setLabelProduct\(product\.raw \|\| product\.products\?\.\[0\]\?\.raw/);
  assert.match(source, /Etiqueta\n/);
  assert.match(source, /<LazyLabelPrintModal product=\{labelProduct\} parent=\{familyParent\}/);
});

test('página do produto: botão "Imprimir etiqueta"', () => {
  const source = read('pages/admin/products/ProductDetailPage.tsx');
  assert.match(source, /Imprimir etiqueta/);
  assert.match(source, /<LazyLabelPrintModal product=\{product\} parent=\{labelParent\}/);
});
