const assert = require('node:assert/strict');
const {
  CATALOG_PREFERENCE_HANDOFF_MESSAGE,
  PHONE_LIST_FOLLOWUP_MESSAGE,
  extractCatalogPreferences,
  filterProductsByPreferences,
} = require('../services/autoresponderCatalogPreferences.cjs');

const firstTurn = extractCatalogPreferences('Quero um celular com camera boa', {});
assert.equal(firstTurn.recognized, true);
assert.equal(firstTurn.state.constraints.cameraQuality, 'good');
assert.equal(firstTurn.state.awaiting, 'budget');

const secondTurn = extractCatalogPreferences('1500,00', firstTurn.state);
assert.equal(secondTurn.recognized, true);
assert.equal(secondTurn.state.constraints.cameraQuality, 'good', 'camera preference must survive the next customer message');
assert.equal(secondTurn.state.constraints.budgetMaxCents, 150000, 'standalone budget must be understood in context');

const activeListTurn = extractCatalogPreferences('1500,00', { active: true, family: 'smartphone', constraints: {} });
assert.equal(activeListTurn.recognized, true, 'a standalone price must be understood after the phone list activates preference memory');
assert.equal(activeListTurn.state.constraints.budgetMaxCents, 150000);

const products = [
  {
    name: 'Camera basica', status: 'active', stock_quantity: 1, is_parent: 0, price_retail: 105000,
    specs: { cam_principal_mpx: '13 MP', cam_selfie_mpx: 5, resolucao_video_celular: '1080p@30fps' },
  },
  {
    name: 'Camera adequada', status: 'active', stock_quantity: 1, is_parent: 0, price_retail: 149900,
    specs: { cam_principal_mpx: '50 MP', cam_selfie_mpx: 8, resolucao_video_celular: 'Full HD' },
  },
  {
    name: 'Camera adequada acima do limite', status: 'active', stock_quantity: 1, is_parent: 0, price_retail: 160100,
    specs: { cam_principal_mpx: '50 MP', cam_selfie_mpx: 8, resolucao_video_celular: 'Full HD' },
  },
];

assert.deepEqual(
  filterProductsByPreferences(products, secondTurn.state).map((product) => product.name),
  ['Camera adequada'],
  'all accumulated filters must be applied by intersection',
);

const noMatch = extractCatalogPreferences('1200', firstTurn.state);
assert.equal(filterProductsByPreferences(products, noMatch.state).length, 0);
assert.match(CATALOG_PREFERENCE_HANDOFF_MESSAGE, /Não consegui identificar com segurança, de forma automática/);
assert.doesNotMatch(CATALOG_PREFERENCE_HANDOFF_MESSAGE, /nao (?:tem|existe)|ruim|camera boa.*nao/i);
assert.match(PHONE_LIST_FOLLOWUP_MESSAGE, /câmera, tela, NFC, memória, marca ou faixa de preço/i);

const technical = extractCatalogPreferences('Samsung com NFC, 8 GB RAM, 256 GB de armazenamento e tela AMOLED 120 Hz', {}, ['Samsung', 'Motorola']);
assert.equal(technical.state.constraints.brand, 'Samsung');
assert.equal(technical.state.constraints.nfc, true);
assert.equal(technical.state.constraints.ramMinGb, 8);
assert.equal(technical.state.constraints.storageMinGb, 256);
assert.equal(technical.state.constraints.screenType, 'amoled');
assert.equal(technical.state.constraints.refreshRateMinHz, 120);

console.log('autoresponder catalog preference memory checks passed');
