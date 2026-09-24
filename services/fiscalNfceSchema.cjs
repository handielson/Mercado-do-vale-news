const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('@xmldom/xmldom');
const { validateXML } = require('xmllint-wasm');

const SCHEMA_PACKAGE = 'PL_010f_v1.04';
const schemaDir = path.join(__dirname, '..', 'schemas', 'nfe', SCHEMA_PACKAGE);
const xsdNames = [
  'nfe_v4.00.xsd',
  'leiauteNFe_v4.00.xsd',
  'tiposBasico_v4.00.xsd',
  'DFeTiposBasicos_v1.00.xsd',
  'xmldsig-core-schema_v1.01.xsd',
];
let sourceFiles;

function schemas() {
  if (!sourceFiles) sourceFiles = xsdNames.map(fileName => ({ fileName, contents: fs.readFileSync(path.join(schemaDir, fileName), 'utf8') }));
  return sourceFiles;
}

/** Valida a NFe assinada modelo 65 no pacote oficial fixado. Não substitui autorização da SEFAZ. */
async function validateSignedNfceSchema(xml) {
  if (typeof xml !== 'string' || xml.length < 100 || xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML da NFC-e inválido ou não permitido.');
  const parseErrors = [];
  const document = new DOMParser({ onError: (level, message) => { if (level !== 'warning') parseErrors.push(message); } }).parseFromString(xml, 'application/xml');
  const root = document.documentElement;
  const inf = Array.from(root?.childNodes || []).find(node => node.nodeType === 1 && node.localName === 'infNFe');
  const ide = Array.from(inf?.childNodes || []).find(node => node.nodeType === 1 && node.localName === 'ide');
  const model = Array.from(ide?.childNodes || []).find(node => node.nodeType === 1 && node.localName === 'mod')?.textContent;
  if (parseErrors.length || root?.localName !== 'NFe' || root.namespaceURI !== 'http://www.portalfiscal.inf.br/nfe' || model !== '65') throw new Error('Exige NFe assinada do modelo 65.');
  const [main, ...preload] = schemas();
  const result = await validateXML({ xml: [{ fileName: 'nfce.xml', contents: xml }], schema: [main], preload });
  return { valid: result.valid, schemaPackage: SCHEMA_PACKAGE, errors: result.errors.map(error => String(error.message || 'XML não atende ao XSD.')).slice(0, 20) };
}

module.exports = { SCHEMA_PACKAGE, validateSignedNfceSchema };
