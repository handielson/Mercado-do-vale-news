'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('edição de produto preserva o SKU central em todas as camadas', () => {
  const form = read('components/products/sections/ProductBasicInfo.tsx');
  const productForm = read('components/products/ProductForm.tsx');
  const service = read('services/products.ts');
  const preview = read('services/localCatalogPreviewServer.cjs');
  const genericProductWriter = read('services/smartphonePriceGroupsServer.cjs');

  assert.match(form, /readOnly=\{Boolean\(initialData\?\.id\)\}/);
  assert.match(productForm, /mergedData\.sku = initialData\.sku/);
  assert.match(service, /skuWasSubmitted && incomingSku !== systemSku/);
  assert.match(service, /sku: oldProduct\.sku \|\| null/);
  assert.match(preview, /preserveSystemSku/);
  assert.match(genericProductWriter, /delete safePayload\.sku/);
  assert.match(genericProductWriter, /!existing \|\| k !== 'sku'/);
  assert.match(genericProductWriter, /não pode ser alterado/);
});

for (const filename of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  test(`${filename}: API, lote e combos não alteram SKU existente`, () => {
    const source = read(filename);
    const productUpdate = source.slice(source.indexOf("fastify.put('/products/:id'"), source.indexOf('// Delete product, its variations'));
    const batchUpdate = source.slice(source.indexOf("fastify.post('/products/batch'"), source.indexOf('// Price/stock sync: deliberately'));
    const comboUpdate = source.slice(source.indexOf("fastify.put('/combos/:id'"), source.indexOf("fastify.delete('/combos/:id'"));

    assert.match(productUpdate, /SELECT sku FROM products WHERE id=\? LIMIT 1/);
    assert.match(productUpdate, /não pode ser alterado/);
    assert.match(batchUpdate, /sku=sku/);
    assert.doesNotMatch(batchUpdate, /sku=IF\(VALUES\(sku\)/);
    assert.match(comboUpdate, /SELECT sku FROM products WHERE id=\? FOR UPDATE/);
    assert.match(comboUpdate, /registeredSku/);
    assert.match(comboUpdate, /não pode ser alterado/);
  });
}
