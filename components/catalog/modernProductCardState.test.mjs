import assert from 'node:assert/strict';
import {
  productHasCatalogMedia,
  selectCatalogCardImageProduct,
  selectCatalogCardProduct,
} from './modernProductCardState.js';

const representedProduct = {
  id: 'sl6011',
  name: 'Adaptador de Tomada Bipolar, 4 Tomadas, 10a, Bivolt, Luatek SL6011',
  images: ['https://cdn/sl6011.png'],
  specs: {},
};

const siblingProduct = {
  id: 'other-sku',
  name: 'Outro produto',
  images: ['https://cdn/other.png'],
  specs: {},
};

const selectedVariant = {
  colors: [],
  products: [siblingProduct, representedProduct],
};

assert.equal(productHasCatalogMedia(representedProduct), true);
assert.equal(productHasCatalogMedia({ id: 'empty', images: [], image_url: '' }), false);

assert.equal(
  selectCatalogCardProduct({
    product: representedProduct,
    selectedVariant,
    currentColorIndex: -1,
  }).id,
  'sl6011',
);

const blueVariantProduct = {
  id: 'blue-variant',
  name: 'Produto Azul',
  images: ['https://cdn/blue.png'],
  specs: { color: 'Azul' },
};

assert.equal(
  selectCatalogCardProduct({
    product: representedProduct,
    selectedVariant: {
      colors: [{ name: 'Azul' }],
      products: [blueVariantProduct, representedProduct],
    },
    currentColorIndex: 0,
  }).id,
  'blue-variant',
);

assert.equal(
  selectCatalogCardImageProduct({
    product: representedProduct,
    currentProduct: representedProduct,
    selectedVariant,
    currentColorIndex: -1,
  }).id,
  'sl6011',
);

assert.equal(
  selectCatalogCardImageProduct({
    product: { ...representedProduct, images: [] },
    currentProduct: { ...representedProduct, images: [] },
    selectedVariant: {
      colors: [],
      products: [{ ...representedProduct, images: [] }, siblingProduct],
    },
    currentColorIndex: -1,
  }).id,
  'other-sku',
);

console.log('modernProductCardState.test.mjs: ok');
