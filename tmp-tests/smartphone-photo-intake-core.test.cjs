'use strict';

const assert = require('node:assert/strict');
const {
  PHOTO_INTAKE_STATUS,
  buildSmartphoneVariantSkuBase,
  calculateBrandPrices,
  getBlockingPhotoIntakeErrors,
  filterSmartphonesByFeatures,
  getSmartphoneSaleConfigurationKey,
  isValidGtin,
  isValidImei,
  resolvePhotoIntakeStatus,
  translateColorToPtBr,
  validatePhotoExtraction,
} = require('../services/smartphonePhotoIntakeCore.cjs');
const { productCompanyMatchesIntakeScope, scoreCatalogModel } = require('../services/smartphonePhotoIntakeServer.cjs');

assert.equal(isValidImei('861260086190905'), true);
assert.equal(isValidImei('861260086190906'), false);
assert.equal(isValidGtin('6932554457259'), true);

const extraction = validatePhotoExtraction({
  brand: 'POCO', model: 'C85', color: 'Black', ram: '8 GB', storage: '256 GB',
  serial: '69385/66RK03160', imei1: '861260086190905', imei2: '861260086190913', ean: '6932554457259',
});
assert.equal(extraction.valid, true);
assert.equal(extraction.value.ram, '8GB');
assert.equal(extraction.value.storage, '256GB');
assert.equal(extraction.value.color, 'Preto');
assert.equal(translateColorToPtBr('Purple'), 'Roxo');
assert.equal(translateColorToPtBr('Verde'), 'Verde');
assert.equal(buildSmartphoneVariantSkuBase({ modelName: 'Poco C85', ram: '6GB', storage: '128GB', color: 'Roxo' }), 'PC856128R');
assert.equal(buildSmartphoneVariantSkuBase({ modelName: 'Redmi Note 14', ram: '8GB', storage: '256GB', color: 'Azul Escuro' }), 'RN148256AE');
assert.equal(validatePhotoExtraction({ ...extraction.value, ram: '24GB (8+16)' }).value.ram, '8GB');

assert.equal(scoreCatalogModel(
  { name: 'Poco C85', brand_name: 'Xiaomi' },
  { brand: 'POCO', model: 'C85' },
), 0, 'POCO C85 precisa casar com o modelo Xiaomi que inclui a submarca no nome');
assert.equal(Number.isFinite(scoreCatalogModel(
  { name: 'C85', brand_name: 'Realme' },
  { brand: 'POCO', model: 'C85' },
)), false, 'modelo homônimo de outra marca não pode ser associado');
assert.equal(Number.isFinite(scoreCatalogModel(
  { name: 'Poco C85 Pró', brand_name: 'Xiaomi' },
  { brand: 'POCO', model: 'C85' },
)), false, 'a versão Pró não pode ser escolhida para o C85 comum');

assert.deepEqual(calculateBrandPrices(87000, {
  retail_margin_cents: 20000,
  reseller_margin_cents: 15000,
  wholesale_margin_cents: 10000,
}), {
  price_cost: 87000,
  price_retail: 107000,
  price_reseller: 102000,
  price_wholesale: 97000,
});

