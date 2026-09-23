const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { validCnpj, normalizeLookup, normalizeSerproLookup, lookupCnpj, lookupSerproCnpj, validateProfile, validateIssuerReadiness, inspectIssuerReadiness, verifyStateRegistration } = require('../services/companyFiscalCore.cjs');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');
const CNPJ = '11222333000181', SECOND = '11444777000161';
const address = { zipCode: '56300000', street: 'Rua Teste', number: '10', complement: '', neighborhood: 'Centro', city: 'Petrolina' };
const profile = (patch = {}) => ({ cnpj: SECOND, name: 'Empresa de teste', legalName: '', stateRegistration: '', municipalRegistration: 'IM-123', suframaRegistration: '', cnae: '4751201', companySize: 'Micro', mainActivity: 'Comércio', segments: ['comercio', 'ecommerce'], annualRevenueBand: 'Maior que R$ 360.000,00', employeesBand: 'Até 5 funcionários', contactPerson: 'Contato fictício', phone: '0000000000', mobilePhone: '00000000000', email: 'empresa@example.test', billingEmail: 'cobranca@example.test', website: 'https://example.test', substituteStateRegistrations: [{uf:'SP',registration:'123456789'}], uf: 'PE', municipalityCode: '2611101', address: { ...address }, regime: 'lucro_presumido', crt: '3', effectiveFrom: '2026-01-01', notes: '', version: 0, ...patch });

