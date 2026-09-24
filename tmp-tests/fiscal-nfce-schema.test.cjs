const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSignedNfceSchema, SCHEMA_PACKAGE } = require('../services/fiscalNfceSchema.cjs');

const partial = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe26260611222333000181650010000000011000000017" versao="4.00"><ide><mod>65</mod></ide></infNFe></NFe>';

test('esquema oficial recusa NFC-e incompleta', async () => {
  const result = await validateSignedNfceSchema(partial);
  assert.equal(result.schemaPackage, SCHEMA_PACKAGE);
  assert.equal(result.valid, false);
  assert(result.errors.length > 0);
});

test('não valida XML com entidade externa ou outro modelo', async () => {
  await assert.rejects(validateSignedNfceSchema('<!DOCTYPE NFe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + partial), /não permitido/);
  await assert.rejects(validateSignedNfceSchema(partial.replace('<mod>65</mod>', '<mod>55</mod>')), /modelo 65/);
});
