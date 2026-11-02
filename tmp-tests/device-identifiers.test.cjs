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

test('leitor da câmera escolhe o valor certo para cada campo', async () => {
  const { pickScannedValues } = await import('../services/deviceIdentifiers.mjs');
  const reads = [
    { text: '6941764465282', y: 300 },
    { text: '865643073183569', y: 200 },
    { text: '865643073183577', y: 100 },
    { text: '183577', y: 50 },
    { text: '0074490208440B19', y: 250 },
    { text: '865643073183578', y: 90 },
  ];
  assert.deepEqual(pickScannedValues('imei', reads), ['865643073183577', '865643073183569'], 'IMEIs válidos de cima para baixo');
  assert.deepEqual(pickScannedValues('ean', reads), ['6941764465282']);
  assert.deepEqual(pickScannedValues('serial', reads), ['0074490208440B19'], 'serial não pode pegar IMEI/EAN/lixo curto');
  assert.deepEqual(pickScannedValues('imei', [{ text: 'IMEI1:865643073183577 IMEI2:865643073183569' }]), ['865643073183577', '865643073183569'], 'DataMatrix com os dois');
  assert.deepEqual(pickScannedValues('imei', []), []);
});
