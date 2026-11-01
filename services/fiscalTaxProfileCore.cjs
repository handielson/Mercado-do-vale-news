// Perfis fiscais por produto (Simples Nacional). Cada perfil tem um bloco para NFC-e (modelo 65)
// e outro para NF-e (modelo 55). Os valores são definidos pela contabilidade; este módulo só
// valida formato, aponta inconsistências para conferência e resolve o tratamento efetivo do produto.
// Não emite, não calcula imposto e não transmite nada.
const { problem } = require('./companyFiscalCore.cjs');

const CSOSN = {
  101: 'Tributada com permissão de crédito',
  102: 'Tributada sem permissão de crédito',
  103: 'Isenção do ICMS para faixa de receita bruta',
  201: 'Com permissão de crédito e cobrança do ICMS por ST',
  202: 'Sem permissão de crédito e com cobrança do ICMS por ST',
  203: 'Isenção para faixa de receita bruta e cobrança do ICMS por ST',
  300: 'Imune',
  400: 'Não tributada pelo Simples Nacional',
  500: 'ICMS cobrado anteriormente por ST ou por antecipação',
  900: 'Outros',
};
const ST_CSOSN = new Set(['201', '202', '203', '500']);
const CREDIT_CSOSN = new Set(['101', '201']);
const ST_CFOP = new Set(['5401', '5402', '5403', '5405', '6401', '6402', '6403', '6404']);
const PIS_COFINS_CST = new Set(['01','02','03','04','05','06','07','08','09','49','50','51','52','53','54','55','56','60','61','62','63','64','65','66','67','70','71','72','73','74','75','98','99']);
const MODELS = { '65': 'nfce', '55': 'nfe' };
const BLOCK_FIELDS = {
  nfce: ['used', 'cfop', 'csosn', 'pCredSN', 'pisCst', 'pisRate', 'cofinsCst', 'cofinsRate', 'ibsCbsCst', 'cClassTrib', 'unit'],
  nfe: ['used', 'cfopInternal', 'cfopInterstate', 'csosn', 'pCredSN', 'pisCst', 'pisRate', 'cofinsCst', 'cofinsRate', 'ibsCbsCst', 'cClassTrib', 'unit'],
};
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

const str = (value, max) => String(value ?? '').trim().slice(0, max);
const digitsOnly = value => String(value ?? '').replace(/\D/g, '');
const fail = message => { throw problem(message, 400); };

function rateField(value, label) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (text === '') return '';
  if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(text) || Number(text) > 100) fail(`${label}: percentual inválido (use 0 a 100, até 4 casas).`);
  return String(Number(text));
}

function codeField(value, pattern, label) {
  const text = digitsOnly(value);
  if (text === '') return '';
  if (!pattern.test(text)) fail(`${label} inválido.`);
  return text;
}

function emptyBlock(kind) {
  return Object.fromEntries(BLOCK_FIELDS[kind].map(field => [field, field === 'used' ? true : field === 'unit' ? 'UN' : '']));
}

function normalizeBlock(kind, raw = {}, { partial = false } = {}) {
  const label = kind === 'nfce' ? 'NFC-e (65)' : 'NF-e (55)';
  const out = {};
  for (const field of BLOCK_FIELDS[kind]) {
    const value = raw[field];
    if (partial && (value === undefined || value === null || value === '')) continue;
    if (field === 'used') { out.used = value === undefined ? true : value === true || value === 'true' || value === 1; continue; }
    if (field.startsWith('cfop')) out[field] = codeField(value, /^\d{4}$/, `${label}: CFOP`);
    else if (field === 'csosn') { out.csosn = codeField(value, /^\d{3}$/, `${label}: CSOSN`); if (out.csosn && !CSOSN[out.csosn]) fail(`${label}: CSOSN ${out.csosn} não existe.`); }
    else if (field === 'pisCst' || field === 'cofinsCst') { out[field] = codeField(value, /^\d{2}$/, `${label}: CST ${field === 'pisCst' ? 'PIS' : 'COFINS'}`); if (out[field] && !PIS_COFINS_CST.has(out[field])) fail(`${label}: CST ${out[field]} não existe para PIS/COFINS.`); }
    else if (field === 'ibsCbsCst') out[field] = codeField(value, /^\d{3}$/, `${label}: CST IBS/CBS`);
    else if (field === 'cClassTrib') out[field] = codeField(value, /^\d{6}$/, `${label}: cClassTrib`);
    else if (field === 'unit') { const unit = str(value, 6).toUpperCase(); if (unit && !/^[A-Z0-9]{1,6}$/.test(unit)) fail(`${label}: unidade inválida.`); out.unit = unit || (partial ? undefined : 'UN'); if (out.unit === undefined) delete out.unit; }
    else out[field] = rateField(value, `${label}: ${field}`);
  }
  return out;
}

