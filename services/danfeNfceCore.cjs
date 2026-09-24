const { DOMParser } = require('@xmldom/xmldom');

const fail = message => { throw new Error(message); };
const children = (node, name) => Array.from(node?.childNodes || []).find(child => child.nodeType === 1 && child.localName === name);
const value = (node, name) => children(node, name)?.textContent?.trim() || '';
const required = (node, name) => value(node, name) || fail(`XML da NFC-e sem ${name}.`);
const money = raw => {
  if (!/^\d{1,13}\.\d{2}$/.test(raw || '')) fail('Valor monetário inválido no XML da NFC-e.');
  const [whole, cents] = raw.split('.');
  const result = Number(whole) * 100 + Number(cents);
  if (!Number.isSafeInteger(result)) fail('Valor monetário fora do limite seguro.');
  return result;
};
const optionalMoney = (node, name) => value(node, name) ? money(value(node, name)) : 0;
const formatMoney = cents => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDecimal = (raw, minimumDecimals) => {
  const [whole, fraction = ''] = raw.split('.');
  const shown = fraction.replace(/0+$/, '').padEnd(minimumDecimals, '0');
  return `${Number(whole).toLocaleString('pt-BR')}${shown ? ',' + shown : ''}`;
};
const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const paymentNames = { '01':'Dinheiro', '02':'Cheque', '03':'Cartão de crédito', '04':'Cartão de débito', '05':'Crédito loja', '10':'Vale alimentação', '11':'Vale refeição', '12':'Vale presente', '13':'Vale combustível', '15':'Boleto bancário', '16':'Depósito bancário', '17':'PIX', '18':'Transferência bancária', '19':'Programa de fidelidade', '90':'Sem pagamento', '99':'Outros' };
const validKeyCheckDigit = key => {
  let sum = 0; let weight = 2;
  for (let index = 42; index >= 0; index--) { sum += Number(key[index]) * weight; weight = weight === 9 ? 2 : weight + 1; }
  const digit = 11 - sum % 11;
  return Number(key[43]) === (digit > 9 ? 0 : digit);
};

