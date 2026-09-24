const test = require('node:test');
const assert = require('node:assert/strict');
const { DOMParser } = require('@xmldom/xmldom');
const { buildHomologationNfceDraft } = require('../services/fiscalNfceDraft.cjs');
const { validateSignedNfceSchema } = require('../services/fiscalNfceSchema.cjs');

const sale = () => ({
  issuer: { ufCode: '26', cnpj: '11222333000181', name: 'EMPRESA TESTE', stateRegistration: '123456789',
    address: { street: 'RUA TESTE', number: '10', district: 'CENTRO', municipalityCode: '2611101', city: 'PETROLINA', state: 'PE', postalCode: '56310150' } },
  series: 1, number: 1, issuedAt: '2026-09-24T14:00:00-03:00', numericCode: 12345678,
  nature: 'VENDA DE MERCADORIA',
  items: [{ sku: 'TESTE-1', description: 'PRODUTO & TESTE', ncm: '85444200', cest: '1200700', gtin: 'SEM GTIN', unit: 'UND', quantity: 2, unitPriceCents: 500,
    cfop: '5102', origin: '0', csosn: '400', pisCst: '07', cofinsCst: '07' }],
  payments: [{ method: '01', amountCents: 1000 }],
});

// Estrutura XMLDSig sintética apenas para XSD. Nunca é assinatura válida ou transmissível.
function schemaOnlySignature(key) {
  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#NFe${key}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>AA==</DigestValue></Reference></SignedInfo><SignatureValue>AA==</SignatureValue><KeyInfo><X509Data><X509Certificate>AA==</X509Certificate></X509Data></KeyInfo></Signature>`;
}

test('rascunho local NFC-e possui chave, totais e ordem aceitos pelo XSD oficial', async () => {
  const draft = buildHomologationNfceDraft(sale());
  assert.equal(draft.totalCents, 1000);
  assert.equal(draft.environment, 'homologation');
  const doc = new DOMParser().parseFromString(draft.xml, 'application/xml');
  assert.equal(doc.getElementsByTagName('infNFe')[0].getAttribute('Id'), `NFe${draft.accessKey}`);
  assert.equal(doc.getElementsByTagName('vNF')[0].textContent, '10.00');
  assert.equal(doc.getElementsByTagName('xProd')[0].textContent, 'PRODUTO & TESTE');
  const structurallySigned = draft.xml.replace('</NFe>', `${schemaOnlySignature(draft.accessKey)}</NFe>`);
  const result = await validateSignedNfceSchema(structurallySigned);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('rascunho bloqueia pagamento divergente, outro tratamento e dados fiscais incompletos', () => {
  const wrongPayment = sale(); wrongPayment.payments[0].amountCents = 999;
  assert.throws(() => buildHomologationNfceDraft(wrongPayment), /diverge/);
  const wrongTax = sale(); wrongTax.items[0].csosn = '102';
  assert.throws(() => buildHomologationNfceDraft(wrongTax), /Tratamento fiscal/);
  const wrongMunicipality = sale(); wrongMunicipality.issuer.address.municipalityCode = '3550308';
  assert.throws(() => buildHomologationNfceDraft(wrongMunicipality), /fora da UF/);
});