test('CNPJ: numérico, alfanumérico oficial e rejeição sem remover caracteres inválidos', () => {
  assert(validCnpj(CNPJ)); assert(validCnpj('11.222.333/0001-81')); assert(validCnpj('12.ABC.345/01DE-35'));
  for (const value of ['00000000000000', '11222333000182', '11?222333000181', '11222333000181x']) assert(!validCnpj(value));
});
test('consulta não inventa regime a partir do cadastro do CNPJ', () => {
  for (const flag of [false, null, undefined, 'false']) {
    const result = normalizeLookup({ cnpj: CNPJ, opcao_pelo_simples: flag }, CNPJ, 'test');
    assert.equal(result.suggestedRegime, null);
    assert.equal(result.simples, flag === false ? false : null);
  }
  assert.equal(normalizeLookup({ cnpj: CNPJ, opcao_pelo_simples: true }, CNPJ, 'test').suggestedRegime, null);
  assert.equal(normalizeLookup({ cnpj: CNPJ, opcao_pelo_simples: true, opcao_pelo_mei: true }, CNPJ, 'test').suggestedRegime, null);
  assert.throws(() => normalizeLookup({ cnpj: SECOND }, CNPJ, 'test'));
  assert.throws(() => normalizeLookup({ cnpj: CNPJ, opcao_pelo_simples: false, opcao_pelo_mei: true }, CNPJ, 'test'));
});
test('falha da primeira fonte usa alternativa e só devolve campos fiscais permitidos', async () => {
  const urls = [];
  const result = await lookupCnpj(CNPJ, { now: () => new Date('2026-09-22T12:00:00Z'), fetchImpl: async url => {
    urls.push(url);
    return urls.length === 1 ? { ok: false, status: 403 } : { ok: true, json: async () => ({ cnpj: CNPJ, opcao_pelo_simples: true, qsa: [{ cpf: 'nao-retornar' }] }) };
  } });
  assert.equal(urls.length, 2); assert.equal(result.source, 'Minha Receita (espelho da base pública CNPJ/RFB)'); assert(!('qsa' in result));
  assert.equal(result.authority, 'Receita Federal do Brasil'); assert.equal(result.officialDirect, false);
  assert.equal(result.consultedAt, '2026-09-22T12:00:00.000Z');
  await assert.rejects(lookupCnpj(CNPJ, { fetchImpl: async () => { throw new Error('timeout'); } }), /preservados/);
});
test('consulta de CNPJ preserva principal, todos os secundários distintos e descrições', () => {
  const result = normalizeLookup({ cnpj: CNPJ, cnae_fiscal: 4751201, cnae_fiscal_descricao: 'Comércio especializado', cnaes_secundarios: [{ codigo: 4789001, descricao: 'Comércio de outros produtos' }, { codigo: 6201501, descricao: 'Desenvolvimento de programas' }, { codigo: 4751201, descricao: 'Duplicado' }] }, CNPJ, 'test');
  assert.deepEqual(result.cnaeActivities,[{ code:'4751201',description:'Comércio especializado',primary:true },{ code:'4789001',description:'Comércio de outros produtos',primary:false },{ code:'6201501',description:'Desenvolvimento de programas',primary:false }]);
});
test('consulta preserva os campos cadastrais retornados e não mistura IE ou CRT', () => {
  const result = normalizeLookup({ cnpj: CNPJ, razao_social: 'EMPRESA TESTE LTDA', nome_fantasia: 'Loja Teste', descricao_situacao_cadastral: 'ATIVA', data_situacao_cadastral: '2020-01-02', data_inicio_atividade: '2019-08-30', porte: 'MICRO EMPRESA', natureza_juridica: 'Empresário (Individual)', email: 'cadastro@example.test', ddd_telefone_1: '87999990000', cep: '56300000', logradouro: 'Rua A', numero: '5', complemento: 'Loja C', bairro: 'Centro', municipio: 'Petrolina', uf: 'PE', inscricao_estadual: 'nao-deve-entrar', crt: 'nao-deve-entrar' }, CNPJ, 'fixture', new Date('2026-09-23T12:00:00Z'));
  assert.deepEqual(result.registry, { legalName:'EMPRESA TESTE LTDA', tradeName:'Loja Teste', status:'ATIVA', statusDate:'2020-01-02', openingDate:'2019-08-30', size:'MICRO EMPRESA', legalNature:'Empresário (Individual)', email:'cadastro@example.test', phone:'87999990000', secondaryPhone:null, address:{ zipCode:'56300000', street:'Rua A', number:'5', complement:'Loja C', neighborhood:'Centro', city:'Petrolina', uf:'PE' } });
  assert(!('stateRegistration' in result.registry)); assert(!('crt' in result.registry));
});
test('retorno oficial SERPRO v2 preserva os campos recebidos e marca consulta direta', () => {
  const result = normalizeSerproLookup({ ni:CNPJ, nomeEmpresarial:'EMPRESA OFICIAL LTDA', nomeFantasia:'Oficial', situacaoCadastral:{codigo:'02',data:'2020-01-02'}, naturezaJuridica:{codigo:'2135',descricao:'Empresário'}, dataAbertura:'2019-08-30', cnaePrincipal:{codigo:'4751201',descricao:'Comércio'}, cnaeSecundarias:[{codigo:'6201501',descricao:'Software'}], endereco:{cep:'56300000',logradouro:'Rua A',numero:'5',bairro:'Centro',municipio:{codigo:'2611101',descricao:'Petrolina'},uf:'PE'}, telefone:[{ddd:'87',numero:'999990000'}], correioEletronico:'cadastro@example.test', porte:'01', opcaoSimples:true }, CNPJ, new Date('2026-09-23T12:00:00Z'));
  assert.equal(result.authority,'Receita Federal do Brasil'); assert.equal(result.officialDirect,true);
  assert.equal(result.source,'SERPRO Consulta CNPJ v2 (base oficial da Receita Federal)');
  assert.equal(result.registry.legalName,'EMPRESA OFICIAL LTDA'); assert.equal(result.registry.status,'02');
  assert.equal(result.municipalityCode,'2611101'); assert.equal(result.registry.address.city,'Petrolina');
  assert.deepEqual(result.cnaeActivities,[{code:'4751201',description:'Comércio',primary:true},{code:'6201501',description:'Software',primary:false}]);
  assert.equal(result.suggestedRegime,null); assert.equal(result.simples,null);
});
test('cliente SERPRO usa OAuth2 sem expor segredo e consulta endpoint oficial', async () => {
  const calls = [];
  const result = await lookupSerproCnpj(CNPJ, { consumerKey:'key-fixture', consumerSecret:'secret-fixture', now:()=>new Date('2026-09-23T12:00:00Z'), nowMs:()=>1000, fetchImpl:async (url, options) => {
    calls.push({url,options});
    if (calls.length === 1) return {ok:true,status:200,json:async()=>({access_token:'token-fixture',expires_in:3600})};
    return {ok:true,status:200,json:async()=>({ni:CNPJ,nomeEmpresarial:'EMPRESA OFICIAL LTDA'})};
  }});
  assert.equal(calls[0].url,'https://gateway.apiserpro.serpro.gov.br/token');
  assert.equal(calls[0].options.method,'POST'); assert.match(calls[0].options.headers.Authorization,/^Basic /);
  assert(!calls[0].options.headers.Authorization.includes('secret-fixture'));
  assert.equal(calls[1].url,`https://gateway.apiserpro.serpro.gov.br/consulta-cnpj-df/v2/basica/${CNPJ}`);
  assert.equal(calls[1].options.headers.Authorization,'Bearer token-fixture'); assert.equal(result.officialDirect,true);
});
test('consulta prioriza SERPRO quando as duas chaves existem e bloqueia configuração parcial', async () => {
  const urls = [];
  const result = await lookupCnpj(CNPJ, { env:{SERPRO_CNPJ_CONSUMER_KEY:'key-priority',SERPRO_CNPJ_CONSUMER_SECRET:'secret-priority'}, nowMs:()=>2000, fetchImpl:async url => {
    urls.push(url);
    if (urls.length === 1) return {ok:true,status:200,json:async()=>({access_token:'token-priority',expires_in:3600})};
    return {ok:true,status:200,json:async()=>({ni:CNPJ,nomeEmpresarial:'EMPRESA OFICIAL LTDA'})};
  }});
  assert.equal(urls.length,2); assert(urls.every(url=>url.includes('apiserpro.serpro.gov.br'))); assert.equal(result.officialDirect,true);
  await assert.rejects(lookupCnpj(CNPJ,{env:{SERPRO_CNPJ_CONSUMER_KEY:'incompleta'},fetchImpl:async()=>{ throw new Error('não deveria consultar'); }}),/parcialmente configurada/);
});
test('configuração manual mantém opções, valida CRT, calendário e versão', () => {
  for (const regime of ['nao_definido', 'simples_nacional', 'mei', 'lucro_presumido', 'lucro_real', 'lucro_arbitrado', 'imune', 'isenta', 'outro']) assert.equal(validateProfile(profile({ regime, crt: '' })).regime, regime);
  assert.throws(() => validateProfile(profile({ regime: 'mei', crt: '1' })), /compatível/);
  assert.throws(() => validateProfile(profile({ effectiveFrom: '2026-02-30' })), /vigência/);
  assert.throws(() => validateProfile(profile({ version: -1 })), /Versão/);
  assert.equal(validateProfile(profile({ address: { ...address, zipCode: '56300-000' } })).address.zipCode, '56300000');
  assert.throws(() => validateProfile(profile({ address: { ...address, zipCode: '5630' } })), /CEP/);
  assert.throws(() => validateProfile(profile({ segments: ['comercio', 'comercio'] })), /Segmentos/);
  assert.throws(() => validateProfile(profile({ billingEmail: 'sem-arroba' })), /E-mail/);
  assert.throws(() => validateProfile(profile({ substituteStateRegistrations: [{ uf: 'SP', registration: '123' }, { uf: 'SP', registration: '456' }] })), /duplicada/);
  assert.equal(validateProfile(profile({ stateRegistrationExempt: true })).stateRegistrationExempt,true);
  assert.throws(() => validateProfile(profile({ stateRegistrationExempt: true, stateRegistration: '123' })), /Isenção/);
  assert.throws(() => validateProfile(profile({ cnaeActivities:[{code:'6201501',description:'Software',primary:true}] })), /difere/);
});

