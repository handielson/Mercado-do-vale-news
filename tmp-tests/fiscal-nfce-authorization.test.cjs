const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHomologationNfceDraft } = require('../services/fiscalNfceDraft.cjs');
const { authorizationSoap, parseAuthorizationResponse, consultationSoap, parseConsultationResponse,
  AUTHORIZATION_HOMOLOGATION_URL, CONSULTATION_HOMOLOGATION_URL } = require('../services/fiscalNfceAuthorization.cjs');

const draft = buildHomologationNfceDraft({
  issuer: { ufCode:'26', cnpj:'11222333000181', name:'EMPRESA TESTE', stateRegistration:'123456789', address:{ street:'RUA TESTE', number:'10', district:'CENTRO', municipalityCode:'2611101', city:'PETROLINA', state:'PE', postalCode:'56310150' } },
  series:1, number:1, issuedAt:'2026-09-24T14:00:00-03:00', numericCode:12345678, nature:'VENDA',
  items:[{ sku:'A', description:'PRODUTO', ncm:'85444200', cest:'1200700', gtin:'SEM GTIN', unit:'UND', quantity:1, unitPriceCents:500, cfop:'5102', origin:'0', csosn:'400', pisCst:'07', cofinsCst:'07' }],
  payments:[{ method:'01', amountCents:500 }],
});
const accessKey = draft.accessKey;
const lotId = '123';
const signedXml = draft.xml.replace('</NFe>', `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><Reference URI="#NFe${accessKey}"/></SignedInfo></Signature></NFe>`);
const response = (batchStatus, info = '') => `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><cStat>${batchStatus}</cStat><xMotivo>Lote</xMotivo>${info}</retEnviNFe></soap:Body></soap:Envelope>`;
const protocol = (key, environment, status, number = '126260000000001') => `<protNFe><infProt><tpAmb>${environment}</tpAmb><chNFe>${key}</chNFe><dhRecbto>2026-09-24T14:00:03-03:00</dhRecbto><nProt>${number}</nProt><cStat>${status}</cStat><xMotivo>Resultado</xMotivo></infProt></protNFe>`;

test('monta lote síncrono 4.00 com assinatura presente e chave coincidente em homologação', () => {
  assert.match(AUTHORIZATION_HOMOLOGATION_URL, /nfce-homologacao\.svrs\.rs\.gov\.br/);
  const soap = authorizationSoap({ signedXml, accessKey, lotId });
  assert.match(soap, /<indSinc>1<\/indSinc>/);
  assert.match(soap, /<idLote>123<\/idLote>/);
  assert.match(soap, new RegExp(`Id="NFe${accessKey}"`));
  assert.throws(() => authorizationSoap({ signedXml, accessKey:'9'.repeat(44), lotId }), /Chave/);
  assert.throws(() => authorizationSoap({ signedXml:signedXml.replace('<tpAmb>2</tpAmb>', '<tpAmb>1</tpAmb>'), accessKey, lotId }), /incompatível/);
});

test('interpreta autorização somente com protocolo da mesma chave e ambiente', () => {
  const authorized = parseAuthorizationResponse(response('104', protocol(accessKey, '2', '100')), { accessKey, lotId });
  assert.equal(authorized.state, 'authorized');
  assert.equal(authorized.protocol, '126260000000001');
  assert.equal(authorized.authorizedAt, '2026-09-24T14:00:03-03:00');
  assert.equal(parseAuthorizationResponse(response('104', protocol(accessKey, '2', '539')), { accessKey, lotId }).state, 'rejected');
  assert.equal(parseAuthorizationResponse(response('104', protocol(accessKey, '2', '110')), { accessKey, lotId }).state, 'denied');
  assert.throws(() => parseAuthorizationResponse(response('104', protocol('9'.repeat(44), '2', '100')), { accessKey, lotId }), /outra chave/);
  assert.throws(() => parseAuthorizationResponse(response('104', protocol(accessKey, '1', '100')), { accessKey, lotId }), /ambiente/);
});

test('timeout, duplicidade e processamento não são tratados como autorização ou reenvio automático', () => {
  assert.equal(parseAuthorizationResponse(response('103', '<nRec>123456789012345</nRec>'), { accessKey, lotId }).state, 'processing');
  assert.equal(parseAuthorizationResponse(response('204'), { accessKey, lotId }).state, 'unconfirmed');
  assert.equal(parseAuthorizationResponse(response('104'), { accessKey, lotId }).state, 'unconfirmed');
  assert.throws(() => parseAuthorizationResponse('<html>erro</html>', { accessKey, lotId }), /consultar a chave/);
  assert.throws(() => parseAuthorizationResponse(response('104').replace('<tpAmb>2</tpAmb>', '<tpAmb>1</tpAmb>'), { accessKey, lotId }), /consultar a chave/);
});

test('consulta chave modelo 65 no endpoint SVRS de homologação e recupera protocolo correspondente', () => {
  assert.match(CONSULTATION_HOMOLOGATION_URL, /nfce-homologacao\.svrs\.rs\.gov\.br/);
  assert.match(consultationSoap(accessKey), new RegExp(`<chNFe>${accessKey}</chNFe>`));
  const wrap = (status, content = '') => `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><retConsSitNFe><tpAmb>2</tpAmb><cStat>${status}</cStat><xMotivo>Consulta</xMotivo>${content}</retConsSitNFe></soap:Body></soap:Envelope>`;
  const found = parseConsultationResponse(wrap('100', protocol(accessKey, '2', '100')), accessKey);
  assert.equal(found.state, 'authorized');
  assert.equal(found.protocol, '126260000000001');
  assert.equal(parseConsultationResponse(wrap('217'), accessKey).state, 'unconfirmed');
  assert.equal(parseConsultationResponse(wrap('101', protocol(accessKey, '2', '101')), accessKey).state, 'cancelled');
  assert.throws(() => parseConsultationResponse(wrap('100', protocol('9'.repeat(44), '2', '100')), accessKey), /mesma chave/);
  assert.throws(() => parseConsultationResponse(wrap('100').replace('<tpAmb>2</tpAmb>', '<tpAmb>1</tpAmb>'), accessKey), /outro ambiente/);
});
