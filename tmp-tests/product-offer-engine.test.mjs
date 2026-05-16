import assert from 'node:assert/strict';
import {
  buildDefaultOfferSku,
  calculateOfferStock,
  chooseShopeeOfferStrategy,
  normalizeOfferComponents,
} from '../services/productOfferEngine.ts';

const baseProduct = {
  id: 'prod-red',
  sku: 'CAPA-RN8-VERM',
  name: 'Capa Redmi Note 8 Vermelha',
  stock_quantity: 10,
  price_retail: 1490,
  price_reseller: 1296,
  price_wholesale: 1043,
  bling_id: 111,
};

const filmProduct = {
  id: 'film-rn8',
  sku: 'PEL-RN8',
  name: 'Pelicula Redmi Note 8',
  stock_quantity: 4,
  price_retail: 1000,
  price_reseller: 800,
  price_wholesale: 700,
  bling_id: 222,
};

assert.match(buildDefaultOfferSku(baseProduct.sku, 'quantity_kit', 3), /^[A-Z0-9]{10}$/);
assert.match(buildDefaultOfferSku(baseProduct.sku, 'product_combo', 1, 'capa-pelicula'), /^[A-Z0-9]{10}$/);
assert.match(buildDefaultOfferSku('   ', 'quantity_kit', 3), /^[A-Z0-9]{10}$/);
assert.match(buildDefaultOfferSku('', 'quantity_kit', 3), /^[A-Z0-9]{10}$/);
assert.match(buildDefaultOfferSku('BASE', 'product_combo', 1, '   '), /^[A-Z0-9]{10}$/);
assert.notEqual(
  buildDefaultOfferSku(baseProduct.sku, 'product_combo', 1, 'capa-pelicula'),
  buildDefaultOfferSku(baseProduct.sku, 'product_combo', 1, 'capa-pelicula-2'),
);

const longComboSku = buildDefaultOfferSku(
  'CSRN144GA',
  'product_combo',
  1,
  'Capa de Silicone para Redmi Note 14 4G-Pelicula 3D para Redmi Note 14 4G 5G Poco M7 Pro 5G',
);
assert.equal(longComboSku.length, 10);
assert.match(longComboSku, /^[A-Z0-9]{10}$/);

assert.deepEqual(
  normalizeOfferComponents([{ product: baseProduct, quantity: 3 }]),
  [{ product_id: 'prod-red', quantity: 3, sku: 'CAPA-RN8-VERM', name: 'Capa Redmi Note 8 Vermelha', bling_id: 111 }],
);

assert.equal(
  calculateOfferStock([{ product: baseProduct, quantity: 3 }]),
  3,
);

assert.equal(
  calculateOfferStock([
    { product: baseProduct, quantity: 1 },
    { product: filmProduct, quantity: 1 },
  ]),
  4,
);

assert.equal(
  chooseShopeeOfferStrategy({ existingDimensionCount: 1, requestedOfferDimensionCount: 1 }),
  'variation',
);
assert.equal(
  chooseShopeeOfferStrategy({ existingDimensionCount: 2, requestedOfferDimensionCount: 1 }),
  'separate_item',
);

console.log('product offer engine tests passed');