test('pré-validação do emitente exige identidade, endereço e vigência sem inferir dados', () => {
  const issuer = profile({ legalName: 'Empresa de teste Ltda', stateRegistration: '0321418-40', regime: 'lucro_real', crt: '3' });
  assert.deepEqual(validateIssuerReadiness(issuer,undefined,'2026-09-22'),{ready:true,missing:[]});
  const incomplete = validateIssuerReadiness({ ...issuer, stateRegistration:'', effectiveFrom:'2026-10-01', crt:'1' },{...address,number:''},'2026-09-22');
  assert.equal(incomplete.ready,false);
  assert.deepEqual(incomplete.missing,['inscricao_estadual','numero','regime_crt_incompativeis','vigencia']);
  assert.deepEqual(validateIssuerReadiness({...issuer,identityConflict:true},address).missing,['empresa']);
  assert.deepEqual(validateIssuerReadiness({...issuer,stateRegistration:'',stateRegistrationExempt:true},undefined,'2026-09-22').missing,['isencao_ie_pendente_validacao']);
  assert.deepEqual(validateIssuerReadiness({...issuer,municipalityCode:'5300108'},undefined,'2026-09-22').missing,['municipio_uf']);
});

test('IE de Pernambuco segue os dois dígitos do exemplo oficial; outras UFs ficam pendentes', () => {
  assert.deepEqual(verifyStateRegistration('0321418-40','PE'),{status:'valid'});
  assert.deepEqual(verifyStateRegistration('032141841','PE'),{status:'invalid'});
  assert.deepEqual(verifyStateRegistration('0321418-40','DF'),{status:'unsupported'});
  assert.deepEqual(verifyStateRegistration('','PE'),{status:'missing'});
  assert.deepEqual(verifyStateRegistration('ISENTO','PE'),{status:'invalid'});
  assert.deepEqual(validateIssuerReadiness(profile({legalName:'Empresa',stateRegistration:'032141841'}),undefined,'2026-09-22').missing,['inscricao_estadual_invalida']);
  assert.deepEqual(validateIssuerReadiness(profile({legalName:'Empresa',stateRegistration:'032141840',uf:'DF',municipalityCode:'5300108',address:{...address,city:'Brasília'}}),undefined,'2026-09-22').missing,['inscricao_estadual_uf_sem_regra']);
});

