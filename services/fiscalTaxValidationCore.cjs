const { problem } = require('./companyFiscalCore.cjs');
const { isDeepStrictEqual } = require('node:util');

const TEXT_LIMIT = 2000;
const DOCUMENT_IDS = new Set(['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP11','OP12','OP13']);
const scenarios = [
  ['OP01','Venda presencial interna no PDV','65 ou 55','PE','Consumidor final não contribuinte','Normal','5102'],
  ['OP02','Site próprio com entrega em PE','55 ou 65','PE','Consumidor final não contribuinte','Normal','5102'],
  ['OP03','Shopee com entrega em PE','55','PE','Consumidor final não contribuinte','Normal','5102'],
  ['OP04','E-commerce interestadual','55','Outra UF','Consumidor final não contribuinte','Normal','6108'],
  ['OP05','Venda para pessoa jurídica contribuinte','55','PE/outra UF','Contribuinte de ICMS','Normal','6108'],
  ['OP06','Venda para pessoa jurídica não contribuinte','55','PE/outra UF','Não contribuinte','Normal','6108'],
  ['OP07','Devolução de venda','55','Conforme documento original','Conforme documento original','Devolução',''],
  ['OP08','Entrada por devolução de cliente','55','Conforme documento original','Conforme documento original','Devolução/entrada',''],
  ['OP09','Cancelamento dentro do prazo','Evento','—','—','Cancelamento',''],
  ['OP10','Inutilização de numeração','Evento','—','—','Inutilização',''],
  ['OP11','Full Shopee — remessa de estoque ao armazém','55','','Armazém Full','Remessa',''],
  ['OP12','Full Shopee — venda ao comprador','55','','Comprador','Venda',''],
  ['OP13','Full Shopee — retorno do armazém/devolução','55','','Conforme documento original','Retorno/devolução',''],
  ['OP14','Full Shopee — entrega não concluída','Evento/documentos','','Conforme documento original','Anulação/retorno',''],
];

const defaultRules = () => scenarios.map(([id,scenario,model,destinationUf,recipient,finality,cfop]) => ({
  id, scenario, used: !['OP11','OP12','OP13','OP14'].includes(id), model, destinationUf, recipient, finality, cfop,
  nfce: { unit: '', csosn: '', pisCst: '', cofinsCst: '', icmsRate: '', pisRate: '', cofinsRate: '', cestApplicability: '', gtinDecision: '' },
  icmsCode: id <= 'OP06' ? 'CSOSN 400' : '',
  icmsTreatment: id <= 'OP06' ? 'Alíquota 0%; base 0%. Confirmar ST, FCP e DIFAL.' : '',
  pisCofins: id <= 'OP06' ? 'PIS CST 07 e COFINS CST 07; alíquota 0%; base 100%.' : '',
  ipi: id <= 'OP06' ? 'CST 53; alíquota 0%; base 100%.' : '',
  benefit: '', effectiveFrom: '', notes: id <= 'OP06' ? 'Referência observada na natureza VENDA do Bling em 23/09/2026; validar antes de aprovar.' : '',
  source: id <= 'OP06' ? 'bling_reference' : 'scope',
}));

const blingReference = () => ({
  observedAt: '2026-09-23', source: 'Bling — conferência somente leitura',
  natures: [
    { name: 'COMPRA', defaultUse: 'Padrão compra' },
    { name: 'Devolução de produto', defaultUse: 'Padrão devolução (entrada)' },
    { name: 'Simples remessa', defaultUse: '' },
    { name: 'VENDA', defaultUse: 'Padrão venda' },
  ],
  sale: { series: '1', type: 'Saída', crt: '1', presence: '1 — Operação presencial', billed: true, finalConsumer: true, returnOperation: false },
});

const defaultGeneralDecisions = () => ({
  taxRegime: 'Simples Nacional', crt: '1', effectiveFrom: '', simplesBasis: '',
  freightTreatment: '', productExceptions: 'pending', productExceptionsNotes: '',
});

const defaultShopeeFull = () => ({
  status: 'pending', nfeSeries: '', warehouseUf: '', freightOnInvoice: '', saleCfopInState: '', saleCfopOutOfState: '',
  certificateChecked: '', fiscalRuleName: '', xmlReconciliation: '', notes: '',
});

const text = (value, label, max = TEXT_LIMIT) => {
  const result = String(value ?? '').trim();
  if (result.length > max) throw problem(`${label} excede ${max} caracteres.`);
  return result;
};

const reviewIssues = data => {
  const issues = [];
  if (!data.reviewerName) issues.push('responsável/contador');
  if (!data.reviewedAt || !/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt)) issues.push('data da revisão');
  return issues;
};

