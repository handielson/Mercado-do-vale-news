import assert from 'node:assert/strict';
import {
  generateCatalogGroupKey,
  hasCatalogVariantSpecs,
} from '../services/productGroupingCore.js';

const genericModelProducts = [
  {
    model_id: 'generic-trimmer-model',
    brand: 'Minimen',
    name: 'Máquina de Cortar Cabelo Barba Recarregável Usb com Visor MM-T112',
    sku: 'MM-T112',
    specs: {},
  },
  {
    model_id: 'generic-trimmer-model',
    brand: 'Trimmer Suit',
    name: 'Máquina de Cortar Cabelo Barba Recarregável Usb Trimmer Suit MCCTS',
    sku: 'MCCTS',
    specs: {},
  },
  {
    model_id: 'generic-trimmer-model',
    brand: 'Hair Trimmer',
    name: 'Máquina de Cortar Cabelo Hair Trimmer Professional T-Blade, MQ-7304',
    sku: 'MQ-7304',
    specs: {},
  },
];

assert.equal(hasCatalogVariantSpecs(genericModelProducts[0]), false);
assert.equal(new Set(genericModelProducts.map(generateCatalogGroupKey)).size, 3);

const colorVariantProducts = [
  {
    model_id: 'real-phone-model',
    brand: 'Xiaomi',
    name: 'Redmi Note Preto',
    sku: 'RN-BLK',
    specs: { color: 'Preto' },
  },
  {
    model_id: 'real-phone-model',
    brand: 'Xiaomi',
    name: 'Redmi Note Azul',
    sku: 'RN-BLU',
    specs: { color: 'Azul' },
  },
];

assert.equal(hasCatalogVariantSpecs(colorVariantProducts[0]), true);
assert.deepEqual(colorVariantProducts.map(generateCatalogGroupKey), [
  'real-phone-model',
  'real-phone-model',
]);

console.log('catalog-product-grouping-generic-model.test.mjs: ok');
