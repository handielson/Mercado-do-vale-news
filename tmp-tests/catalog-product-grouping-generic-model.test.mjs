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
assert.equal(new Set(colorVariantProducts.map(generateCatalogGroupKey)).size, 1);

const unrelatedColoredProducts = [
  {
    model_id: 'shared-cable-model',
    brand: 'Baseus',
    name: 'Cabo USB-c Baseus Dynamic 4 100W Branco',
    sku: 'DYN4100WB',
    specs: { color: 'Branco' },
  },
  {
    model_id: 'shared-cable-model',
    brand: 'Toocki',
    name: 'Cabo USB-c Toocki 100W Pd Fast Charging Ponta Azul',
    sku: 'CC100TOA',
    specs: { color: 'Ponta Azul' },
  },
];

assert.equal(new Set(unrelatedColoredProducts.map(generateCatalogGroupKey)).size, 2);

console.log('catalog-product-grouping-generic-model.test.mjs: ok');
