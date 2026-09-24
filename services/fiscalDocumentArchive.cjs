const { createHash } = require('node:crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { problem } = require('./companyFiscalCore.cjs');
const { checkDigit } = require('./fiscalNfceAccessKey.cjs');
const child = (node, name) => Array.from(node?.childNodes || []).find(item => item.nodeType === 1 && item.localName === name);
const value = (node, name) => child(node,name)?.textContent?.trim() || '';
const hash = xml => createHash('sha256').update(xml).digest('hex');

function validateArchivedXml(xml, document, cnpj) {
  if (typeof xml !== 'string' || !xml || Buffer.byteLength(xml) > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw problem('XML inválido ou maior que 2 MB.',422);
  const errors = [];
  const dom = new DOMParser({ onError:(level,message) => errors.push(message) }).parseFromString(xml,'application/xml');
  const root = dom.documentElement;
  const inf = child(child(root,'NFe'),'infNFe');
  const ide = child(inf,'ide');
  const protocol = child(child(root,'protNFe'),'infProt');
  const key = String(inf?.getAttribute('Id') || '').replace(/^NFe/,'');
  if (errors.length || root?.localName !== 'nfeProc' || !/^\d{44}$/.test(key)
    || Number(key[43]) !== checkDigit(key.slice(0,43))
    || key !== document.access_key || value(ide,'mod') !== String(document.model)
    || !['55','65'].includes(String(document.model)) || key.slice(20,22) !== String(document.model)
    || value(child(inf,'emit'),'CNPJ') !== String(cnpj).replace(/\D/g,'') || key.slice(6,20) !== String(cnpj).replace(/\D/g,'')
    || value(ide,'tpAmb') !== '1' || value(protocol,'tpAmb') !== '1' || !['100','150'].includes(value(protocol,'cStat'))
    || value(protocol,'chNFe') !== key || !/^\d{15}$/.test(value(protocol,'nProt'))
    || Number(value(ide,'nNF')) !== Number(document.document_number) || Number(value(ide,'serie')) !== Number(document.series)) {
    throw problem('XML autorizado de produção não corresponde à nota e à empresa selecionadas.',422);
  }
  return { xml, hash:hash(xml), key };
}

async function readArchivedXml(pool, profile, documentId) {
  const [rows] = await pool.query('SELECT * FROM company_fiscal_documents WHERE id=? AND profile_id=? LIMIT 1',[documentId,profile.id]);
  const document = rows[0];
  if (!document) throw problem('Nota não encontrada nesta empresa.',404);
  if (!['authorized','cancelled'].includes(document.status)) throw problem('Documento sem situação fiscal disponível para representação.',409);
  let archives;
  try { [archives] = await pool.query('SELECT authorized_xml,xml_sha256 FROM company_fiscal_document_xmls WHERE document_id=? AND profile_id=? LIMIT 1',[documentId,profile.id]); }
  catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') throw problem('Arquivo de XMLs ainda não ativado no servidor.',503); throw error; }
  if (!archives[0]) throw problem('XML ainda não arquivado. Importe o XML original desta nota para habilitar a visualização e o download.',404);
  const xml = archives[0].authorized_xml;
  if (hash(xml) !== archives[0].xml_sha256) throw problem('Integridade do XML arquivado divergente.',409);
  validateArchivedXml(xml,document,profile.cnpj);
  return { document, xml };
}

async function renderFiscalPdf(xml, cancelled = false) {
  const { gerarPDF } = await import('@alexssmusica/node-pdf-nfe');
  const stream = await gerarPDF(xml,{ cancelada:cancelled, notEndDocument:true });
  const isNfce = /<(?:\w+:)?mod>\s*65\s*<\/(?:\w+:)?mod>/.test(xml);
  const receiptHeight = Math.min(stream.page.height, stream.y + 105);
  if (isNfce) stream.page.dictionary.data.CropBox = [0,stream.page.height - receiptHeight,stream.page.width,stream.page.height];
  // The renderer marks cancelled NF-e, but its NFC-e layout ignores that option.
  if (cancelled && isNfce) {
    stream.save().fillColor('#b91c1c').opacity(0.3).fontSize(28)
      .rotate(-45,{ origin:[stream.page.width / 2,receiptHeight / 2] })
      .text('CANCELADA',0,receiptHeight / 2,{width:stream.page.width,align:'center',lineBreak:false}).restore();
  }
  stream.end();
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = { validateArchivedXml, readArchivedXml, renderFiscalPdf };