test('IBGE confirma município completo, aponta divergência e não aprova indisponibilidade', async () => {
  const issuer = profile({ legalName:'Empresa de teste Ltda',stateRegistration:'032141840' });
  const official = { id:2611101,nome:'Petrolina',microrregiao:{mesorregiao:{UF:{sigla:'PE'}}} };
  const fetchImpl = async () => ({ok:true,status:200,json:async()=>official});
  const good = await inspectIssuerReadiness(issuer,{fetchImpl,emissionDate:'2026-09-22'});
  assert.equal(good.ready,true);assert.equal(good.municipality.status,'confirmed');
  const wrongCity = await inspectIssuerReadiness({...issuer,address:{...address,city:'Recife'}},{fetchImpl,emissionDate:'2026-09-22'});
  assert.deepEqual(wrongCity.missing,['municipio_nome_uf']);assert.equal(wrongCity.municipality.officialName,'Petrolina');
  const absent = await inspectIssuerReadiness(issuer,{fetchImpl:async()=>({ok:false,status:404}),emissionDate:'2026-09-22'});
  assert.deepEqual(absent.missing,['municipio_inexistente']);
  const unavailable = await inspectIssuerReadiness(issuer,{fetchImpl:async()=>{throw new Error('offline');},emissionDate:'2026-09-22'});
  assert.deepEqual(unavailable.missing,['municipio_consulta_indisponivel']);
});

