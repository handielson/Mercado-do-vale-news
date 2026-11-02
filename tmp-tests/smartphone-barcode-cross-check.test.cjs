'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyBarcodeItems, crossCheckIdentifiers, isBarcodeIssue } = require('../services/smartphoneBarcodeCrossCheck.cjs');
const { describeRegisteredUnit, getBlockingPhotoIntakeErrors } = require('../services/smartphonePhotoIntakeCore.cjs');

// Etiqueta real (Realme C71): IMEIs em Code128, EAN-13 e DataMatrix com sufixo.
const LABEL_ITEMS = [
  { text: '183577', format: 'DataMatrix', y: 1198 },
  { text: '865643073183577', format: 'Code128', y: 1271 },
  { text: '865643073183569', format: 'Code128', y: 1367 },
  { text: '6941764465282', format: 'EAN13', y: 1486 },
];
const IMEI1 = '865643073183577';
const IMEI2 = '865643073183569';
const EAN = '6941764465282';

test('classifica IMEIs válidos, EAN e ignora lixo', () => {
  const classified = classifyBarcodeItems([...LABEL_ITEMS, { text: '865643073183578', format: 'Code128', y: 1 }]);
  assert.deepEqual(classified.imeis, [IMEI1, IMEI2]);
  assert.deepEqual(classified.eans, [EAN]);
});

test('acha IMEIs dentro de DataMatrix com vários números', () => {
  const classified = classifyBarcodeItems([{ text: `IMEI1:${IMEI1};IMEI2:${IMEI2}`, format: 'DataMatrix', y: 0 }]);
  assert.deepEqual(classified.imeis, [IMEI1, IMEI2]);
});

test('confirma quando a IA leu igual às barras (sem avisos)', () => {
  const barcode = classifyBarcodeItems(LABEL_ITEMS);
  const result = crossCheckIdentifiers({ imei1: IMEI1, imei2: IMEI2, ean: EAN }, barcode);
  assert.equal(result.fields.imei1.status, 'confirmed');
  assert.equal(result.fields.imei2.status, 'confirmed');
  assert.equal(result.fields.ean.status, 'confirmed');
  assert.equal(result.warnings.length, 0);
});

test('IMEIs trocados entre os campos continuam confirmados', () => {
  const result = crossCheckIdentifiers({ imei1: IMEI2, imei2: IMEI1, ean: EAN }, classifyBarcodeItems(LABEL_ITEMS));
  assert.equal(result.warnings.length, 0);
});

test('dígito errado da IA vira aviso com a sugestão das barras, sem sobrescrever', () => {
  const value = { imei1: '865643073183517', imei2: IMEI2, ean: EAN };
  const result = crossCheckIdentifiers(value, classifyBarcodeItems(LABEL_ITEMS));
  assert.equal(result.fields.imei1.status, 'mismatch');
  assert.equal(result.fields.imei1.barcode, IMEI1);
  assert.equal(value.imei1, '865643073183517', 'não pode alterar o valor da IA');
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, 'barcode_mismatch');
  assert.equal(result.warnings[0].barcode_value, IMEI1);
  assert.ok(isBarcodeIssue(result.warnings[0]));
});

test('IA não leu: sugere pela ordem da etiqueta sem repetir IMEI', () => {
  const result = crossCheckIdentifiers({ imei1: null, imei2: null, ean: null }, classifyBarcodeItems(LABEL_ITEMS));
  assert.equal(result.fields.imei1.barcode, IMEI1);
  assert.equal(result.fields.imei2.barcode, IMEI2);
  assert.equal(result.fields.ean.barcode, EAN);
  assert.ok(result.warnings.every((issue) => issue.code === 'barcode_only'));
});

test('aparelho de um chip: não inventa IMEI 2', () => {
  const result = crossCheckIdentifiers({ imei1: IMEI1, imei2: null }, classifyBarcodeItems([LABEL_ITEMS[1]]));
  assert.equal(result.fields.imei2.status, 'unread');
  assert.equal(result.warnings.length, 0);
});

test('barras não lidas não geram aviso', () => {
  const result = crossCheckIdentifiers({ imei1: IMEI1, imei2: IMEI2, ean: EAN }, { imeis: [], eans: [], texts: [] });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.fields.imei1.status, 'unread');
});

test('aviso de já cadastrado diz campo, data, status e produto e continua bloqueando', () => {
  const issue = describeRegisteredUnit(
    { id: 'u1', status: 'sold', created_at: new Date('2026-08-05T19:54:21Z'), imei_1: IMEI1, imei_2: IMEI2, serial: '0074490208440B19', product_name: 'Realme C71' },
    { imei1: IMEI1, imei2: IMEI2, serial: '0074490208440b19' },
  );
  assert.equal(issue.message, 'IMEI 1 já cadastrado em 05/08/2026 — vendido (Realme C71)');
  assert.equal(issue.code, 'already_registered');
  assert.equal(issue.unit_id, 'u1');
  assert.equal(issue.matched_value, IMEI1);
  assert.equal(getBlockingPhotoIntakeErrors([issue], true).length, 1, 'duplicado não pode ser liberado na conferência');
});

test('aviso de já cadastrado aponta o serial quando só ele bate', () => {
  const issue = describeRegisteredUnit({ id: 'u2', status: 'available', created_at: '2026-10-01 10:00:00', serial: 'ABC123' }, { imei1: '1', serial: 'abc123' });
  assert.equal(issue.field, 'serial');
  assert.match(issue.message, /^Serial já cadastrado em 01\/10\/2026 — disponível$/);
});