/** Normaliza o perfil recebido da tela. Erros de formato recusam o salvamento; rascunho incompleto é permitido. */
function normalizeProfile(input = {}) {
  const name = str(input.name, 80);
  if (!name) fail('Dê um nome ao perfil (ex.: "Celular com ST").');
  const status = input.status === 'approved' ? 'approved' : 'draft';
  const ncmPrefixes = [...new Set((Array.isArray(input.ncmPrefixes) ? input.ncmPrefixes : String(input.ncmPrefixes || '').split(/[\s,;]+/))
    .map(digitsOnly).filter(Boolean))].slice(0, 50);
  if (ncmPrefixes.some(prefix => prefix.length < 2 || prefix.length > 8)) fail('Prefixos de NCM devem ter de 2 a 8 dígitos.');
  const profile = {
    name, description: str(input.description, 500), status,
    requiresCest: input.requiresCest === true || input.requiresCest === 'true',
    ncmPrefixes,
    reviewerName: str(input.reviewerName, 255), reviewerRegistration: str(input.reviewerRegistration, 100),
    reviewedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(input.reviewedAt || '')) ? input.reviewedAt : '',
    notes: str(input.notes, 2000),
    nfce: { ...emptyBlock('nfce'), ...normalizeBlock('nfce', input.nfce || {}) },
    nfe: { ...emptyBlock('nfe'), ...normalizeBlock('nfe', input.nfe || {}) },
  };
  for (const kind of ['nfce', 'nfe']) if (!CREDIT_CSOSN.has(profile[kind].csosn)) profile[kind].pCredSN = '';
  const { errors, warnings } = checkProfile(profile);
  if (status === 'approved' && errors.length) fail(`Para aprovar, complete: ${errors.join('; ')}.`);
  return { profile, errors, warnings };
}

