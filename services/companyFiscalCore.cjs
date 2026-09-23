const REGIMES = ['nao_definido', 'simples_nacional', 'mei', 'lucro_presumido', 'lucro_real', 'lucro_arbitrado', 'imune', 'isenta', 'outro'];
const STATES = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
// IBGE municipality codes start with the two-digit UF code.
const STATE_IBGE = { RO:'11', AC:'12', AM:'13', RR:'14', PA:'15', AP:'16', TO:'17', MA:'21', PI:'22', CE:'23', RN:'24', PB:'25', PE:'26', AL:'27', SE:'28', BA:'29', MG:'31', ES:'32', RJ:'33', SP:'35', PR:'41', SC:'42', RS:'43', MS:'50', MT:'51', GO:'52', DF:'53' };
function problem(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function normalizeCnpj(value) { return String(value || '').toUpperCase().replace(/[.\/\-\s]/g, ''); }
function validCnpj(value) {
  const n = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(n) || /^(.)\1+$/.test(n)) return false;
  const digit = (s) => {
    let sum = 0, weight = 2;
    for (let i = s.length - 1; i >= 0; i--) { sum += (s.charCodeAt(i) - 48) * weight; weight = weight === 9 ? 2 : weight + 1; }
    const rest = sum % 11; return String(rest < 2 ? 0 : 11 - rest);
  };
  return digit(n.slice(0, 12)) === n[12] && digit(n.slice(0, 13)) === n[13];
}
const text = (v, max = 255) => {
  if (v != null && typeof v !== 'string') throw problem('Campo de texto inválido.');
  const s = (v || '').trim(); if (s.length > max) throw problem('Campo excede o tamanho permitido.'); return s;
};
function verifyStateRegistration(value, uf) {
  const raw = String(value || '').trim();
  if (!raw) return { status: 'missing' };
  const digits = raw.replace(/[.\-\/\s]/g, '');
  if (!/^\d{2,14}$/.test(digits)) return { status: 'invalid' };
  if (uf !== 'PE') return { status: 'unsupported' };
  if (digits.length !== 9) return { status: 'invalid' };
  const checkDigit = (sequence, firstWeight) => {
    const sum = [...sequence].reduce((total, digit, index) => total + Number(digit) * (firstWeight - index), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = checkDigit(digits.slice(0, 7), 8);
  const second = checkDigit(digits.slice(0, 7) + first, 9);
  return { status: first === Number(digits[7]) && second === Number(digits[8]) ? 'valid' : 'invalid' };
}
function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw problem('Dados inválidos.');
  const cnpj = normalizeCnpj(body.cnpj);
  if (!validCnpj(cnpj)) throw problem('CNPJ inválido. Confira os caracteres e dígitos verificadores.');
  const name = text(body.name); if (!name) throw problem('Informe o nome da empresa.');
  const regime = body.regime ?? 'nao_definido';
  if (!REGIMES.includes(regime)) throw problem('Regime tributário inválido.');
  const crt = body.crt === '' || body.crt == null ? null : String(body.crt);
  if (crt && !['1', '2', '3', '4'].includes(crt)) throw problem('CRT inválido.');
  if (crt && ((regime === 'mei' && crt !== '4') || (regime === 'simples_nacional' && !['1', '2'].includes(crt)) || (['lucro_presumido', 'lucro_real', 'lucro_arbitrado'].includes(regime) && crt !== '3'))) throw problem('O CRT não é compatível com o regime selecionado.');
  const uf = text(body.uf, 2).toUpperCase(); if (uf && !STATES.has(uf)) throw problem('UF inválida.');
  const municipalityCode = text(body.municipalityCode, 7); if (municipalityCode && !/^\d{7}$/.test(municipalityCode)) throw problem('Código IBGE deve ter 7 dígitos.');
  const effectiveFrom = body.effectiveFrom || null;
  if (effectiveFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || Number.isNaN(Date.parse(effectiveFrom)) || new Date(effectiveFrom).toISOString().slice(0, 10) !== effectiveFrom)) throw problem('Data de vigência inválida.');
  const rawAddress = body.address ?? {};
  if (!rawAddress || typeof rawAddress !== 'object' || Array.isArray(rawAddress)) throw problem('Endereço fiscal inválido.');
  const address = {
    zipCode: text(rawAddress.zipCode, 9), street: text(rawAddress.street), number: text(rawAddress.number, 30),
    complement: text(rawAddress.complement), neighborhood: text(rawAddress.neighborhood), city: text(rawAddress.city),
  };
  if (address.zipCode && !/^\d{5}-?\d{3}$/.test(address.zipCode)) throw problem('CEP fiscal deve ter 8 dígitos.');
  address.zipCode = address.zipCode.replace('-', '');
  if (!Number.isInteger(body.version) || body.version < 0) throw problem('Versão do cadastro inválida. Recarregue a lista.');
  const segments = body.segments ?? [];
  if (!Array.isArray(segments) || segments.some(s => !['comercio', 'ecommerce', 'industria', 'servicos'].includes(s)) || new Set(segments).size !== segments.length) throw problem('Segmentos da empresa inválidos.');
  const substituteStateRegistrations = body.substituteStateRegistrations ?? [];
  if (!Array.isArray(substituteStateRegistrations) || substituteStateRegistrations.length > 27) throw problem('Inscrições estaduais substitutas inválidas.');
  const substituteUfs = new Set();
  for (const entry of substituteStateRegistrations) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !STATES.has(entry.uf) || !text(entry.registration, 30)) throw problem('Inscrição estadual substituta inválida.');
    if (substituteUfs.has(entry.uf)) throw problem('UF substituta duplicada.');
    substituteUfs.add(entry.uf);
  }
  const email = text(body.email); const billingEmail = text(body.billingEmail);
  for (const value of [email, billingEmail]) if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw problem('E-mail da empresa inválido.');
  const cnae = text(body.cnae);
  const stateRegistrationExempt = body.stateRegistrationExempt ?? false;
  if (typeof stateRegistrationExempt !== 'boolean' || (stateRegistrationExempt && text(body.stateRegistration, 30))) throw problem('Isenção de IE incompatível com inscrição estadual informada.');
  const cnaeActivities = body.cnaeActivities ?? [];
  if (!Array.isArray(cnaeActivities) || cnaeActivities.length > 1000) throw problem('Lista de CNAEs inválida.');
  const codes = new Set(); let principalCount = 0;
  const activities = cnaeActivities.map(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.primary !== 'boolean') throw problem('CNAE inválido.');
    const code = String(entry.code || '').replace(/\D/g, '');
    const description = text(entry.description, 500);
    if (!/^\d{7}$/.test(code) || !description || codes.has(code)) throw problem('Código ou descrição de CNAE inválido ou duplicado.');
    codes.add(code); if (entry.primary) principalCount++;
    return { code, description, primary: entry.primary };
  });
  if (principalCount > 1) throw problem('Apenas um CNAE pode ser principal.');
  const principal = activities.find(entry => entry.primary);
  if (principal && cnae && cnae.replace(/\D/g, '').slice(0, 7) !== principal.code) throw problem('CNAE principal consultado difere do cadastro da empresa. Confira antes de salvar.');
  return { cnpj, name, legalName: text(body.legalName), stateRegistration: text(body.stateRegistration, 30), stateRegistrationExempt, municipalRegistration: text(body.municipalRegistration, 30), suframaRegistration: text(body.suframaRegistration, 30), cnae, cnaeActivities: activities, companySize: text(body.companySize, 80), mainActivity: text(body.mainActivity), segments, annualRevenueBand: text(body.annualRevenueBand, 80), employeesBand: text(body.employeesBand, 80), contactPerson: text(body.contactPerson), phone: text(body.phone, 30), mobilePhone: text(body.mobilePhone, 30), email, billingEmail, website: text(body.website), substituteStateRegistrations: substituteStateRegistrations.map(entry => ({ uf: entry.uf, registration: text(entry.registration, 30) })), uf, municipalityCode, address, regime, crt, effectiveFrom, notes: text(body.notes, 1000), version: body.version };
}
// A readiness gate for a draft issuer. It does not calculate taxes or authorize emission.
function validateIssuerReadiness(profile, address = profile?.address || {}, emissionDate = new Date().toISOString().slice(0, 10)) {
  const missing = [];
  const add = (condition, field) => { if (!condition) missing.push(field); };
  if (!profile || typeof profile !== 'object' || profile.identityConflict) return { ready: false, missing: ['empresa'] };
  add(validCnpj(profile.cnpj), 'cnpj');
  add(String(profile.legalName || '').trim(), 'razao_social');
  const ie = verifyStateRegistration(profile.stateRegistration, profile.uf);
  if (profile.stateRegistrationExempt) missing.push('isencao_ie_pendente_validacao');
  else {
    if (ie.status === 'missing') missing.push('inscricao_estadual');
    if (ie.status === 'invalid') missing.push('inscricao_estadual_invalida');
    if (ie.status === 'unsupported') missing.push('inscricao_estadual_uf_sem_regra');
  }
  add(STATES.has(String(profile.uf || '').toUpperCase()), 'uf');
  add(/^\d{7}$/.test(String(profile.municipalityCode || '')), 'municipio_ibge');
  if (STATE_IBGE[profile.uf] && /^\d{7}$/.test(String(profile.municipalityCode || '')) && !profile.municipalityCode.startsWith(STATE_IBGE[profile.uf])) missing.push('municipio_uf');
  add(/^\d{8}$/.test(String(address.zipCode || '').replace(/\D/g, '')), 'cep');
  for (const [key, label] of [['street','logradouro'],['number','numero'],['neighborhood','bairro'],['city','cidade']]) add(String(address[key] || '').trim(), label);
  add(profile.regime && profile.regime !== 'nao_definido' && REGIMES.includes(profile.regime), 'regime');
  const crt = String(profile.crt || '');
  add(['1','2','3','4'].includes(crt), 'crt');
  if (crt && profile.regime && profile.regime !== 'nao_definido') {
    try { validateProfile({ ...profile, version: profile.version || 0 }); }
    catch (err) { if (/CRT/.test(err.message)) missing.push('regime_crt_incompativeis'); }
  }
  add(/^\d{4}-\d{2}-\d{2}$/.test(String(profile.effectiveFrom || '')) && profile.effectiveFrom <= emissionDate, 'vigencia');
  return { ready: missing.length === 0, missing };
}
const normalizedPlace = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().toUpperCase();
async function verifyIbgeMunicipality(profile, { fetchImpl = fetch } = {}) {
  const code = String(profile?.municipalityCode || '');
  if (!/^\d{7}$/.test(code)) return { status: 'not_checked' };
  try {
    const response = await fetchImpl(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${code}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'unavailable' };
    const data = await response.json();
    const uf = data?.microrregiao?.mesorregiao?.UF?.sigla;
    const officialName = data?.nome;
    if (String(data?.id) !== code || typeof officialName !== 'string' || !STATES.has(uf)) return { status: 'unavailable' };
    return { status: uf === profile.uf && normalizedPlace(officialName) === normalizedPlace(profile.address?.city) ? 'confirmed' : 'mismatch', officialName, officialUf: uf };
  } catch { return { status: 'unavailable' }; }
}
async function inspectIssuerReadiness(profile, options = {}) {
  const readiness = validateIssuerReadiness(profile, undefined, options.emissionDate);
  if (!/^\d{7}$/.test(String(profile?.municipalityCode || '')) || !STATES.has(profile?.uf) || !String(profile?.address?.city || '').trim() || readiness.missing.includes('municipio_uf')) return { ...readiness, municipality: { status: 'not_checked' } };
  const municipality = await verifyIbgeMunicipality(profile, options);
  const extra = { mismatch: 'municipio_nome_uf', not_found: 'municipio_inexistente', unavailable: 'municipio_consulta_indisponivel' }[municipality.status];
  const missing = extra && !readiness.missing.includes(extra) ? [...readiness.missing, extra] : readiness.missing;
  return { ready: missing.length === 0, missing, municipality };
}
const bool = v => typeof v === 'boolean' ? v : null;
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
function normalizeLookup(data, cnpj, source, now = new Date()) {
  if (!data || normalizeCnpj(data.cnpj) !== cnpj) throw problem('A fonte retornou outro CNPJ. Nenhum dado foi atualizado.', 502);
  const simples = bool(data.opcao_pelo_simples), mei = bool(data.opcao_pelo_mei);
  if (mei === true && simples === false) throw problem('A fonte retornou informações tributárias conflitantes.', 502);
  const cnaeActivities = [];
  const seen = new Set();
  const addActivity = (codeValue, descriptionValue, primary) => {
    const code = String(codeValue ?? '').replace(/\D/g, '');
    const description = typeof descriptionValue === 'string' ? descriptionValue.trim().slice(0, 500) : '';
    if (/^\d{7}$/.test(code) && description && !seen.has(code)) { seen.add(code); cnaeActivities.push({ code, description, primary }); }
  };
  addActivity(data.cnae_fiscal, data.cnae_fiscal_descricao, true);
  for (const entry of Array.isArray(data.cnaes_secundarios) ? data.cnaes_secundarios : []) addActivity(entry?.codigo, entry?.descricao, false);
  const nullableText = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : null;
  const registry = {
    legalName: nullableText(data.razao_social), tradeName: nullableText(data.nome_fantasia),
    status: nullableText(data.descricao_situacao_cadastral, 100), statusDate: date(data.data_situacao_cadastral),
    openingDate: date(data.data_inicio_atividade), size: nullableText(data.porte, 100),
    legalNature: nullableText(data.natureza_juridica), email: nullableText(data.email),
    phone: nullableText(data.ddd_telefone_1, 30), secondaryPhone: nullableText(data.ddd_telefone_2, 30),
    address: {
      zipCode: nullableText(data.cep, 20), street: nullableText(data.logradouro), number: nullableText(data.numero, 50),
      complement: nullableText(data.complemento), neighborhood: nullableText(data.bairro), city: nullableText(data.municipio), uf: nullableText(data.uf, 2),
    },
  };
  return { cnpj, authority: 'Receita Federal do Brasil', source, officialDirect: false, consultedAt: now.toISOString(), sourceUpdatedAt: null, simples, mei,
    suggestedRegime: null,
    simplesSince: date(data.data_opcao_pelo_simples), simplesUntil: date(data.data_exclusao_do_simples),
    meiSince: date(data.data_opcao_pelo_mei), meiUntil: date(data.data_exclusao_do_mei),
    municipalityCode: /^\d{7}$/.test(String(data.codigo_municipio_ibge || '')) ? String(data.codigo_municipio_ibge) : null,
    cnaeActivities, registry };
}
async function lookupCnpj(cnpj, { fetchImpl = fetch, now = () => new Date() } = {}) {
  cnpj = normalizeCnpj(cnpj);
  if (!validCnpj(cnpj)) throw problem('CNPJ inválido.');
  // Public mirrors of the RFB CNPJ dataset. They are not the contracted, real-time SERPRO API.
  const providers = [['BrasilAPI (espelho da base pública CNPJ/RFB)', 'https://brasilapi.com.br/api/cnpj/v1/'], ['Minha Receita (espelho da base pública CNPJ/RFB)', 'https://minhareceita.org/']];
  let notFound = false;
  for (const [source, base] of providers) {
    try {
      const r = await fetchImpl(base + encodeURIComponent(cnpj), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) { notFound ||= r.status === 404; continue; }
      return normalizeLookup(await r.json(), cnpj, source, now());
    } catch { /* Do not print company data, upstream body or identifiers. */ }
  }
  throw problem(notFound ? 'CNPJ não encontrado nas fontes disponíveis. Mantenha a seleção manual e tente novamente depois.' : 'Consulta indisponível. Seus dados anteriores foram preservados. Tente novamente depois.', 502);
}
module.exports = { REGIMES, problem, normalizeCnpj, validCnpj, verifyStateRegistration, validateProfile, validateIssuerReadiness, verifyIbgeMunicipality, inspectIssuerReadiness, normalizeLookup, lookupCnpj };
