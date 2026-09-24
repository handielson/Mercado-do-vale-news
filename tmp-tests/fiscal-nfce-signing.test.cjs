const test = require('node:test');
const assert = require('node:assert/strict');
const forge = require('node-forge');
const { DOMParser } = require('@xmldom/xmldom');
const { SignedXml } = require('xml-crypto');
const { buildHomologationNfceDraft } = require('../services/fiscalNfceDraft.cjs');
const { prepareOnlineHomologationXml, signHomologationNfce } = require('../services/fiscalNfceSigning.cjs');

const cnpj = '11222333000181';
const sale = () => ({
  issuer: { ufCode:'26', cnpj, name:'EMPRESA TESTE', stateRegistration:'123456789',
    address: { street:'RUA TESTE', number:'10', district:'CENTRO', municipalityCode:'2611101', city:'PETROLINA', state:'PE', postalCode:'56310150' } },
  series:1, number:1, issuedAt:'2026-09-24T14:00:00-03:00', numericCode:12345678, nature:'VENDA DE MERCADORIA',
  items:[{ sku:'TESTE-1', description:'PRODUTO TESTE', ncm:'85444200', cest:'1200700', gtin:'SEM GTIN', unit:'UND', quantity:1, unitPriceCents:500,
    cfop:'5102', origin:'0', csosn:'400', pisCst:'07', cofinsCst:'07' }],
  payments:[{ method:'01', amountCents:500 }],
});

function pfxFixture(subjectCnpj = cnpj, expires = '2027-01-01T00:00:00Z') {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2025-01-01T00:00:00Z');
  cert.validity.notAfter = new Date(expires);
  cert.setSubject([{ name:'commonName', value:`EMPRESA TESTE:${subjectCnpj}` }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'senha-teste', { algorithm:'3des' })).getBytes(), 'binary');
}

test('NFC-e online v3 em homologação tem QR Code, assinatura A1 verificável e XSD oficial válido', async () => {
  const draft = buildHomologationNfceDraft(sale());
  const result = await signHomologationNfce(draft, pfxFixture(), 'senha-teste');
  assert.equal(result.qrCode, `http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta?p=${draft.accessKey}|3|2`);
  assert.equal(result.schemaPackage, 'PL_010f_v1.04');
  const doc = new DOMParser().parseFromString(result.xml, 'application/xml');
  const signature = doc.getElementsByTagName('Signature')[0];
  assert.equal(doc.getElementsByTagName('qrCode')[0].textContent, result.qrCode);
  assert.equal(signature.getElementsByTagName('Reference')[0].getAttribute('URI'), `#NFe${draft.accessKey}`);
  const encodedCert = signature.getElementsByTagName('X509Certificate')[0].textContent.replace(/\s/g, '');
  const publicCert = `-----BEGIN CERTIFICATE-----\n${encodedCert.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
  const verifier = new SignedXml({ publicCert });
  verifier.loadSignature(signature);
  assert.equal(verifier.checkSignature(result.xml), true);
  assert(result.xml.indexOf('</infNFeSupl>') < result.xml.indexOf('<Signature'));
});

test('assinatura bloqueia documento de outro ambiente, emitente ou chave', () => {
  const draft = buildHomologationNfceDraft(sale());
  assert.throws(() => prepareOnlineHomologationXml({ ...draft, xml:draft.xml.replace('<tpAmb>2</tpAmb>', '<tpAmb>1</tpAmb>') }), /homologação/);
  assert.throws(() => prepareOnlineHomologationXml({ ...draft, accessKey:'2'.repeat(44) }), /homologação/);
  assert.throws(() => prepareOnlineHomologationXml({ ...draft, xml:draft.xml.replace(`<CNPJ>${cnpj}</CNPJ>`, '<CNPJ>34719515000168</CNPJ>') }), /homologação/);
});

test('assinatura recusa A1 de outro CNPJ ou vencido', async () => {
  const draft = buildHomologationNfceDraft(sale());
  await assert.rejects(signHomologationNfce(draft, pfxFixture('34719515000168'), 'senha-teste'), /CNPJ do A1/);
  await assert.rejects(signHomologationNfce(draft, pfxFixture(cnpj, '2026-01-01T00:00:00Z'), 'senha-teste'), /validade/);
});
