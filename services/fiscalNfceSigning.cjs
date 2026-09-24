const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { checkDigit } = require('./fiscalNfceAccessKey.cjs');
const { validateSignedNfceSchema } = require('./fiscalNfceSchema.cjs');
const { inspectPfx } = require('./fiscalCertificateVault.cjs');

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const CANONICAL = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const DIGEST = 'http://www.w3.org/2000/09/xmldsig#sha1';
// Portal oficial da SEFAZ-PE para NFC-e; QR Code online v3 da NT 2025.001.
const QUERY_URL = 'http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta';
const KEY_URL = 'http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta';

function children(node, name) {
  return Array.from(node?.childNodes || []).filter(child => child.nodeType === 1 && child.localName === name && child.namespaceURI === NFE_NS);
}

function signingMaterial(pfx, password) {
  if (!Buffer.isBuffer(pfx) || !pfx.length || typeof password !== 'string') throw new Error('A1 inválido.');
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), false, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  for (const certificate of certBags) for (const bag of keyBags) {
    if (certificate.cert?.publicKey?.n?.toString(16) === bag.key?.n?.toString(16)) {
      return { privateKey: forge.pki.privateKeyToPem(bag.key), publicCert: forge.pki.certificateToPem(certificate.cert) };
    }
  }
  throw new Error('Certificado e chave privada do A1 não correspondem.');
}

function prepareOnlineHomologationXml(draft) {
  const xml = draft?.xml;
  if (typeof xml !== 'string' || xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Rascunho XML inválido.');
  const errors = [];
  const doc = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message); } }).parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  const inf = children(root, 'infNFe');
  const ide = children(inf[0], 'ide');
  const field = name => children(ide[0], name)[0]?.textContent;
  const key = draft.accessKey;
  if (errors.length || root?.localName !== 'NFe' || root.namespaceURI !== NFE_NS || inf.length !== 1 || ide.length !== 1
    || children(root, 'infNFeSupl').length || root.getElementsByTagName('Signature').length
    || !/^26\d{42}$/.test(key) || key.slice(20, 22) !== '65' || checkDigit(key.slice(0, 43)) !== Number(key[43])
    || inf[0].getAttribute('Id') !== `NFe${key}` || inf[0].getAttribute('versao') !== '4.00'
    || field('mod') !== '65' || field('tpAmb') !== '2' || field('tpEmis') !== '1'
    || children(inf[0], 'emit')[0]?.getElementsByTagName('CNPJ')[0]?.textContent !== key.slice(6, 20)
    || draft.environment !== 'homologation') throw new Error('Somente rascunho NFC-e online de PE em homologação pode ser assinado.');
  const qrCode = `${QUERY_URL}?p=${key}|3|2`;
  const supplement = `<infNFeSupl><qrCode>${qrCode}</qrCode><urlChave>${KEY_URL}</urlChave></infNFeSupl>`;
  return { xml: xml.replace('</infNFe></NFe>', `</infNFe>${supplement}</NFe>`), qrCode, accessKey: key };
}

async function signHomologationNfce(draft, pfx, password) {
  const prepared = prepareOnlineHomologationXml(draft);
  const metadata = inspectPfx(pfx, password);
  if (metadata.cnpj !== prepared.accessKey.slice(6, 20)) throw new Error('CNPJ do A1 incompatível com o emitente da NFC-e.');
  const today = new Date().toISOString().slice(0, 10);
  if (today < metadata.validFrom || today > metadata.validUntil) throw new Error('A1 fora da validade nesta data.');
  const material = signingMaterial(pfx, password);
  const signer = new SignedXml({ privateKey: material.privateKey, publicCert: material.publicCert,
    signatureAlgorithm: SIGNATURE, canonicalizationAlgorithm: CANONICAL });
  signer.addReference({ xpath: "//*[local-name()='infNFe']", transforms: [ENVELOPED, CANONICAL], digestAlgorithm: DIGEST });
  signer.computeSignature(prepared.xml, { location: { reference: "//*[local-name()='NFe']", action: 'append' } });
  const xml = signer.getSignedXml();
  const verified = await verifyHomologationNfce(xml, prepared.accessKey, pfx, password);
  return { xml, accessKey: prepared.accessKey, qrCode: prepared.qrCode, schemaPackage: verified.schemaPackage };
}

async function verifyHomologationNfce(xml, accessKey, pfx, password) {
  if (typeof xml !== 'string' || xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML assinado inválido ou não permitido.');
  if (!/^26\d{42}$/.test(accessKey || '') || checkDigit(accessKey.slice(0, 43)) !== Number(accessKey[43])) throw new Error('Chave da NFC-e inválida.');
  const metadata = inspectPfx(pfx, password);
  if (metadata.cnpj !== accessKey.slice(6, 20)) throw new Error('CNPJ do A1 incompatível com o emitente da NFC-e.');
  const today = new Date().toISOString().slice(0, 10);
  if (today < metadata.validFrom || today > metadata.validUntil) throw new Error('A1 fora da validade nesta data.');
  const material = signingMaterial(pfx, password);
  const signatures = new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('Signature');
  if (signatures.length !== 1) throw new Error('Assinatura da NFC-e não foi gerada.');
  const verifier = new SignedXml({ publicCert: material.publicCert });
  verifier.loadSignature(signatures[0]);
  if (!verifier.checkSignature(xml)) throw new Error('Assinatura local da NFC-e não foi validada.');
  const schema = await validateSignedNfceSchema(xml);
  if (!schema.valid) throw new Error(`NFC-e assinada não atende ao XSD oficial: ${schema.errors[0] || 'erro desconhecido'}`);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (children(doc.documentElement, 'infNFe')[0]?.getAttribute('Id') !== `NFe${accessKey}`) throw new Error('XML assinado não corresponde à chave persistida.');
  return { schemaPackage:schema.schemaPackage };
}

module.exports = { prepareOnlineHomologationXml, signHomologationNfce, verifyHomologationNfce };
