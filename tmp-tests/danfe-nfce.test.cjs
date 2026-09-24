const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');
const { parseNfceProcForDanfe, buildDanfeNfceHtml } = require('../services/danfeNfceCore.cjs');

const key = '26260911222333000181650010000001231000000017';
const xml = (patch = {}) => {
  const data = {
    key, model: '65', environment: '2', protocolKey: key, protocolStatus: '100', qr: `https://nfce.sefaz.pe.gov.br/nfce/consulta?p=${key}|2|2|1|abcdef`,
    productName: 'Produto de teste', amount: '9.00', ...patch,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${data.key}" versao="4.00"><ide><cUF>26</cUF><mod>${data.model}</mod><serie>1</serie><nNF>123</nNF><tpEmis>1</tpEmis><cNF>00000001</cNF><cDV>7</cDV><tpAmb>${data.environment}</tpAmb><dhEmi>2026-09-24T10:30:00-03:00</dhEmi></ide><emit><CNPJ>11222333000181</CNPJ><xNome>LOJA EXEMPLO</xNome><IE>123456</IE><enderEmit><xLgr>Rua Exemplo</xLgr><nro>10</nro><xBairro>Centro</xBairro><xMun>Petrolina</xMun><UF>PE</UF></enderEmit></emit><det nItem="1"><prod><cProd>SKU-1</cProd><xProd>${data.productName}</xProd><qCom>1.0000</qCom><uCom>UN</uCom><vUnCom>10.0000000000</vUnCom><vProd>10.00</vProd></prod></det><total><ICMSTot><vProd>10.00</vProd><vDesc>1.00</vDesc><vNF>${data.amount}</vNF></ICMSTot></total><pag><detPag><tPag>17</tPag><vPag>9.00</vPag></detPag></pag></infNFe><infNFeSupl><qrCode>${data.qr.replaceAll('&', '&amp;')}</qrCode><urlChave>https://nfce.sefaz.pe.gov.br/nfce/consulta</urlChave></infNFeSupl></NFe><protNFe><infProt><tpAmb>${data.environment}</tpAmb><chNFe>${data.protocolKey}</chNFe><dhRecbto>2026-09-24T10:30:03-03:00</dhRecbto><nProt>126260000000001</nProt><cStat>${data.protocolStatus}</cStat></infProt></protNFe></nfeProc>`;
};

test('DANFE usa somente XML modelo 65 com protocolo 100, totais e QR fiscal', () => {
  const parsed = parseNfceProcForDanfe(xml());
  assert.equal(parsed.amountCents, 900);
  assert.equal(parsed.productTotalCents, 1000);
  assert.equal(parsed.payments[0].method, 'PIX');
  assert.equal(parsed.protocol, '126260000000001');
  const qrSvg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: parsed.qrCode, size: 160 }));
  const html = buildDanfeNfceHtml(parsed, qrSvg, '58mm');
  assert.match(html, /Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica/);
  assert.match(html, /HOMOLOGAÇÃO — SEM VALOR FISCAL/);
  assert.match(html, /Valor a pagar R\$<\/td><td class="right">9,00/);
  assert.match(html, /Qtde\. total de itens<\/td><td class="right">1/);
  assert.match(html, /126260000000001/);
  assert.match(html, /<svg/);
  assert.match(html, /width:58mm/);
  assert.throws(() => buildDanfeNfceHtml(parsed, qrSvg, '40mm'), /Largura/);
});

test('não gera DANFE para modelo 55, rejeição, protocolo divergente ou QR estranho', () => {
  for (const changed of [
    { model: '55' }, { protocolStatus: '110' }, { protocolKey: key.slice(0, -1) + '9' },
    { key: key.slice(0, -1) + '0' },
    { qr: `https://example.com/?p=${key}|2|2|1|abcdef` },
    { qr: `https://nfce.sefaz.pe.gov.br/nfce/consulta?p=${'0'.repeat(44)}|2|2|1|abcdef` },
  ]) assert.throws(() => parseNfceProcForDanfe(xml(changed)));
  assert.throws(() => parseNfceProcForDanfe(xml().replace('<nfeProc ', '<!DOCTYPE foo><nfeProc ')), /não permitido/);
});

test('campos do XML são escapados na impressão', () => {
  const parsed = parseNfceProcForDanfe(xml({ productName: 'Produto &lt;script&gt;alert(1)&lt;/script&gt;' }));
  const html = buildDanfeNfceHtml(parsed, '<svg></svg>');
  assert(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /Produto &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
