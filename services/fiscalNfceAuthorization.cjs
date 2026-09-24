const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { checkDigit } = require('./fiscalNfceAccessKey.cjs');

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const AUTHORIZATION_HOMOLOGATION_URL = 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx';
const AUTHORIZATION_SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote';
const CONSULTATION_HOMOLOGATION_URL = 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx';
const CONSULTATION_SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF';

function parseXml(xml) {
  if (typeof xml !== 'string' || xml.length > 4_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML fiscal inválido ou não permitido.');
  const errors = [];
  const doc = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message); } }).parseFromString(xml, 'application/xml');
  if (errors.length || !doc.documentElement) throw new Error('XML fiscal malformado.');
  return doc;
}
const elements = (node, name) => Array.from(node?.childNodes || []).filter(child => child.nodeType === 1 && child.localName === name);
const one = (node, name) => {
  const found = elements(node, name);
  return found.length === 1 ? found[0] : null;
};
const value = (node, name) => one(node, name)?.textContent?.trim() || '';
const all = (node, name) => Array.from(node?.getElementsByTagName('*') || []).filter(child => child.localName === name);

function authorizationSoap({ signedXml, accessKey, lotId }) {
  if (!/^26\d{42}$/.test(accessKey || '') || accessKey.slice(20, 22) !== '65' || checkDigit(accessKey.slice(0, 43)) !== Number(accessKey[43])) throw new Error('Chave da NFC-e inválida.');
  if (!/^\d{1,15}$/.test(String(lotId || ''))) throw new Error('Lote fiscal inválido.');
  const doc = parseXml(signedXml);
  const nfe = doc.documentElement;
  const inf = one(nfe, 'infNFe');
  const ide = one(inf, 'ide');
  const signature = one(nfe, 'Signature');
  if (nfe.localName !== 'NFe' || nfe.namespaceURI !== NFE_NS || !inf || inf.getAttribute('Id') !== `NFe${accessKey}`
    || value(ide, 'mod') !== '65' || value(ide, 'tpAmb') !== '2' || value(ide, 'tpEmis') !== '1'
    || !signature || all(signature, 'Reference').length !== 1 || all(signature, 'Reference')[0].getAttribute('URI') !== `#NFe${accessKey}`)
    throw new Error('NFC-e assinada de homologação incompatível com o lote.');
  const payload = new XMLSerializer().serializeToString(nfe);
  const batch = `<enviNFe xmlns="${NFE_NS}" versao="4.00"><idLote>${lotId}</idLote><indSinc>1</indSinc>${payload}</enviNFe>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${batch}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

function parseAuthorizationResponse(responseXml, { accessKey, lotId }) {
  if (!/^26\d{42}$/.test(accessKey || '') || !/^\d{1,15}$/.test(String(lotId || ''))) throw new Error('Identidade fiscal inválida.');
  const doc = parseXml(responseXml);
  const returns = all(doc, 'retEnviNFe');
  if (returns.length !== 1) throw new Error('Resposta de autorização não reconhecida; consultar a chave antes de qualquer reenvio.');
  const result = returns[0];
  const environment = value(result, 'tpAmb');
  const status = value(result, 'cStat');
  const reason = value(result, 'xMotivo');
  if (environment !== '2' || !/^\d{3}$/.test(status)) throw new Error('Resposta da SEFAZ incompatível com homologação; consultar a chave.');
  const receipt = value(result, 'nRec');
  if (status === '103' || status === '105') return { state:'processing', status, reason, receipt: /^\d{15}$/.test(receipt) ? receipt : '' };
  if (status !== '104') return { state:'unconfirmed', status, reason, receipt:'' };
  const protocols = elements(result, 'protNFe');
  if (protocols.length !== 1) return { state:'unconfirmed', status, reason:'Lote processado sem protocolo único; consultar a chave.', receipt:'' };
  const info = one(protocols[0], 'infProt');
  const protocolKey = value(info, 'chNFe');
  const protocolEnvironment = value(info, 'tpAmb');
  const documentStatus = value(info, 'cStat');
  const protocol = value(info, 'nProt');
  const authorizedAt = value(info, 'dhRecbto');
  if (protocolKey !== accessKey || protocolEnvironment !== '2') throw new Error('Protocolo da SEFAZ para outra chave ou ambiente; consultar a chave.');
  if (documentStatus === '100' && /^\d{15}$/.test(protocol) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)$/.test(authorizedAt)) {
    return { state:'authorized', status:documentStatus, reason:value(info, 'xMotivo'), protocol, authorizedAt,
      protocolXml:new XMLSerializer().serializeToString(protocols[0]), receipt:'' };
  }
  if (documentStatus === '100') return { state:'unconfirmed', status:documentStatus, reason:'Autorização sem protocolo ou data válidos; consultar a chave.', receipt:'' };
  if (documentStatus === '110') return { state:'denied', status:documentStatus, reason:value(info, 'xMotivo'), receipt:'' };
  return { state:'rejected', status:documentStatus, reason:value(info, 'xMotivo'), receipt:'' };
}

function consultationSoap(accessKey) {
  if (!/^26\d{42}$/.test(accessKey || '') || accessKey.slice(20, 22) !== '65' || checkDigit(accessKey.slice(0, 43)) !== Number(accessKey[43])) throw new Error('Chave da NFC-e inválida.');
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><consSitNFe versao="4.00" xmlns="${NFE_NS}"><tpAmb>2</tpAmb><xServ>CONSULTAR</xServ><chNFe>${accessKey}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

function parseConsultationResponse(responseXml, accessKey) {
  if (!/^26\d{42}$/.test(accessKey || '') || accessKey.slice(20, 22) !== '65') throw new Error('Chave da NFC-e inválida.');
  const doc = parseXml(responseXml);
  const returns = all(doc, 'retConsSitNFe');
  if (returns.length !== 1) throw new Error('Consulta SEFAZ não reconhecida; manter estado incerto.');
  const result = returns[0];
  if (value(result, 'tpAmb') !== '2') throw new Error('Consulta SEFAZ de outro ambiente; manter estado incerto.');
  const status = value(result, 'cStat');
  const reason = value(result, 'xMotivo');
  if (!/^\d{3}$/.test(status)) throw new Error('Consulta SEFAZ sem status válido; manter estado incerto.');
  // 217 não prova que a transmissão original jamais será processada: manter a reserva e investigar.
  if (status !== '100' && status !== '101' && status !== '110') return { state:'unconfirmed', status, reason };
  const protocols = elements(result, 'protNFe');
  const info = protocols.length === 1 ? one(protocols[0], 'infProt') : null;
  if (!info || value(info, 'chNFe') !== accessKey || value(info, 'tpAmb') !== '2') throw new Error('Consulta SEFAZ sem protocolo da mesma chave e ambiente; manter estado incerto.');
  const protocolStatus = value(info, 'cStat');
  const protocol = value(info, 'nProt');
  const authorizedAt = value(info, 'dhRecbto');
  if (status === '100' && protocolStatus === '100' && /^\d{15}$/.test(protocol)
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)$/.test(authorizedAt))
    return { state:'authorized', status, reason, protocol, authorizedAt, protocolXml:new XMLSerializer().serializeToString(protocols[0]) };
  if (status === '101') return { state:'cancelled', status, reason };
  if (status === '110') return { state:'denied', status, reason };
  return { state:'unconfirmed', status, reason };
}

module.exports = { AUTHORIZATION_HOMOLOGATION_URL, AUTHORIZATION_SOAP_ACTION, CONSULTATION_HOMOLOGATION_URL, CONSULTATION_SOAP_ACTION,
  authorizationSoap, parseAuthorizationResponse, consultationSoap, parseConsultationResponse };
