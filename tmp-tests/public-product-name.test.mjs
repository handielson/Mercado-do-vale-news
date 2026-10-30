import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPublicProductName } from '../pages/store/publicProductName.js';

assert.equal(
  getPublicProductName({
    name: 'Redmi A7 Pró 4/128 Cor:Preto',
    model: 'Redmi A7 Pró',
    specs: { color: 'Preto', storage: '128GB', ram: '4GB' },
  }),
  'Redmi A7 Pró',
);

assert.equal(
  getPublicProductName({
    name: 'Redmi A7 Pró Azul - 128GB - RAM 4GB',
    specs: { color: 'Azul', storage: '128GB', ram: '4GB' },
  }),
  'Redmi A7 Pró',
);

assert.equal(
  getPublicProductName({
    name: 'Capa de Silicone para Redmi Note 8T - Transparente',
    specs: { color: 'Transparente' },
  }),
  'Capa de Silicone para Redmi Note 8T',
);

assert.equal(
  getPublicProductName({
    name: 'Carregador Turbo 33W',
    specs: {},
  }),
  'Carregador Turbo 33W',
);

assert.equal(
  getPublicProductName({
    name: 'Redmi Note 15 Pró 5G 8GB/256GB Cor:Preto',
    model: 'Redmi Note 15 Pró 5G',
    specs: { color: 'Preto', storage: '256GB', ram: '8GB' },
  }),
  'Redmi Note 15 Pró 5G',
);

const variation = { parent_id: 'family', parent_name: 'Poco X8 5G - POCO0001', name: 'Poco X8 5G - Branco / 8GB / 256GB', sku: 'POCO0001-03' };
assert.equal(getPublicProductName(variation), 'Poco X8 5G');
assert.equal(getPublicProductName({ ...variation, sku: 'POCO0001-01' }), 'Poco X8 5G');
assert.equal(getPublicProductName({ ...variation, parent_sku: 'POCO0001', sku: 'CUSTOM-CHILD' }), 'Poco X8 5G');
assert.equal(variation.sku, 'POCO0001-03', 'display cleanup must preserve the variation SKU');
assert.equal(variation.parent_name, 'Poco X8 5G - POCO0001', 'display cleanup must not rewrite stored family names');
assert.equal(getPublicProductName({ ...variation, parent_name: 'Poco X8 5G - Edição Especial' }), 'Poco X8 5G - Edição Especial');
assert.equal(getPublicProductName({ ...variation, parent_name: 'Poco X8 5G - ABC0001' }), 'Poco X8 5G - ABC0001');
assert.equal(getPublicProductName({ ...variation, parent_name: 'Modelo - A+B', parent_sku: 'A+B' }), 'Modelo');
const page = fs.readFileSync(new URL('../pages/store/PublicProductPage.tsx', import.meta.url), 'utf8');
assert.match(page, /const publicProductName = getPublicProductName\(product\)/);
assert.match(page, /SKU: <span className="font-mono">\{product.sku \|\| '—'\}<\/span>/, 'selected variation SKU remains below the title');
console.log('public-product-name tests passed');