function parseNfceProcForDanfe(xml) {
  if (typeof xml !== 'string' || xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) fail('XML da NFC-e inválido ou não permitido.');
  const errors = [];
  const document = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message); } }).parseFromString(xml, 'application/xml');
  if (errors.length || document.documentElement?.localName !== 'nfeProc') fail('É necessário o XML processado da NFC-e com protocolo.');
  const root = document.documentElement;
  const nfe = children(root, 'NFe');
  const inf = children(nfe, 'infNFe');
  const prot = children(children(root, 'protNFe'), 'infProt');
  const ide = children(inf, 'ide');
  const emit = children(inf, 'emit');
  const total = children(children(inf, 'total'), 'ICMSTot');
  if (!inf || !prot || !ide || !emit || !total) fail('Estrutura fiscal da NFC-e incompleta.');
  const key = String(inf.getAttribute('Id') || '').replace(/^NFe/, '');
  if (!/^\d{44}$/.test(key) || !validKeyCheckDigit(key) || key.slice(20, 22) !== '65' || value(ide, 'mod') !== '65') fail('Chave ou modelo da NFC-e inválido.');
  const cnpj = required(emit, 'CNPJ');
  const series = required(ide, 'serie');
  const number = required(ide, 'nNF');
  const environment = required(ide, 'tpAmb');
  if (!/^[12]$/.test(environment) || cnpj !== key.slice(6, 20) || series.padStart(3, '0') !== key.slice(22, 25) || number.padStart(9, '0') !== key.slice(25, 34)
    || required(ide, 'cUF') !== key.slice(0, 2) || required(ide, 'tpEmis') !== key.slice(34, 35) || required(ide, 'cNF').padStart(8, '0') !== key.slice(35, 43) || required(ide, 'cDV') !== key.slice(43)) fail('Identidade, série ou número divergente da chave de acesso.');
  const protocol = required(prot, 'nProt');
  if (value(prot, 'cStat') !== '100' || value(prot, 'chNFe') !== key || value(prot, 'tpAmb') !== environment || !/^\d{15}$/.test(protocol)) fail('NFC-e sem autorização correspondente da SEFAZ.');
  const issuedAt = required(ide, 'dhEmi');
  const authorizedAt = required(prot, 'dhRecbto');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)$/.test(issuedAt) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)$/.test(authorizedAt)) fail('Data fiscal inválida no XML.');
  if (issuedAt.slice(2, 4) + issuedAt.slice(5, 7) !== key.slice(2, 6)) fail('Data de emissão diverge da chave de acesso.');
  const qrCode = value(children(nfe, 'infNFeSupl'), 'qrCode');
  let qrUrl;
  try { qrUrl = new URL(qrCode); } catch { fail('QR Code ausente ou inválido no XML autorizado.'); }
  if (!['https:', 'http:'].includes(qrUrl.protocol) || !/(?:^|\.)gov\.br$/i.test(qrUrl.hostname) || !qrUrl.searchParams.get('p')?.startsWith(`${key}|`)) fail('QR Code não corresponde à NFC-e ou ao domínio fiscal.');
  const consultationUrl = value(children(nfe, 'infNFeSupl'), 'urlChave');
  if (consultationUrl) {
    let consultation;
    try { consultation = new URL(consultationUrl); } catch { fail('URL de consulta da NFC-e inválida.'); }
    if (!['https:', 'http:'].includes(consultation.protocol) || !/(?:^|\.)gov\.br$/i.test(consultation.hostname)) fail('URL de consulta fora do domínio fiscal.');
  }
  const details = Array.from(inf.childNodes || []).filter(node => node.nodeType === 1 && node.localName === 'det');
  if (!details.length) fail('NFC-e sem itens.');
  const items = details.map((detail, index) => {
    const prod = children(detail, 'prod');
    const quantity = required(prod, 'qCom');
    const unitPrice = required(prod, 'vUnCom');
    if (!/^\d{1,11}\.\d{1,4}$/.test(quantity) || !/^\d{1,13}\.\d{1,10}$/.test(unitPrice)) fail(`Quantidade ou preço inválido no item ${index + 1}.`);
    return { code: required(prod, 'cProd'), description: required(prod, 'xProd'), quantity, unit: required(prod, 'uCom'), unitPrice, totalCents: money(required(prod, 'vProd')) };
  });
  const payments = Array.from(children(inf, 'pag')?.childNodes || []).filter(node => node.nodeType === 1 && node.localName === 'detPag').map(pay => ({ method: paymentNames[value(pay, 'tPag')] || `Meio ${required(pay, 'tPag')}`, amountCents: money(required(pay, 'vPag')) }));
  if (!payments.length) fail('NFC-e sem informação de pagamento.');
  const address = children(emit, 'enderEmit');
  const dest = children(inf, 'dest');
  const recipientDocument = value(dest, 'CPF') || value(dest, 'CNPJ');
  const productTotalCents = money(required(total, 'vProd'));
  const amountCents = money(required(total, 'vNF'));
  if (items.reduce((sum, item) => sum + item.totalCents, 0) !== productTotalCents) fail('Total dos itens diverge do XML da NFC-e.');
  return {
    key, environment, series, number, issuedAt, authorizedAt, protocol, qrCode, consultationUrl,
    issuer: { name: required(emit, 'xNome'), cnpj, stateRegistration: required(emit, 'IE'), address: [value(address, 'xLgr'), value(address, 'nro'), value(address, 'xBairro'), value(address, 'xMun'), value(address, 'UF')].filter(Boolean).join(', ') },
    recipient: recipientDocument ? { document: recipientDocument, name: value(dest, 'xNome') } : null,
    items, payments, productTotalCents, freightCents: optionalMoney(total, 'vFrete'), insuranceCents: optionalMoney(total, 'vSeg'), otherCents: optionalMoney(total, 'vOutro'), discountCents: optionalMoney(total, 'vDesc'), amountCents, changeCents: optionalMoney(children(inf, 'pag'), 'vTroco'), taxesCents: value(total, 'vTotTrib') ? money(value(total, 'vTotTrib')) : null,
  };
}

