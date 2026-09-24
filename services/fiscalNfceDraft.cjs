const { makeNfceAccessKey } = require('./fiscalNfceAccessKey.cjs');
const { validCnpj } = require('./companyFiscalCore.cjs');
const { validGtin } = require('./fiscalItemReadiness.cjs');

const reject = message => { throw new Error(message); };
const escaped = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const tag = (name, value) => `<${name}>${escaped(value)}</${name}>`;
const money = cents => {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 999999999999) reject('Valor fiscal em centavos inválido.');
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
};
const digits = (value, length, label) => {
  const raw = String(value ?? '');
  if (!new RegExp(`^\\d{${length}}$`).test(raw)) reject(`${label} inválido.`);
  return raw;
};
const label = (value, max, name) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > max || /[\u0000-\u001f]/.test(raw)) reject(`${name} inválido.`);
  return raw;
};

/** Primeiro recorte: venda local de mercadoria com tratamento explícito observado, somente homologação. */
function buildHomologationNfceDraft({ issuer, series, number, issuedAt, numericCode, nature, items, payments }) {
  if (!issuer || !Array.isArray(items) || !items.length || items.length > 990 || !Array.isArray(payments) || !payments.length) reject('Emitente, itens e pagamentos são obrigatórios.');
  const a = issuer.address || {};
  const ufCode = digits(issuer.ufCode, 2, 'Código da UF');
  if (ufCode !== '26' || a.state !== 'PE') reject('Este recorte de homologação atende somente emitente de Pernambuco.');
  const cnpj = digits(issuer.cnpj, 14, 'CNPJ');
  if (!validCnpj(cnpj)) reject('CNPJ do emitente inválido.');
  const municipalityCode = digits(a.municipalityCode, 7, 'Município IBGE');
  if (!municipalityCode.startsWith(ufCode)) reject('Município fora da UF do emitente.');
  const access = makeNfceAccessKey({ ufCode, issuedAt, cnpj, series, number, numericCode });
  const address = tag('xLgr', label(a.street, 60, 'Logradouro')) + tag('nro', label(a.number, 60, 'Número'))
    + tag('xBairro', label(a.district, 60, 'Bairro')) + tag('cMun', municipalityCode)
    + tag('xMun', label(a.city, 60, 'Cidade')) + tag('UF', 'PE')
    + tag('CEP', digits(a.postalCode, 8, 'CEP')) + tag('cPais', '1058') + tag('xPais', 'BRASIL');
  const ide = tag('cUF', ufCode) + tag('cNF', access.numericCode) + tag('natOp', label(nature, 60, 'Natureza da operação'))
    + tag('mod', '65') + tag('serie', series) + tag('nNF', number) + tag('dhEmi', issuedAt)
    + tag('tpNF', '1') + tag('idDest', '1') + tag('cMunFG', municipalityCode) + tag('tpImp', '4')
    + tag('tpEmis', '1') + tag('cDV', access.checkDigit) + tag('tpAmb', '2') + tag('finNFe', '1')
    + tag('indFinal', '1') + tag('indPres', '1') + tag('procEmi', '0') + tag('verProc', 'MDV1');
  const emit = tag('CNPJ', cnpj) + tag('xNome', label(issuer.name, 60, 'Nome do emitente'))
    + `<enderEmit>${address}</enderEmit>` + tag('IE', digits(issuer.stateRegistration, 9, 'Inscrição estadual')) + tag('CRT', '1');
  let productCents = 0;
  const details = items.map((item, index) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99999999999) reject('Quantidade inteira inválida.');
    if (!Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 1) reject('Preço do item inválido.');
    const itemTotal = item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(itemTotal)) reject('Total do item fora do limite.');
    productCents += itemTotal;
    if (!Number.isSafeInteger(productCents)) reject('Total fiscal fora do limite.');
    if (item.cfop !== '5102' || item.origin !== '0' || item.csosn !== '400' || item.pisCst !== '07' || item.cofinsCst !== '07')
      reject('Tratamento fiscal ainda não implementado para este item.');
    const gtin = item.gtin === 'SEM GTIN' ? 'SEM GTIN' : String(item.gtin || '');
    if (gtin !== 'SEM GTIN' && !validGtin(gtin)) reject('GTIN inválido.');
    const unit = label(item.unit, 6, 'Unidade');
    const prod = tag('cProd', label(item.sku, 60, 'SKU')) + tag('cEAN', gtin)
      + tag('xProd', label(item.description, 120, 'Descrição do produto')) + tag('NCM', digits(item.ncm, 8, 'NCM'))
      + tag('CEST', digits(item.cest, 7, 'CEST')) + tag('CFOP', item.cfop)
      + tag('uCom', unit) + tag('qCom', item.quantity.toFixed(4)) + tag('vUnCom', money(item.unitPriceCents))
      + tag('vProd', money(itemTotal)) + tag('cEANTrib', gtin) + tag('uTrib', unit)
      + tag('qTrib', item.quantity.toFixed(4)) + tag('vUnTrib', money(item.unitPriceCents)) + tag('indTot', '1');
    const tax = '<ICMS><ICMSSN102><orig>0</orig><CSOSN>400</CSOSN></ICMSSN102></ICMS>'
      + '<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>';
    return `<det nItem="${index + 1}"><prod>${prod}</prod><imposto>${tax}</imposto></det>`;
  }).join('');
  const paidCents = payments.reduce((sum, payment) => {
    if (!/^\d{2}$/.test(String(payment.method || ''))) reject('Meio de pagamento fiscal inválido.');
    money(payment.amountCents);
    return sum + payment.amountCents;
  }, 0);
  if (paidCents !== productCents || productCents <= 0) reject('Pagamento diverge do total dos itens.');
  const totals = ['vBC','vICMS','vICMSDeson','vFCP','vBCST','vST','vFCPST','vFCPSTRet','vProd','vFrete','vSeg','vDesc','vII','vIPI','vIPIDevol','vPIS','vCOFINS','vOutro','vNF']
    .map(name => tag(name, money(name === 'vProd' || name === 'vNF' ? productCents : 0))).join('');
  const pag = payments.map(payment => `<detPag>${tag('tPag', payment.method)}${tag('vPag', money(payment.amountCents))}</detPag>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe${access.key}"><ide>${ide}</ide><emit>${emit}</emit>${details}<total><ICMSTot>${totals}</ICMSTot></total><transp><modFrete>9</modFrete></transp><pag>${pag}</pag></infNFe></NFe>`;
  return { xml, accessKey: access.key, totalCents: productCents, environment: 'homologation' };
}

module.exports = { buildHomologationNfceDraft };