const approvalIssues = data => {
  const missing = reviewIssues(data);
  const { generalDecisions, productRules, rules, shopeeFull } = data;
  for (const [field,label] of [['taxRegime','regime tributário'],['crt','CRT'],['effectiveFrom','vigência geral'],['simplesBasis','regime de apuração do Simples'],['freightTreatment','frete, desconto e despesas'],['productExceptionsNotes','decisão sobre exceções por produto']]) if (!generalDecisions[field]) missing.push(label);
  if (generalDecisions.productExceptions === 'pending') missing.push('situação das exceções por produto');
  if (generalDecisions.productExceptions === 'listed' && !productRules.length) missing.push('ao menos uma regra por produto');
  if (generalDecisions.productExceptions === 'listed' || shopeeFull.status === 'in_use') for (const [index,rule] of productRules.entries()) {
    for (const [field,label] of [['group','grupo/produto'],['ncm','NCM'],['origin','origem'],['unit','unidade'],['taxTreatment','tributação'],['operations','operações'],['effectiveFrom','vigência']]) if (!rule[field]) missing.push(`PR${index + 1}: ${label}`);
  }
  if (shopeeFull.status === 'in_use') {
    for (const [field,label] of [['nfeSeries','série NF-e exclusiva'],['warehouseUf','UF do armazém'],['freightOnInvoice','inclusão do frete na NF-e'],['saleCfopInState','CFOP venda interna'],['saleCfopOutOfState','CFOP venda interestadual'],['fiscalRuleName','regra fiscal cadastrada na Shopee'],['xmlReconciliation','conciliação dos XMLs']]) if (!shopeeFull[field]) missing.push(`Full Shopee: ${label}`);
    if (shopeeFull.certificateChecked !== 'yes') missing.push('Full Shopee: certificado A1 conferido na Shopee');
    if (!productRules.length) missing.push('Full Shopee: ao menos uma regra por grupo/produto');
    productRules.forEach((rule,index) => { if (!rule.totalTaxRate) missing.push(`PR${index + 1}: percentual total de tributos no Full`); });
    for (const id of ['OP11','OP12','OP13','OP14']) if (!rules.find(rule => rule.id === id)?.used) missing.push(`${id}: marcar operação Full como utilizada e revisar`);
  }
  for (const rule of rules.filter(rule => rule.used)) {
    if (DOCUMENT_IDS.has(rule.id)) {
      for (const field of ['model','cfop','icmsCode','icmsTreatment','pisCofins','ipi','effectiveFrom']) if (!rule[field]) missing.push(`${rule.id}: ${field}`);
    } else {
      if (!rule.notes) missing.push(`${rule.id}: procedimento/observação`);
      if (!rule.effectiveFrom) missing.push(`${rule.id}: vigência`);
    }
  }
  const counterSale = rules.find(rule => rule.id === 'OP01' && rule.used);
  if (counterSale) for (const [field,label] of [['icmsRate','ICMS'],['pisRate','PIS'],['cofinsRate','COFINS']]) {
    if (!counterSale.nfce?.[field]) missing.push(`OP01: alíquota ${label} confirmada pelo contador`);
  }
  if (!data.reviewerRegistration) missing.push('CRC/registro do contador');
  return missing;
};

const rate = (value, label) => {
  const result = text(value, label, 7).replace(',', '.');
  if (result && (!/^(?:\d{1,2}(?:\.\d{1,4})?|100(?:\.0{1,4})?)$/.test(result) || Number(result) > 100)) throw problem(`${label} inválida.`);
  return result;
};

