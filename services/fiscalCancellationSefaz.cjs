const crypto = require('node:crypto');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const vault = require('./fiscalCertificateVault.cjs');

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const CANONICAL = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const DIGEST = 'http://www.w3.org/2000/09/xmldsig#sha1';
const EVENT_TYPE = '110111';
const SEFAZ_PE_EVENT = {
  production: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
  homologation: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
};

function xmlText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[char]);
}

function validateCancellationEvent({ accessKey, cnpj, authorizationProtocol, justification, environment, occurredAt }) {
  const key = String(accessKey || '');
  const issuer = String(cnpj || '').replace(/\D/g, '');
  const protocol = String(authorizationProtocol || '');
  const reason = String(justification || '').trim();
  const when = new Date(occurredAt);
  if (!/^26\d{42}$/.test(key) || key.slice(20, 22) !== '55' || key.slice(6, 20) !== issuer) throw new Error('Chave de NF-e de PE incompatível com o emitente.');
  if (!/^\d{15}$/.test(protocol)) throw new Error('Protocolo de autorização inválido.');
  if (reason.length < 15 || reason.length > 255 || /[\u0000-\u001f\u007f]/u.test(reason)) throw new Error('Justificativa fiscal inválida.');
  if (!['production', 'homologation'].includes(environment)) throw new Error('Ambiente fiscal inválido.');
  if (!Number.isFinite(when.getTime())) throw new Error('Data do evento inválida.');
  return { key, issuer, protocol, reason, when };
}

function unsignedCancellationEvent(input) {
  const { key, issuer, protocol, reason, when } = validateCancellationEvent(input);
  const tpAmb = input.environment === 'production' ? '1' : '2';
  const eventId = `ID${EVENT_TYPE}${key}01`;
  const lotId = String(input.lotId || crypto.randomInt(1, 1_000_000_000_000_000));
  if (!/^\d{1,15}$/.test(lotId)) throw new Error('Identificador do lote inválido.');
  const xml = `<envEvento xmlns="${NFE_NS}" versao="1.00"><idLote>${lotId}</idLote><evento versao="1.00"><infEvento Id="${eventId}"><cOrgao>26</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${issuer}</CNPJ><chNFe>${key}</chNFe><dhEvento>${when.toISOString().replace('.000Z', 'Z')}</dhEvento><tpEvento>${EVENT_TYPE}</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocol}</nProt><xJust>${xmlText(reason)}</xJust></detEvento></infEvento></evento></envEvento>`;
  return { xml, eventId, lotId };
}

function signingMaterial(pfx, password) {
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

function signCancellationEvent(unsignedXml, pfx, password) {
  const material = signingMaterial(pfx, password);
  const signer = new SignedXml({ privateKey: material.privateKey, publicCert: material.publicCert,
    signatureAlgorithm: SIGNATURE, canonicalizationAlgorithm: CANONICAL });
  signer.addReference({ xpath: "//*[local-name()='infEvento']", transforms: [ENVELOPED, CANONICAL], digestAlgorithm: DIGEST });
  signer.computeSignature(unsignedXml, { location: { reference: "//*[local-name()='infEvento']", action: 'after' } });
  const xml = signer.getSignedXml();
  const signatureNode = new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('Signature')[0];
  if (!signatureNode) throw new Error('Assinatura do evento não foi gerada.');
  const verifier = new SignedXml({ publicCert: material.publicCert });
  verifier.loadSignature(signatureNode);
  if (!verifier.checkSignature(xml)) throw new Error('Assinatura local do evento não foi validada.');
  return xml;
}

function eventSoap(signedXml) {
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${signedXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

function parseCancellationResponse(body, { accessKey, environment }) {
  const xml = String(body || '');
  const batch = xml.match(/<(?:\w+:)?retEnvEvento\b[^>]*>([\s\S]*?)<\/(?:\w+:)?retEnvEvento>/i)?.[1] || '';
  const event = batch.match(/<(?:\w+:)?retEvento\b[^>]*>([\s\S]*?)<\/(?:\w+:)?retEvento>/i)?.[1] || '';
  const info = event.match(/<(?:\w+:)?infEvento\b[^>]*>([\s\S]*?)<\/(?:\w+:)?infEvento>/i)?.[1] || '';
  if (!batch || vault.xmlValue(batch, 'tpAmb') !== (environment === 'production' ? '1' : '2')) throw new Error('Resposta do lote fiscal inválida.');
  const batchStatus = vault.xmlValue(batch, 'cStat');
  const eventStatus = vault.xmlValue(info, 'cStat');
  const matched = vault.xmlValue(info, 'chNFe') === accessKey && vault.xmlValue(info, 'tpEvento') === EVENT_TYPE &&
    vault.xmlValue(info, 'nSeqEvento') === '1' && vault.xmlValue(info, 'tpAmb') === (environment === 'production' ? '1' : '2');
  const protocol = matched ? vault.xmlValue(info, 'nProt') : '';
  return { batchStatus, eventStatus, reason: vault.xmlValue(info, 'xMotivo') || vault.xmlValue(batch, 'xMotivo'),
    protocol, accepted: batchStatus === '128' && matched && /^\d{15}$/.test(protocol) && ['135', '155'].includes(eventStatus) };
}

async function transmitCancellationEvent(profileId, input, options = {}) {
  const { xml: unsignedXml, eventId, lotId } = unsignedCancellationEvent(input);
  const stored = await vault.readCertificate(profileId, options);
  const metadata = vault.inspectPfx(stored.pfx, stored.password);
  if (metadata.cnpj !== String(input.cnpj || '').replace(/\D/g, '')) throw new Error('CNPJ do A1 incompatível com o emitente.');
  const today = new Date().toISOString().slice(0, 10);
  if (today < metadata.validFrom || today > metadata.validUntil) throw new Error('A1 fora da validade nesta data.');
  const signedXml = signCancellationEvent(unsignedXml, stored.pfx, stored.password);
  const endpoint = (options.endpoints || SEFAZ_PE_EVENT)[input.environment];
  const response = await (options.request || vault.requestSoap)(endpoint, eventSoap(signedXml), stored.pfx, stored.password,
    'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento');
  const result = parseCancellationResponse(response.body, input);
  return { ...result, accepted: response.statusCode === 200 && result.accepted,
    httpStatus: response.statusCode, eventId, lotId, signedXml, responseXml: response.body };
}

module.exports = { EVENT_TYPE, SEFAZ_PE_EVENT, unsignedCancellationEvent, signCancellationEvent, eventSoap, parseCancellationResponse, transmitCancellationEvent };
