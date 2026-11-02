const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../services/smartphonePhotoIntakeCore.cjs');

test('validação do front é igual à do servidor e orienta o usuário', async () => {
  const front = await import('../services/deviceIdentifiers.mjs');
  const samples = ['490154203237518', '490154203237517', '356938035643809', '35693803564380', '7891234567895', '7891234567890', '12345670', 'abc', ''];
  for (const value of samples) {
    if (typeof core.isValidImei === 'function') assert.equal(front.isValidImei(value), core.isValidImei(value), `IMEI ${value}`);
    if (typeof core.isValidGtin === 'function') assert.equal(front.isValidGtin(value), core.isValidGtin(value), `GTIN ${value}`);
  }
  assert.equal(front.describeIdentifier('imei', '49015420323751').state, 'incomplete');
  assert.equal(front.describeIdentifier('imei', '490154203237518').state, 'ok');
  assert.equal(front.describeIdentifier('imei', '490154203237517').state, 'invalid');
  assert.equal(front.describeIdentifier('ean', '7891234567895').state, 'ok');
  assert.equal(front.describeIdentifier('ean', '7891234567890').state, 'invalid');
  assert.equal(front.identifierInputProps('imei').inputMode, 'numeric');
  assert.equal(front.identifierInputProps('serial').autoCapitalize, 'characters');
});

test('dica do código de barras e link do aparelho já cadastrado', async () => {
  const front = await import('../services/deviceIdentifiers.mjs');
  assert.equal(front.barcodeHint(null, '1'), null);
  assert.equal(front.barcodeHint({ status: 'unread', barcode: null }, '1'), null);
  assert.deepEqual(front.barcodeHint({ status: 'confirmed', barcode: '865643073183577' }, '865643073183577'), { state: 'match', value: '865643073183577' });
  assert.deepEqual(front.barcodeHint({ status: 'mismatch', barcode: '865643073183577' }, '865643073183517'), { state: 'differs', value: '865643073183577' });
  assert.equal(front.barcodeHint({ barcode: '0074490208440B19' }, '0074490208440b19').state, 'match');
  assert.equal(front.registeredUnitLink({ code: 'already_registered', matched_value: '865643073183577' }), '/admin/serializados?search=865643073183577');
  assert.equal(front.registeredUnitLink({ code: 'required', matched_value: 'x' }), null);
});
