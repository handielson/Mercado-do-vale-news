const test = require('node:test');
const assert = require('node:assert/strict');
const forge = require('node-forge');
const { buildHomologationNfceDraft } = require('../services/fiscalNfceDraft.cjs');
const { signHomologationNfce } = require('../services/fiscalNfceSigning.cjs');
const { transmitPreparedNfce, reconcileNfceByKey } = require('../services/fiscalNfceTransmission.cjs');
const { parseNfceProcForDanfe } = require('../services/danfeNfceCore.cjs');

const id = '33333333-3333-4333-8333-333333333333';
const cnpj = '11222333000181';
function pfxFixture() {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate(); cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2025-01-01T00:00:00Z'); cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  cert.setSubject([{ name:'commonName', value:`EMPRESA TESTE:${cnpj}` }]); cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'senha-teste', { algorithm:'3des' })).getBytes(), 'binary');
}
const draft = buildHomologationNfceDraft({
  issuer:{ ufCode:'26', cnpj, name:'EMPRESA TESTE', stateRegistration:'123456789', address:{ street:'RUA TESTE', number:'10', district:'CENTRO', municipalityCode:'2611101', city:'PETROLINA', state:'PE', postalCode:'56310150' } },
  series:1, number:1, issuedAt:'2026-09-24T14:00:00-03:00', numericCode:12345678, nature:'VENDA',
  items:[{ sku:'A', description:'PRODUTO', ncm:'85444200', cest:'1200700', gtin:'SEM GTIN', unit:'UND', quantity:1, unitPriceCents:500, cfop:'5102', origin:'0', csosn:'400', pisCst:'07', cofinsCst:'07' }],
  payments:[{ method:'01', amountCents:500 }],
});
let fixture;
async function signedFixture() {
  if (!fixture) {
    const pfx = pfxFixture();
    fixture = { pfx, signed:await signHomologationNfce(draft, pfx, 'senha-teste') };
  }
  return fixture;
}
function fakePool(signedXml) {
  const row = { id, profile_id:'11111111-1111-4111-8111-111111111111', environment:'homologation', status:'prepared', access_key:draft.accessKey, signed_xml:signedXml,
    authorized_xml:null, sefaz_response_xml:null, authorization_protocol:null, last_error:null };
  return { row, async query(sql, params) {
    if (sql.startsWith('SELECT id,profile_id')) return [[row.id === params[0] ? { ...row } : null].filter(Boolean)];
    if (sql.includes("SET status='sending'")) { const ok = row.status === 'prepared'; if (ok) row.status='sending'; return [{ affectedRows:ok ? 1 : 0 }]; }
    if (sql.includes("SET status='uncertain'")) { if (['sending','uncertain'].includes(row.status)) { row.status='uncertain'; row.last_error=params[0]; } return [{ affectedRows:1 }]; }
    if (sql.includes('SET status=?,sefaz_response_xml=?')) {
      if (!['sending','uncertain'].includes(row.status)) return [{ affectedRows:0 }];
      Object.assign(row, { status:params[0], sefaz_response_xml:params[1], authorized_xml:params[2], authorized_xml_sha256:params[3], authorization_protocol:params[4], authorized_at:params[5], last_error:params[6] });
      return [{ affectedRows:1 }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
}
const protocol = key => `<protNFe xmlns="http://www.portalfiscal.inf.br/nfe"><infProt><tpAmb>2</tpAmb><chNFe>${key}</chNFe><dhRecbto>2026-09-24T14:00:03-03:00</dhRecbto><nProt>126260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infProt></protNFe>`;
const authorizationResponse = key => `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><retEnviNFe><tpAmb>2</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo>${protocol(key)}</retEnviNFe></soap:Body></soap:Envelope>`;
const consultationResponse = key => `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><retConsSitNFe><tpAmb>2</tpAmb><cStat>100</cStat><xMotivo>Autorizado</xMotivo>${protocol(key)}</retConsSitNFe></soap:Body></soap:Envelope>`;
const options = pfx => ({ readCertificate:async () => ({ pfx, password:'senha-teste' }) });

test('envio mTLS simulado confirma autorização, persiste nfeProc e permite DANFE', async () => {
  const { pfx, signed } = await signedFixture();
  const pool = fakePool(signed.xml);
  const result = await transmitPreparedNfce(pool, id, { ...options(pfx), request:async (url, soap, cert, password, action) => {
    assert.match(url, /nfce-homologacao/); assert.match(soap, /<indSinc>1<\/indSinc>/);
    assert.equal(cert, pfx); assert.equal(password, 'senha-teste'); assert.match(action, /nfeAutorizacaoLote$/);
    assert.equal(pool.row.status, 'sending');
    return { statusCode:200, body:authorizationResponse(draft.accessKey) };
  } });
  assert.equal(result.state, 'authorized');
  assert.equal(pool.row.authorization_protocol, '126260000000001');
  assert.equal(parseNfceProcForDanfe(pool.row.authorized_xml).key, draft.accessKey);
  assert.match(pool.row.authorized_xml_sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(transmitPreparedNfce(pool, id, { ...options(pfx), request:async () => { throw new Error('Não pode reenviar.'); } }), /não reenviar/);
});

test('timeout mantém a chave incerta e consulta recupera sem reenviar', async () => {
  const { pfx, signed } = await signedFixture();
  const pool = fakePool(signed.xml);
  const timedOut = await transmitPreparedNfce(pool, id, { ...options(pfx), request:async () => { throw new Error('timeout'); } });
  assert.equal(timedOut.state, 'uncertain');
  assert.equal(pool.row.access_key, draft.accessKey);
  await assert.rejects(transmitPreparedNfce(pool, id, options(pfx)), /não reenviar/);
  const recovered = await reconcileNfceByKey(pool, id, { ...options(pfx), request:async (url, soap, cert, password, action) => {
    assert.match(url, /NfeConsulta/); assert.match(soap, /CONSULTAR/); assert.equal(cert, pfx);
    assert.equal(password, 'senha-teste'); assert.match(action, /nfeConsultaNF$/);
    return { statusCode:200, body:consultationResponse(draft.accessKey) };
  } });
  assert.equal(recovered.state, 'authorized');
  assert.equal(parseNfceProcForDanfe(pool.row.authorized_xml).protocol, '126260000000001');
});

test('protocolo de outra chave ou ausência da nota não vira autorização', async () => {
  const { pfx, signed } = await signedFixture();
  const pool = fakePool(signed.xml);
  const wrong = await transmitPreparedNfce(pool, id, { ...options(pfx), request:async () => ({ statusCode:200, body:authorizationResponse('9'.repeat(44)) }) });
  assert.equal(wrong.state, 'uncertain'); assert.equal(pool.row.authorized_xml, null);
  const missing = await reconcileNfceByKey(pool, id, { ...options(pfx), request:async () => ({ statusCode:200,
    body:'<retConsSitNFe><tpAmb>2</tpAmb><cStat>217</cStat><xMotivo>Não consta</xMotivo></retConsSitNFe>' }) });
  assert.equal(missing.state, 'uncertain'); assert.equal(pool.row.status, 'uncertain');
});

test('XML persistido adulterado é bloqueado antes de qualquer chamada à SEFAZ', async () => {
  const { pfx, signed } = await signedFixture();
  const pool = fakePool(signed.xml.replace('PRODUTO', 'ALTERADO'));
  let calls = 0;
  const result = await transmitPreparedNfce(pool, id, { ...options(pfx), request:async () => { calls++; throw new Error('Não deveria chegar à rede.'); } });
  assert.equal(calls, 0);
  assert.equal(result.state, 'uncertain');
  assert.equal(pool.row.authorized_xml, null);
});

test('denegação conserva estado próprio e não libera DANFE', async () => {
  const { pfx, signed } = await signedFixture();
  const pool = fakePool(signed.xml);
  const deniedProtocol = protocol(draft.accessKey).replace('<cStat>100</cStat>', '<cStat>110</cStat>');
  const result = await transmitPreparedNfce(pool, id, { ...options(pfx), request:async () => ({ statusCode:200,
    body:`<retEnviNFe><tpAmb>2</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo>${deniedProtocol}</retEnviNFe>` }) });
  assert.equal(result.state, 'denied');
  assert.equal(pool.row.status, 'denied');
  assert.equal(pool.row.authorized_xml, null);
});

test('duas chamadas simultâneas não transmitem a mesma NFC-e duas vezes', async () => {
  const { pfx, signed } = await signedFixture();
  const pool = fakePool(signed.xml);
  let sends = 0;
  const send = () => transmitPreparedNfce(pool, id, { ...options(pfx), request:async () => {
    sends++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return { statusCode:200, body:authorizationResponse(draft.accessKey) };
  } });
  const results = await Promise.allSettled([send(), send()]);
  assert.equal(results.filter(result => result.status === 'fulfilled' && result.value.state === 'authorized').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(sends, 1);
});
