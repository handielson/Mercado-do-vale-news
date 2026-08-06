import assert from 'node:assert/strict';
import * as modernProductCardState from './modernProductCardState.js';

const {
  formatCatalogVariationLabel,
  getCatalogCardDisplayName,
  productHasCatalogMedia,
  selectCatalogCardImageProduct,
  selectCatalogCardProduct,
} = modernProductCardState;

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
    product: { ...representedProduct, images: [], specs: { color: 'Preto' } },
    currentProduct: { ...representedProduct, images: [], specs: { color: 'Preto' } },
    selectedVariant: {
      colors: [],
      products: [
        { ...representedProduct, images: [], specs: { color: 'Preto' } },
        { ...siblingProduct, images: ['https://cdn/yellow.png'], specs: { color: 'Amarelo' } },
      ],
    },
    currentColorIndex: -1,
  }).id,
  'sl6011',
);

assert.equal(
  selectCatalogCardImageProduct({
    product: { ...representedProduct, images: [], specs: { color: 'Preto' } },
    currentProduct: { ...representedProduct, images: [], specs: { color: 'Preto' } },
    selectedVariant: {
      colors: [],
      products: [
        { ...representedProduct, images: [], specs: { color: 'Preto' } },
        { id: 'black-old', images: ['https://cdn/black.png'], specs: { color: 'preto' } },
        { ...siblingProduct, images: ['https://cdn/yellow.png'], specs: { color: 'Amarelo' } },
      ],
    },
    currentColorIndex: -1,
  }).id,
  'black-old',
);

assert.equal(
  typeof getCatalogCardDisplayName,
  'function',
  'expected grouped card title helper to be exported',
);

assert.equal(
  typeof formatCatalogVariationLabel,
  'function',
  'expected variation label formatter to be exported',
);

assert.equal(formatCatalogVariationLabel('PRETO'), 'Preto');
assert.equal(formatCatalogVariationLabel('AZUL MARINHO'), 'Azul Marinho');
assert.equal(formatCatalogVariationLabel('vErDe LiMÃo'), 'Verde Limão');
assert.equal(formatCatalogVariationLabel(undefined), '');

assert.equal(
  getCatalogCardDisplayName({
    product: {
      id: 'a21-blue',
      name: 'Capa Case Silicone Aveludada para Samsung A21 Cor:azul',
      model: 'Capa Case Silicone Aveludada para Samsung A21 Cor:azul',
      specs: { color: 'azul' },
    },
    productGroup: {
      model: 'Capa Case Silicone Aveludada para Samsung A21 Cor:azul',
    },
  }),
  'Capa Case Silicone Aveludada para Samsung A21',
);

assert.equal(
  getCatalogCardDisplayName({
    product: {
      id: 'redmi-note-15',
      name: 'Redmi Note 15, 8GB/256GB',
      model: 'Redmi Note 15',
      specs: {},
    },
  }),
  'Redmi Note 15',
);

console.log('modernProductCardState.test.mjs: ok');