assert.equal(
  getSmartphoneSaleConfigurationKey({ model_id: 'poco-c71', specs: { ram: '4GB', storage: '128GB', color: 'Preto' } }),
  getSmartphoneSaleConfigurationKey({ model_id: 'poco-c71', specs: { ram: '4GB', storage: '128GB', color: 'Dourado' } }),
  'a cor não pode criar outro preço de venda para a mesma configuração'
);
assert.notEqual(
  getSmartphoneSaleConfigurationKey({ model_id: 'poco-c71', specs: { ram: '4GB', storage: '128GB' } }),
  getSmartphoneSaleConfigurationKey({ model_id: 'poco-c71', specs: { ram: '8GB', storage: '256GB' } }),
  'RAM e armazenamento diferentes precisam manter preços independentes'
);
assert.equal(resolvePhotoIntakeStatus({ matchedModelId: null }), PHOTO_INTAKE_STATUS.WAITING_MODEL_REGISTRATION);
assert.equal(productCompanyMatchesIntakeScope('default', 'company-default-id', 'company-default-id'), true);
assert.equal(productCompanyMatchesIntakeScope('company-default-id', 'default', 'company-default-id'), true);
assert.equal(productCompanyMatchesIntakeScope(null, 'another-company-id', 'company-default-id'), true);
assert.equal(productCompanyMatchesIntakeScope('default', 'another-company-id', 'company-default-id'), false);
assert.equal(productCompanyMatchesIntakeScope('another-company-id', 'company-default-id', 'company-default-id'), false);
assert.equal(resolvePhotoIntakeStatus({ matchedModelId: 'model-1' }), PHOTO_INTAKE_STATUS.WAITING_PRICE_CONFIRMATION);
assert.equal(resolvePhotoIntakeStatus({ matchedModelId: 'model-1', pricesConfirmed: true }), PHOTO_INTAKE_STATUS.READY_TO_FINALIZE);
assert.equal(resolvePhotoIntakeStatus({
  validationErrors: [{ code: 'invalid', message: 'IMEI inválido' }],
  matchedModelId: 'model-1',
  pricesConfirmed: true,
}), PHOTO_INTAKE_STATUS.REVIEW_REQUIRED);
assert.equal(resolvePhotoIntakeStatus({
  validationErrors: [{ code: 'invalid', message: 'IMEI inválido' }],
  validationWarnings: [{ code: 'invalid', message: 'EAN precisa ser conferido' }],
  reviewConfirmed: true,
  matchedModelId: 'model-1',
  pricesConfirmed: true,
}), PHOTO_INTAKE_STATUS.READY_TO_FINALIZE, 'conferência manual deve liberar alertas confirmáveis');
assert.equal(resolvePhotoIntakeStatus({
  validationErrors: [{ code: 'already_registered', message: 'IMEI já cadastrado' }],
  reviewConfirmed: true,
  matchedModelId: 'model-1',
  pricesConfirmed: true,
}), PHOTO_INTAKE_STATUS.REVIEW_REQUIRED, 'duplicidade não pode ser liberada manualmente');
assert.equal(getBlockingPhotoIntakeErrors([
  { code: 'invalid', message: 'IMEI inválido' },
  { code: 'duplicate', message: 'IMEIs iguais' },
], true).length, 1);
assert.equal(resolvePhotoIntakeStatus({
  validationErrors: validatePhotoExtraction({ brand: 'Redmi', model: 'Note 14', serial: 'ABC123' }).errors,
  reviewConfirmed: true,
  matchedModelId: 'model-1',
  pricesConfirmed: true,
}), PHOTO_INTAKE_STATUS.REVIEW_REQUIRED, 'IMEI 1 ausente deve continuar bloqueando mesmo após confirmação manual');

const filtered = filterSmartphonesByFeatures([
  { status: 'active', stock_quantity: 2, brand: 'Xiaomi', price_retail: 107000, specs: { nfc: 'Sim', ram: '4GB', storage: '256GB' } },
  { status: 'active', stock_quantity: 3, brand: 'Realme', price_retail: 99000, specs: { nfc: 'Não', ram: '4GB', storage: '256GB' } },
  { status: 'active', stock_quantity: 0, brand: 'Xiaomi', price_retail: 90000, specs: { nfc: 'Sim', ram: '4GB', storage: '256GB' } },
], { nfc: true, storage: '256 gb' });
assert.equal(filtered.length, 1);
assert.equal(filtered[0].brand, 'Xiaomi');

const conflicting = filterSmartphonesByFeatures([
  { id: 'one', model_id: 'model-1', status: 'active', stock_quantity: 1, specs: { nfc: 'Sim', ram: '8GB', storage: '256GB', color: 'Roxo' } },
  { id: 'two', model_id: 'model-1', status: 'active', stock_quantity: 1, specs: { nfc: 'Consulte', ram: '8GB', storage: '256GB', color: 'Roxo' } },
], { nfc: true });
assert.equal(conflicting.length, 0, 'conflicting NFC data must not be advertised as confirmed');

console.log('smartphone photo intake core checks passed');
