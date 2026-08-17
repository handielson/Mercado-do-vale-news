import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateCatalogGroupKey } from '../services/productGroupingCore.js';

const openedProduct = {
  id: 'pir-sensor',
  model_id: 'shared-generic-model',
  brand: 'Generic',
  name: 'Interruptor Humano Sensor Infravermelho 110/220V',
  sku: 'MR-HWQR8636',
  specs: {},
};

const sameModelCandidates = [
  openedProduct,
  {
    id: 'selfie-stick',
    model_id: 'shared-generic-model',
    brand: 'Generic',
    name: 'Bastao Pau de Selfie com Controle',
    sku: 'SELFIE-001',
    specs: {},
  },
];

const openedGroupKey = generateCatalogGroupKey(openedProduct);
const visibleSiblings = sameModelCandidates.filter(
  product => generateCatalogGroupKey(product) === openedGroupKey
);

assert.deepEqual(
  visibleSiblings.map(product => product.sku),
  ['MR-HWQR8636'],
  'PDP must not aggregate different products only because they share a generic model_id'
);

const colorVariants = [
  {
    id: 'cover-black',
    model_id: 'real-variant-model',
    brand: 'Generic',
    name: 'Capa Silicone Preto',
    sku: 'CAPA-PRETO',
    specs: { color: 'Preto' },
  },
  {
    id: 'cover-blue',
    model_id: 'real-variant-model',
    brand: 'Generic',
    name: 'Capa Silicone Azul',
    sku: 'CAPA-AZUL',
    specs: { color: 'Azul' },
  },
];

assert.equal(
  new Set(colorVariants.map(generateCatalogGroupKey)).size,
  1,
  'real color variants should still share the same PDP grouping key'
);

const pageSource = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const modelSiblingBranch = pageSource.match(/if \(data\.model_id[\s\S]*?\} else if \(data\.parent_id/)?.[0] || '';

assert.match(
  modelSiblingBranch,
  /generateGroupKey\(s as unknown as CatalogProduct\) === currentGroupKey/,
  'PublicProductPage model_id sibling branch must reuse the catalog group key before showing PDP variants'
);

assert.match(
  pageSource,
  /orderProductVideoSiblings\(product, safeVideoSiblings\)/,
  'PDP must inspect safely grouped sibling variations for a missing video'
);
assert.match(
  pageSource,
  /isSafeProductVideoSibling\(product, sibling\)/,
  'PDP must use a dedicated safe model-name check before inheriting video from legacy siblings'
);
assert.match(
  pageSource,
  /checkVideoBySku\(sibling\.sku\.trim\(\)\)/,
  'PDP must verify a sibling video exists before showing it'
);
assert.match(
  pageSource,
  /if \(verified\?\.exists && verified\.url\)/,
  'PDP must skip stale sibling video registrations'
);
assert.match(pageSource, /const \[videoSiblings, setVideoSiblings\]/);
assert.match(pageSource, /setVideoSiblings\(normalizedSibs\.filter/);

console.log('catalog-pdp-sibling-grouping.test.mjs: ok');