// A deterministic SQL adapter exercises route behavior without writing production.
function database() {
  const state = { rows: [], events: [], queries: [], settings: { id: 'primary-settings', cnpj: CNPJ, name: 'Loja principal', razao_social: 'Loja Ltda', state_registration: '123', cnae: '4751201', porte: 'Micro', phone: '0000000000', email: 'principal@example.test', social_website: 'https://loja.example.test', address_state: 'PE', address_zip_code: '56300000', address_street: 'Rua Loja', address_number: '1', address_complement: '', address_neighborhood: 'Centro', address_city: 'Petrolina' } };
  const db = { async query(sql, args = []) {
    state.queries.push(sql);
    if (sql.startsWith('SELECT id,cnpj')) return [[state.settings]];
    if (sql.startsWith('SELECT * FROM company_fiscal_profiles')) {
      let rows = state.rows;
      if (sql.includes('WHERE settings_id')) rows = rows.filter(r => r.settings_id === args[0]);
      else if (sql.includes('WHERE id')) rows = rows.filter(r => r.id === args[0] && (!sql.includes('settings_id IS NULL') || !r.settings_id));
      return [structuredClone(rows)];
    }
    if (sql.startsWith('INSERT INTO company_fiscal_profiles')) {
      if (state.rows.some(r => r.cnpj === args[0] || (args[35] && r.settings_id === args[35]))) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      const keys = ['cnpj','name','legal_name','state_registration','municipal_registration','uf','municipality_code','address_zip_code','address_street','address_number','address_complement','address_neighborhood','address_city','regime','crt','effective_from','notes','updated_by','suframa_registration','cnae','company_size','main_activity','business_segments','annual_revenue_band','employees_band','contact_person','phone','mobile_phone','email','billing_email','website','substitute_state_registrations','state_registration_exempt','cnae_activities','id','settings_id'];
      state.rows.push({ ...Object.fromEntries(keys.map((k, i) => [k, args[i]])), version: 1, lookup_json: null }); return [{}];
    }
    if (sql.startsWith('UPDATE company_fiscal_profiles SET lookup_json')) {
      const row = state.rows.find(r => r.id === args[2]); row.lookup_json = args[0]; row.version++; return [{}];
    }
    if (sql.startsWith('UPDATE company_fiscal_profiles SET cnpj')) {
      const row = state.rows.find(r => r.id === args[34]);
      ['cnpj','name','legal_name','state_registration','municipal_registration','uf','municipality_code','address_zip_code','address_street','address_number','address_complement','address_neighborhood','address_city','regime','crt','effective_from','notes','updated_by','suframa_registration','cnae','company_size','main_activity','business_segments','annual_revenue_band','employees_band','contact_person','phone','mobile_phone','email','billing_email','website','substitute_state_registrations','state_registration_exempt','cnae_activities'].forEach((k, i) => row[k] = args[i]); row.version++; return [{}];
    }
    if (sql.startsWith('INSERT INTO company_fiscal_events')) { state.events.push(args); return [{}]; }
    throw new Error('Unexpected SQL: ' + sql);
  }, async getConnection() {
    const snapshot = structuredClone({ rows: state.rows, events: state.events });
    return { query: db.query, async beginTransaction() {}, async commit() {}, async rollback() { state.rows = snapshot.rows; state.events = snapshot.events; }, release() {} };
  } };
  return { db, state };
}
async function setup(t, options = {}) {
  const { db, state } = database(); const app = Fastify();
  registerCompanyFiscalRoutes(app, { pool: db, enabled: true, getBearerAuthContext: async req => req.headers.authorization === 'Bearer test' ? { isAdmin: true, userId: 'test-admin' } : {}, lookup: async cnpj => normalizeLookup({ cnpj, opcao_pelo_simples: true, opcao_pelo_mei: false }, cnpj, 'test'), municipalityLookupFetch: async () => ({ok:true,status:200,json:async()=>({id:2611101,nome:'Petrolina',microrregiao:{mesorregiao:{UF:{sigla:'PE'}}}})}), ...options });
  t.after(() => app.close());
  const call = (method, url, payload) => app.inject({ method, url: '/admin/fiscal-companies' + url, payload, headers: { authorization: 'Bearer test' } });
  return { app, call, state };
}
test('autenticação e chave de ativação impedem acesso e não consultam tabelas ausentes', async t => {
  const { app, call, state } = await setup(t, { enabled: false });
  assert.equal((await app.inject('/admin/fiscal-companies')).statusCode, 401);
  assert.deepEqual((await call('GET', '')).json(), { enabled: false, companies: [] });
  assert.equal((await call('POST', '', profile())).statusCode, 503); assert.equal(state.queries.length, 0);
  assert.equal((await call('GET', '/primary/readiness')).statusCode, 503); assert.equal(state.queries.length, 0);
});

