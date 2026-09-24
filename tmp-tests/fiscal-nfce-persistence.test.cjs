const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { buildHomologationNfceDraft } = require('../services/fiscalNfceDraft.cjs');
const { prepareReservedNfce } = require('../services/fiscalNfcePersistence.cjs');

const draft = buildHomologationNfceDraft({
  issuer:{ ufCode:'26', cnpj:'11222333000181', name:'EMPRESA TESTE', stateRegistration:'123456789', address:{ street:'RUA TESTE', number:'10', district:'CENTRO', municipalityCode:'2611101', city:'PETROLINA', state:'PE', postalCode:'56310150' } },
  series:1, number:1, issuedAt:'2026-09-24T14:00:00-03:00', numericCode:12345678, nature:'VENDA',
  items:[{ sku:'A', description:'PRODUTO', ncm:'85444200', cest:'1200700', gtin:'SEM GTIN', unit:'UND', quantity:1, unitPriceCents:500, cfop:'5102', origin:'0', csosn:'400', pisCst:'07', cofinsCst:'07' }],
  payments:[{ method:'01', amountCents:500 }],
});
const issuanceId = '33333333-3333-4333-8333-333333333333';
function fakePool() {
  const state = { id:issuanceId, profile_id:'11111111-1111-4111-8111-111111111111', environment:'homologation', series:1, document_number:1, status:'reserved', access_key:null, signed_xml:null, cnpj:'11222333000181' };
  let commits = 0, rollbacks = 0;
  return { state, counts:()=>({ commits, rollbacks }), async getConnection() { return {
    async beginTransaction() {}, async commit() { commits++; }, async rollback() { rollbacks++; }, release() {},
    async query(sql, params) {
      if (sql.startsWith('SELECT i.id')) return [[state.id === params[0] ? { ...state } : null].filter(Boolean)];
      if (sql.startsWith('UPDATE company_fiscal_nfce_issuances')) { state.status='prepared'; state.access_key=params[0]; state.signed_xml=params[1]; return [{ affectedRows:1 }]; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  }; } };
}
const options = { readCertificate:async () => ({ pfx:Buffer.from('fixture'), password:'fixture' }),
  sign:async value => ({ accessKey:value.accessKey, xml:`<NFe Id="${value.accessKey}"/>` }) };

test('grava a chave e o XML antes da rede; repetição reaproveita exatamente a tentativa', async () => {
  const pool = fakePool();
  const first = await prepareReservedNfce(pool, { issuanceId, draft }, options);
  assert.equal(first.existing, false);
  assert.equal(pool.state.status, 'prepared');
  assert.equal(first.signedXmlSha256, createHash('sha256').update(pool.state.signed_xml).digest('hex'));
  const repeated = await prepareReservedNfce(pool, { issuanceId, draft }, { ...options, sign:async () => { throw new Error('Não deve assinar novamente.'); } });
  assert.equal(repeated.existing, true);
  assert.equal(repeated.signedXmlSha256, first.signedXmlSha256);
  assert.equal(pool.counts().commits, 2);
});

test('não troca chave, empresa, número ou estado de uma tentativa já reservada', async () => {
  const pool = fakePool();
  await assert.rejects(prepareReservedNfce(pool, { issuanceId, draft:{ ...draft, accessKey:'9'.repeat(44) } }, options), /não corresponde/);
  pool.state.document_number = 2;
  await assert.rejects(prepareReservedNfce(pool, { issuanceId, draft }, options), /não corresponde/);
  pool.state.document_number = 1;
  pool.state.status = 'uncertain';
  await assert.rejects(prepareReservedNfce(pool, { issuanceId, draft }, options), /consultar o estado/);
  assert.equal(pool.state.signed_xml, null);
  assert.equal(pool.counts().rollbacks, 3);
});