function normalizeTaxValidation(input = {}) {
  const status = ['draft','reviewed','approved'].includes(input.status) ? input.status : 'draft';
  const incoming = Array.isArray(input.rules) ? input.rules : [];
  const byId = new Map(incoming.map(rule => [String(rule?.id || ''), rule]));
  const rules = defaultRules().map(base => {
    const rule = byId.get(base.id) || base;
    return {
      ...base,
      used: rule.used !== false,
      model: text(rule.model, `${base.id}: modelo`, 30), destinationUf: text(rule.destinationUf, `${base.id}: destino`, 80),
      recipient: text(rule.recipient, `${base.id}: destinatário`, 120), finality: text(rule.finality, `${base.id}: finalidade`, 80),
      cfop: text(rule.cfop, `${base.id}: CFOP`, 20), icmsCode: text(rule.icmsCode, `${base.id}: ICMS`, 80),
      icmsTreatment: text(rule.icmsTreatment, `${base.id}: tratamento ICMS`, 500), pisCofins: text(rule.pisCofins, `${base.id}: PIS/COFINS`, 500),
      ipi: text(rule.ipi, `${base.id}: IPI`, 300), benefit: text(rule.benefit, `${base.id}: benefício`, 500),
      effectiveFrom: text(rule.effectiveFrom, `${base.id}: vigência`, 10), notes: text(rule.notes, `${base.id}: observações`),
      source: ['bling_reference','scope','accountant'].includes(rule.source) ? rule.source : 'accountant',
      nfce: { ...Object.fromEntries(Object.entries({ unit: /^[A-Z0-9]{1,6}$/, csosn: /^\d{3}$/, pisCst: /^\d{2}$/, cofinsCst: /^\d{2}$/, cestApplicability: /^(required|not_applicable)$/, gtinDecision: /^(from_product|sem_gtin)$/ }).map(([field,pattern]) => {
        const value = text(rule.nfce?.[field], `${base.id}: NFC-e ${field}`, 20).toUpperCase();
        const normalized = ['cestApplicability','gtinDecision'].includes(field) ? value.toLowerCase() : value;
        if (normalized && !pattern.test(normalized)) throw problem(`${base.id}: NFC-e ${field} inválido.`);
        return [field, normalized];
      })), icmsRate:rate(rule.nfce?.icmsRate, `${base.id}: alíquota ICMS`), pisRate:rate(rule.nfce?.pisRate, `${base.id}: alíquota PIS`), cofinsRate:rate(rule.nfce?.cofinsRate, `${base.id}: alíquota COFINS`) },
    };
  });
  const reviewerName = text(input.reviewerName, 'Responsável', 255);
  const reviewerRegistration = text(input.reviewerRegistration, 'CRC/registro', 100);
  const reviewedAt = text(input.reviewedAt, 'Data da revisão', 10);
  const notes = text(input.notes, 'Observações gerais');
  const rawGeneral = input.generalDecisions || {};
  const generalDecisions = {
    taxRegime: text(rawGeneral.taxRegime, 'Regime tributário', 100),
    crt: text(rawGeneral.crt, 'CRT', 10),
    effectiveFrom: text(rawGeneral.effectiveFrom, 'Vigência geral', 10),
    simplesBasis: text(rawGeneral.simplesBasis, 'Regime de apuração do Simples', 40),
    freightTreatment: text(rawGeneral.freightTreatment, 'Tratamento de frete, desconto e despesas', 1000),
    productExceptions: ['none','listed','pending'].includes(rawGeneral.productExceptions) ? rawGeneral.productExceptions : 'pending',
    productExceptionsNotes: text(rawGeneral.productExceptionsNotes, 'Exceções por produto', 2000),
  };
  const productRules = (Array.isArray(input.productRules) ? input.productRules : []).slice(0, 200).map((rule, index) => ({
    id: text(rule.id, `Regra de produto ${index + 1}: id`, 80) || `PR${String(index + 1).padStart(2,'0')}`,
    group: text(rule.group, `Regra de produto ${index + 1}: grupo`, 255),
    ncm: text(rule.ncm, `Regra de produto ${index + 1}: NCM`, 20),
    cest: text(rule.cest, `Regra de produto ${index + 1}: CEST`, 20),
    origin: text(rule.origin, `Regra de produto ${index + 1}: origem`, 80),
    unit: text(rule.unit, `Regra de produto ${index + 1}: unidade`, 80),
    taxTreatment: text(rule.taxTreatment, `Regra de produto ${index + 1}: tributação`, 1000),
    totalTaxRate: rate(rule.totalTaxRate, `Regra de produto ${index + 1}: percentual total de tributos`),
    operations: text(rule.operations, `Regra de produto ${index + 1}: operações`, 255),
    effectiveFrom: text(rule.effectiveFrom, `Regra de produto ${index + 1}: vigência`, 10),
    notes: text(rule.notes, `Regra de produto ${index + 1}: observações`, 1000),
  }));
  const rawFull = input.shopeeFull || {};
  const shopeeFull = {
    status: ['pending','not_applicable','in_use'].includes(rawFull.status) ? rawFull.status : 'pending',
    nfeSeries: text(rawFull.nfeSeries, 'Full Shopee: série NF-e', 20),
    warehouseUf: text(rawFull.warehouseUf, 'Full Shopee: UF do armazém', 2).toUpperCase(),
    freightOnInvoice: ['yes','no'].includes(rawFull.freightOnInvoice) ? rawFull.freightOnInvoice : '',
    saleCfopInState: text(rawFull.saleCfopInState, 'Full Shopee: CFOP venda interna', 4),
    saleCfopOutOfState: text(rawFull.saleCfopOutOfState, 'Full Shopee: CFOP venda interestadual', 4),
    certificateChecked: ['yes','no'].includes(rawFull.certificateChecked) ? rawFull.certificateChecked : '',
    fiscalRuleName: text(rawFull.fiscalRuleName, 'Full Shopee: regra fiscal', 255),
    xmlReconciliation: text(rawFull.xmlReconciliation, 'Full Shopee: conciliação XML', 500),
    notes: text(rawFull.notes, 'Full Shopee: observações', 1000),
  };
  if (shopeeFull.nfeSeries && !/^\d{1,3}$/.test(shopeeFull.nfeSeries)) throw problem('Full Shopee: série NF-e inválida.');
  if (shopeeFull.warehouseUf && !/^[A-Z]{2}$/.test(shopeeFull.warehouseUf)) throw problem('Full Shopee: UF do armazém inválida.');
  for (const field of ['saleCfopInState','saleCfopOutOfState']) if (shopeeFull[field] && !/^\d{4}$/.test(shopeeFull[field])) throw problem(`Full Shopee: ${field} inválido.`);
  const normalized = { status, reviewerName, reviewerRegistration, reviewedAt, notes, generalDecisions, productRules, shopeeFull, rules };
  const reviewMissing = reviewIssues(normalized);
  const approvalMissing = approvalIssues(normalized);
  if (status === 'reviewed' && reviewMissing.length) throw problem(`Para marcar como revisado, informe: ${reviewMissing.join(', ')}.`, 409);
  if (status === 'approved' && approvalMissing.length) throw problem(`A aprovação ainda possui campos pendentes: ${approvalMissing.join(', ')}.`, 409);
  return { ...normalized, reviewIssues: reviewMissing, approvalIssues: approvalMissing };
}