function checkBlock(kind, block, profile) {
  const label = kind === 'nfce' ? 'NFC-e (65)' : 'NF-e (55)';
  const errors = []; const warnings = [];
  if (!block.used) return { errors, warnings };
  const cfops = kind === 'nfce' ? [['cfop', '5']] : [['cfopInternal', '5'], ['cfopInterstate', '6']];
  for (const [field, first] of cfops) {
    if (!block[field]) errors.push(`${label}: ${field === 'cfopInterstate' ? 'CFOP fora do estado' : field === 'cfopInternal' ? 'CFOP dentro do estado' : 'CFOP'}`);
    else if (!block[field].startsWith(first)) warnings.push(`${label}: CFOP ${block[field]} deveria começar com ${first} (${first === '5' ? 'dentro do estado' : 'fora do estado'}).`);
  }
  for (const [field, name] of [['csosn', 'CSOSN'], ['pisCst', 'CST PIS'], ['cofinsCst', 'CST COFINS'], ['unit', 'unidade']]) if (!block[field]) errors.push(`${label}: ${name}`);
  if (CREDIT_CSOSN.has(block.csosn) && block.pCredSN === '') errors.push(`${label}: alíquota de crédito do Simples (pCredSN) do CSOSN ${block.csosn}`);
  const st = ST_CSOSN.has(block.csosn);
  for (const [field] of cfops) {
    const cfop = block[field];
    if (!cfop || !block.csosn) continue;
    if (st && !ST_CFOP.has(cfop)) warnings.push(`${label}: CSOSN ${block.csosn} é de substituição tributária, mas o CFOP ${cfop} não é de ST (ex.: ${field === 'cfopInterstate' ? '6404' : '5405'}). Confirme com a contadora.`);
    if (!st && ST_CFOP.has(cfop)) warnings.push(`${label}: CFOP ${cfop} é de ST, mas o CSOSN ${block.csosn} não é. Confirme com a contadora.`);
  }
  if (st && !profile.requiresCest) warnings.push(`${label}: produto com ST normalmente exige CEST; marque "exige CEST" ou confirme com a contadora.`);
  if (block.pisCst && block.cofinsCst && block.pisCst !== block.cofinsCst) warnings.push(`${label}: CST de PIS (${block.pisCst}) e COFINS (${block.cofinsCst}) diferentes; confira.`);
  for (const [field, name] of [['pisRate', 'PIS'], ['cofinsRate', 'COFINS']]) if (block[field] !== '' && Number(block[field]) > 0) warnings.push(`${label}: no Simples Nacional o ${name} é recolhido no DAS; alíquota ${block[field]}% no item é incomum. Confirme.`);
  return { errors, warnings };
}

function checkProfile(profile) {
  const errors = []; const warnings = [];
  if (!profile.nfce.used && !profile.nfe.used) errors.push('ative ao menos um modelo (NFC-e 65 ou NF-e 55)');
  for (const kind of ['nfce', 'nfe']) { const r = checkBlock(kind, profile[kind], profile); errors.push(...r.errors); warnings.push(...r.warnings); }
  if (profile.status === 'approved' && (!profile.reviewerName || !profile.reviewerRegistration || !profile.reviewedAt)) errors.push('nome, registro (CRC) e data de quem aprovou');
  return { errors, warnings };
}

function normalizeOverrides(input = {}) {
  const out = {};
  for (const kind of ['nfce', 'nfe']) {
    const block = normalizeBlock(kind, input[kind] || {}, { partial: true });
    delete block.used;
    if (Object.keys(block).length) out[kind] = block;
  }
  return out;
}

function profileView(row) {
  if (!row) return null;
  const data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : (row.data_json || {});
  const profile = { id: row.id, companyProfileId: row.company_profile_id, name: row.name, status: row.status, version: Number(row.version || 1),
    updatedBy: row.updated_by, updatedAt: row.updated_at, ...data,
    nfce: { ...emptyBlock('nfce'), ...(data.nfce || {}) }, nfe: { ...emptyBlock('nfe'), ...(data.nfe || {}) } };
  const { errors, warnings } = checkProfile(profile);
  return { ...profile, completeness: { errors, warnings, complete: errors.length === 0 } };
}

/** Sugere o perfil cujo prefixo de NCM é o mais específico para o produto. */
function suggestProfile(profiles, ncm) {
  const code = digitsOnly(ncm);
  if (code.length !== 8) return null;
  let best = null;
  for (const profile of profiles || []) for (const prefix of profile.ncmPrefixes || []) {
    if (code.startsWith(prefix) && (!best || prefix.length > best.prefix.length || (prefix.length === best.prefix.length && profile.status === 'approved' && best.profile.status !== 'approved'))) best = { profile, prefix };
  }
  return best ? { id: best.profile.id, name: best.profile.name, status: best.profile.status, matchedPrefix: best.prefix } : null;
}

/**
 * Tratamento efetivo de um produto para o modelo pedido (65 ou 55) e destino (interno/interestadual).
 * catalog é opcional (services/fiscalCatalog.cjs) para conferir NCM e CEST nas tabelas oficiais.
 */
