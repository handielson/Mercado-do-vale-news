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