function buildDanfeNfceHtml(data, qrSvg, paperWidth = '80mm') {
  if (!['58mm', '80mm', '100mm'].includes(paperWidth)) fail('Largura de papel inválida para o DANFE NFC-e.');
  const row = (label, cents) => `<tr><td>${escapeHtml(label)}</td><td class="right">${formatMoney(cents)}</td></tr>`;
  const date = raw => `${raw.slice(8,10)}/${raw.slice(5,7)}/${raw.slice(0,4)} ${raw.slice(11,19)}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFE NFC-e ${escapeHtml(data.number)}</title><style>
  @page{size:${paperWidth} auto;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font:10px Arial,sans-serif}.danfe{width:${paperWidth};padding:3mm;margin:auto}h1{font-size:12px;margin:5px 0}p{margin:3px 0}.center{text-align:center}.right{text-align:right}.bold{font-weight:bold}.sep{border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:2px 1px;vertical-align:top}.items td{border-bottom:1px dotted #bbb}.key{font:9px monospace;overflow-wrap:anywhere}.qr svg{width:42mm;height:42mm;max-width:100%}.small{font-size:8px}@media print{body{margin:0}.danfe{width:100%;padding:2mm}}
  </style></head><body><main class="danfe"><header class="center"><strong>${escapeHtml(data.issuer.name)}</strong><p>CNPJ ${escapeHtml(data.issuer.cnpj)} · IE ${escapeHtml(data.issuer.stateRegistration)}</p><p>${escapeHtml(data.issuer.address)}</p><div class="sep"></div><h1>Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</h1>${data.environment === '2' ? '<p class="bold">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL</p>' : ''}</header>
  <div class="sep"></div><table class="items"><thead><tr><th>Cód.</th><th>Descrição / Qtd. / UN / Vl. unit.</th><th class="right">Vl. total</th></tr></thead><tbody>${data.items.map(item => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.description)}<br>${formatDecimal(item.quantity, 0)} ${escapeHtml(item.unit)} × ${formatDecimal(item.unitPrice, 2)}</td><td class="right">${formatMoney(item.totalCents)}</td></tr>`).join('')}</tbody></table>
  <div class="sep"></div><table><tr><td>Qtde. total de itens</td><td class="right">${data.items.length}</td></tr>${row('Valor total R$', data.productTotalCents)}${data.discountCents ? row('Desconto R$', data.discountCents) : ''}${data.freightCents ? row('Frete R$', data.freightCents) : ''}${data.insuranceCents ? row('Seguro R$', data.insuranceCents) : ''}${data.otherCents ? row('Outras despesas R$', data.otherCents) : ''}<tr class="bold"><td>Valor a pagar R$</td><td class="right">${formatMoney(data.amountCents)}</td></tr></table>
  <div class="sep"></div><table><thead><tr><th>Forma de pagamento</th><th class="right">Valor pago R$</th></tr></thead><tbody>${data.payments.map(pay => row(pay.method, pay.amountCents)).join('')}${data.changeCents ? row('Troco R$', data.changeCents) : ''}</tbody></table>
  <div class="sep"></div><p class="center">${data.recipient ? `Consumidor: ${escapeHtml(data.recipient.name || data.recipient.document)} · ${escapeHtml(data.recipient.document)}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</p>
  <p class="center">NFC-e nº ${escapeHtml(data.number)} · Série ${escapeHtml(data.series)} · ${date(data.issuedAt)}</p><p class="center">Protocolo de autorização: ${escapeHtml(data.protocol)}<br>${date(data.authorizedAt)}</p>
  <div class="sep"></div><p class="center">Consulte pela chave de acesso</p><p class="center key">${escapeHtml(data.key)}</p>${data.consultationUrl ? `<p class="center small">${escapeHtml(data.consultationUrl)}</p>` : ''}<div class="center qr">${qrSvg}</div>${data.taxesCents !== null ? `<p class="center small">Tributos totais incidentes (Lei 12.741/2012): R$ ${formatMoney(data.taxesCents)}</p>` : ''}
  </main></body></html>`;
}

module.exports = { parseNfceProcForDanfe, buildDanfeNfceHtml };
