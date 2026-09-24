const test = require('node:test');
const assert = require('node:assert/strict');
const { makeNfceAccessKey } = require('../services/fiscalNfceAccessKey.cjs');

test('compõe chave modelo 65 com dígito verificador e separa série/número', () => {
  const result = makeNfceAccessKey({ ufCode: '26', issuedAt: '2026-06-10T12:41:28-03:00', cnpj: '34719515000168', series: 1, number: 39, numericCode: 12345678 });
  assert.equal(result.key.length, 44);
  assert.equal(result.key.slice(20, 22), '65');
  assert.equal(result.key.slice(22, 25), '001');
  assert.equal(result.key.slice(25, 34), '000000039');
  assert.equal(result.key.slice(35, 43), '12345678');
  assert.throws(() => makeNfceAccessKey({ ufCode: '26', issuedAt: '2026-06-10', cnpj: '34719515000168', series: 1, number: 0 }), /Data|Identidade/);
});