function resolveProductTax({ product = {}, settings = null, profile = null, model = '65', destination = 'internal', catalog = null } = {}) {
  const kind = MODELS[String(model)];
  if (!kind) throw problem('Modelo fiscal inválido; use 65 (NFC-e) ou 55 (NF-e).', 400);
  const issues = [];
  const ncm = digitsOnly(product.ncm);
  const cest = digitsOnly(settings?.cest ?? product.cest);
  const origin = String(product.origin ?? '').trim();
  if (catalog) { const check = catalog.lookupNcm(ncm); if (!check.valid) issues.push(check.issue); }
  else if (!/^\d{8}$/.test(ncm)) issues.push('ncm_missing_or_invalid');
  if (!/^[0-8]$/.test(origin)) issues.push('origin_missing_or_invalid');
  if (!profile) issues.push('fiscal_profile_missing');
  else if (profile.status !== 'approved') issues.push('fiscal_profile_not_approved');
  const base = profile ? profile[kind] : emptyBlock(kind);
  const block = { ...base, ...((settings?.overrides || {})[kind] || {}) };
  if (profile && !base.used) issues.push(kind === 'nfce' ? 'profile_not_used_for_nfce' : 'profile_not_used_for_nfe');
  const cfop = kind === 'nfce' ? block.cfop : (destination === 'interstate' ? block.cfopInterstate : block.cfopInternal);
  if (profile) {
    const check = checkBlock(kind, block, profile);
    if (check.errors.length) issues.push('profile_block_incomplete');
  }
  if (profile?.requiresCest) {
    if (!/^\d{7}$/.test(cest)) issues.push('cest_required_missing');
    else if (catalog && !catalog.cestMatchesNcm(cest, ncm)) issues.push('cest_not_compatible_with_ncm');
  } else if (cest && !/^\d{7}$/.test(cest)) issues.push('cest_invalid');
  const overridden = Object.keys((settings?.overrides || {})[kind] || {});
  return {
    model: String(model), destination: kind === 'nfce' ? 'internal' : destination,
    ready: issues.length === 0, issues,
    fields: { ncm, cest: profile?.requiresCest ? cest : (cest || ''), origin, cfop: cfop || '', csosn: block.csosn || '', pCredSN: block.pCredSN || '',
      pisCst: block.pisCst || '', pisRate: block.pisRate || '', cofinsCst: block.cofinsCst || '', cofinsRate: block.cofinsRate || '',
      ibsCbsCst: block.ibsCbsCst || '', cClassTrib: block.cClassTrib || '', unit: block.unit || '' },
    profile: profile ? { id: profile.id, name: profile.name, status: profile.status } : null,
    overriddenFields: overridden,
  };
}

const ISSUE_TEXT = {
  ncm_missing: 'NCM não informado', ncm_incomplete: 'NCM incompleto (precisa de 8 dígitos)', ncm_not_found: 'NCM não existe na tabela vigente',
  ncm_missing_or_invalid: 'NCM ausente ou inválido', origin_missing_or_invalid: 'origem da mercadoria não informada',
  fiscal_profile_missing: 'produto sem perfil fiscal', fiscal_profile_not_approved: 'perfil fiscal ainda não aprovado pela contadora',
  profile_not_used_for_nfce: 'perfil não prevê NFC-e (65)', profile_not_used_for_nfe: 'perfil não prevê NF-e (55)',
  profile_block_incomplete: 'tributação do perfil incompleta para este modelo', cest_required_missing: 'perfil exige CEST e o produto não tem',
  cest_not_compatible_with_ncm: 'CEST não corresponde ao NCM no Convênio 142/2018', cest_invalid: 'CEST inválido',
};

module.exports = { CSOSN, ST_CSOSN, ST_CFOP, PIS_COFINS_CST, BLOCK_FIELDS, UUID, ISSUE_TEXT,
  normalizeProfile, normalizeOverrides, checkProfile, profileView, suggestProfile, resolveProductTax, emptyBlock };