test('consulta canônica de CNPJ é autenticada, não grava e devolve a fonte normalizada', async t => {
  const lookup = async cnpj => normalizeLookup({
    cnpj,
    razao_social: 'EMPRESA CANÔNICA LTDA',
    cnae_fiscal: 4752100,
    cnae_fiscal_descricao: 'Comércio de telefonia',
    cnaes_secundarios: [{ codigo: 4321500, descricao: 'Instalação elétrica' }],
  }, cnpj, 'fonte canônica de teste');
  const { app, state } = await setup(t, { lookup });
  assert.equal((await app.inject(`/admin/cnpj-lookup/${CNPJ}`)).statusCode, 401);
  const before = JSON.stringify(state);
  const response = await app.inject({ method:'GET', url:`/admin/cnpj-lookup/${CNPJ}`, headers:{ authorization:'Bearer test' } });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().source, 'fonte canônica de teste');
  assert.equal(response.json().registry.legalName, 'EMPRESA CANÔNICA LTDA');
  assert.deepEqual(response.json().cnaeActivities, [
    { code:'4752100', description:'Comércio de telefonia', primary:true },
    { code:'4321500', description:'Instalação elétrica', primary:false },
  ]);
  assert.equal(JSON.stringify(state), before);
});

test('pré-validação autenticada usa o perfil selecionado e é somente leitura', async t => {
  const { app, call, state } = await setup(t);
  assert.equal((await app.inject('/admin/fiscal-companies/primary/readiness')).statusCode,401);
  const secondary = (await call('POST','',profile({ legalName:'Empresa B Ltda',stateRegistration:'032141840' }))).json();
  const before = JSON.stringify(state.rows);
  const checked = (await call('GET',`/${secondary.id}/readiness`)).json();
  assert.equal(checked.ready,true);
  assert.deepEqual(checked.missing,[]);
  assert.equal(JSON.stringify(state.rows),before);
  assert.equal((await call('GET','/primary/readiness')).json().ready,false);
  const changed = await call('PUT',`/${secondary.id}`,{ ...secondary, municipalityCode:'5300108' });
  assert.equal(changed.statusCode,200);
  assert.deepEqual((await call('GET',`/${secondary.id}/readiness`)).json().missing,['municipio_uf']);
});
test('empresa principal reaproveita identidade e não grava em GET; CNPJ principal não pode ser duplicado', async t => {
  const { call, state } = await setup(t);
  const list = (await call('GET', '')).json(); assert.equal(list.companies[0].id, 'primary'); assert.equal(state.rows.length, 0);
  assert.equal(list.companies[0].identitySource, 'company_settings');
  assert.equal((await call('POST', '', profile({ cnpj: CNPJ }))).statusCode, 409);
  const saved = await call('PUT', '/primary', profile({
    name: 'tentativa de sobrescrever', cnpj: SECOND, legalName: 'Outra razão social', stateRegistration: '999999999',
    companySize: 'Grande', phone: '0000', email: 'forjado@example.test', website: 'https://forjado.example.test',
    uf: 'SP', address: { zipCode: '00000000', street: 'Rua Forjada', number: '99', complement: '', neighborhood: 'Outro', city: 'Outra' }
  }));
  assert.equal(saved.statusCode, 200); assert.equal(saved.json().cnpj, CNPJ); assert.equal(saved.json().name, 'Loja principal');
  assert.equal(saved.json().identitySource, 'company_settings');
  assert.equal(saved.json().legalName, 'Loja Ltda');
  assert.equal(saved.json().stateRegistration, '123');
  assert.equal(saved.json().companySize, 'Micro');
  assert.equal(saved.json().phone, '0000000000');
  assert.equal(saved.json().municipalRegistration, 'IM-123');
  assert.equal(saved.json().cnae, '4751201');
  assert.equal(saved.json().email, 'principal@example.test');
  assert.equal(saved.json().website, 'https://loja.example.test');
  assert.equal(saved.json().uf, 'PE');
  assert.equal(state.settings.name, 'Loja principal');
  assert.equal(saved.json().address.street, 'Rua Loja');
  assert.equal(state.settings.address_street, 'Rua Loja');
});
test('duas empresas isoladas; atualização não substitui seleção manual e rejeita versão antiga', async t => {
  const { call, state } = await setup(t);
  const primary = (await call('PUT', '/primary', profile())).json();
  const other = (await call('POST', '', profile({ regime: 'lucro_real' }))).json();
  assert.equal(primary.identitySource, 'company_settings');
  assert.equal(other.identitySource, 'fiscal_profile');
  assert.equal((await call('POST', '', profile())).statusCode, 409);
  const updated = await call('POST', `/${other.id}/refresh`, { version: other.version });
  assert.equal(updated.statusCode, 200); assert.equal(updated.json().regime, 'lucro_real'); assert.equal(updated.json().crt, '3');
  assert.equal(updated.json().lookup.simples, true);
  assert.equal(updated.json().municipalRegistration, 'IM-123');
  assert.deepEqual(updated.json().segments, ['comercio', 'ecommerce']);
  assert.equal(updated.json().billingEmail, 'cobranca@example.test');
  assert.deepEqual(updated.json().substituteStateRegistrations,[{uf:'SP',registration:'123456789'}]);
  assert.equal(updated.json().address.street, 'Rua Teste');
  assert.equal(state.rows.find(r => r.settings_id)?.lookup_json, null);
  assert.equal((await call('PUT', `/${other.id}`, other)).statusCode, 409);
  assert.equal((await call('PUT', '/primary', { ...primary, regime: 'simples_nacional', crt: '2' })).statusCode, 200);
  assert.equal(state.events.length, 4);
});
test('consulta externa com falha preserva versão e informação anterior', async t => {
  const { call, state } = await setup(t, { lookup: async () => { throw Object.assign(new Error('indisponível'), { statusCode: 502 }); } });
  const company = (await call('POST', '', profile())).json();
  const before = JSON.stringify(state.rows);
  assert.equal((await call('POST', `/${company.id}/refresh`, { version: company.version })).statusCode, 502);
  assert.equal(JSON.stringify(state.rows), before);
});