function taxValidationView(row) {
  if (!row) {
    const data = { status: 'draft', reviewerName: '', reviewerRegistration: '', reviewedAt: '', notes: '', generalDecisions: defaultGeneralDecisions(), productRules: [], shopeeFull: defaultShopeeFull(), rules: defaultRules() };
    return { ...data, reviewIssues: reviewIssues(data), approvalIssues: approvalIssues(data), blingReference: blingReference(), version: 0, updatedAt: '' };
  }
  const storedRules = JSON.parse(typeof row.rules_json === 'string' ? row.rules_json : JSON.stringify(row.rules_json || {}));
  const data = {
    status: row.status || 'draft', reviewerName: row.reviewer_name || '', reviewerRegistration: row.reviewer_registration || '',
    reviewedAt: row.reviewed_at ? String(row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : row.reviewed_at).slice(0,10) : '',
    notes: row.notes || '', rules: defaultRules().map(base => (Array.isArray(storedRules) ? storedRules : storedRules.rules || []).find(rule => rule.id === base.id) || base),
    generalDecisions: Array.isArray(storedRules) ? defaultGeneralDecisions() : { ...defaultGeneralDecisions(), ...(storedRules.generalDecisions || {}) },
    productRules: Array.isArray(storedRules) ? [] : (storedRules.productRules || []),
    shopeeFull: Array.isArray(storedRules) ? defaultShopeeFull() : { ...defaultShopeeFull(), ...(storedRules.shopeeFull || {}) },
  };
  return {
    ...data, reviewIssues: reviewIssues(data), approvalIssues: approvalIssues(data),
    blingReference: row.bling_reference_json ? JSON.parse(typeof row.bling_reference_json === 'string' ? row.bling_reference_json : JSON.stringify(row.bling_reference_json)) : blingReference(),
    version: Number(row.version || 0), updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

// Review metadata is trusted only from storage; clients request a review by rule ID.
function applyOperationReviews(data, currentRow, reviewRuleId, actor, now = new Date()) {
  const previous = taxValidationView(currentRow);
  const normalizedPrevious = normalizeTaxValidation({ ...previous, status: 'draft' });
  const contextChanged = !isDeepStrictEqual(data.generalDecisions, normalizedPrevious.generalDecisions)
    || !isDeepStrictEqual(data.productRules, normalizedPrevious.productRules)
    || !isDeepStrictEqual(data.shopeeFull, normalizedPrevious.shopeeFull);
  if (reviewRuleId && !data.rules.some(rule => rule.id === reviewRuleId)) throw problem('Operação inválida para revisão.');
  if (reviewRuleId && !data.reviewerName) throw problem('Informe o responsável/contador antes de revisar a operação.', 409);
  const content = ({ review, ...rule }) => rule;
  data.rules = data.rules.map(rule => {
    const old = previous.rules.find(item => item.id === rule.id);
    const oldContent = normalizedPrevious.rules.find(item => item.id === rule.id);
    const changed = contextChanged || !isDeepStrictEqual(content(rule), content(oldContent));
    let review = old?.review ? { ...old.review, outdated: !!old.review.outdated || changed } : null;
    if (rule.id === reviewRuleId) review = {
      reviewerName: data.reviewerName, reviewerRegistration: data.reviewerRegistration,
      reviewedAt: now.toISOString(), actor: String(actor), outdated: false,
    };
    return { ...rule, review };
  });
  return data;
}

module.exports = { defaultRules, defaultGeneralDecisions, defaultShopeeFull, blingReference, reviewIssues, approvalIssues, normalizeTaxValidation, taxValidationView, applyOperationReviews };