test('mudança externa do CNPJ principal bloqueia salvamento e consulta do vínculo antigo', async t => {
  const { call, state } = await setup(t);
  const primary = (await call('PUT', '/primary', profile())).json();
  state.settings.cnpj = SECOND;
  const listed = (await call('GET', '')).json().companies[0];
  assert.equal(listed.identityConflict, true);
  assert.equal((await call('PUT', '/primary', primary)).statusCode, 409);
  assert.equal((await call('POST', '/primary/refresh', { version: primary.version })).statusCode, 409);
  assert.equal(state.rows[0].cnpj, CNPJ);
  assert.equal(state.events.length, 1);
});

test('consulta em andamento não sobrescreve uma edição posterior', async t => {
  let release, started;
  const pending = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const { call, state } = await setup(t, { lookup: async cnpj => {
    started(); await pending;
    return normalizeLookup({ cnpj, opcao_pelo_simples: true }, cnpj, 'fixture');
  } });
  const company = (await call('POST', '', profile())).json();
  const refresh = call('POST', `/${company.id}/refresh`, { version: 1 }).then(r => r);
  await entered;
  assert.equal((await call('POST', `/${company.id}/refresh`, { version: 1 })).statusCode, 429);
  assert.equal((await call('PUT', `/${company.id}`, { ...company, regime: 'simples_nacional', crt: '2' })).statusCode, 200);
  release();
  assert.equal((await refresh).statusCode, 409);
  assert.equal(state.rows[0].regime, 'simples_nacional');
  assert.equal(state.rows[0].lookup_json, null);
  assert.equal(state.rows[0].version, 2);
});

test('todas as mutações exigem administrador e ignoram resultado de consulta forjado', async t => {
  const { app, call, state } = await setup(t);
  for (const [method, suffix] of [['POST', ''], ['PUT', '/primary'], ['POST', '/primary/refresh']]) {
    assert.equal((await app.inject({ method, url: '/admin/fiscal-companies' + suffix, payload: profile() })).statusCode, 401);
  }
  assert.equal(state.queries.length, 0);
  const saved = await call('POST', '', profile({ lookup: { simples: true, source: 'forjado' } }));
  assert.equal(saved.statusCode, 201);
  assert.equal(saved.json().lookup, null);
});
