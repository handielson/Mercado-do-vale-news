const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../services/fiscalTaxProfileCore.cjs');
const catalog = require('../services/fiscalCatalog.cjs');

const approvedBy = { reviewerName: 'Contadora Teste', reviewerRegistration: 'CRC-PE 000000', reviewedAt: '2026-11-01' };
const celularST = {
  name: 'Celular com ST', status: 'approved', requiresCest: true, ncmPrefixes: ['85171300'], ...approvedBy,
  nfce: { cfop: '5405', csosn: '500', pisCst: '49', pisRate: '0', cofinsCst: '49', cofinsRate: '0', unit: 'UN' },
  nfe: { cfopInternal: '5405', cfopInterstate: '6404', csosn: '500', pisCst: '49', cofinsCst: '49', unit: 'UN' },
};
const acessorio = {
  name: 'Acessório sem ST', status: 'approved', requiresCest: false, ncmPrefixes: ['8504', '85'], ...approvedBy,
  nfce: { cfop: '5102', csosn: '102', pisCst: '49', cofinsCst: '49' },
  nfe: { cfopInternal: '5102', cfopInterstate: '6102', csosn: '102', pisCst: '49', cofinsCst: '49' },
};
const view = (input, id) => core.profileView({ id, company_profile_id: 'c', name: input.name, status: input.status, version: 1, data_json: core.normalizeProfile(input).profile });

test('perfil aprovado completo passa sem erros e sem avisos', () => {
  const { errors, warnings } = core.normalizeProfile(celularST);
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
});
test('aprovar sem dados da contadora é recusado', () => {
  assert.throws(() => core.normalizeProfile({ ...celularST, reviewerName: '' }), /Para aprovar/);
});
test('rascunho incompleto pode ser salvo e lista o que falta', () => {
  const { profile, errors } = core.normalizeProfile({ name: 'Produto 3D' });
  assert.equal(profile.status, 'draft'); assert.ok(errors.some(e => /CSOSN/.test(e)));
});
test('formato inválido é recusado', () => {
  assert.throws(() => core.normalizeProfile({ name: 'x', nfce: { csosn: '999' } }), /não existe/);
  assert.throws(() => core.normalizeProfile({ name: 'x', nfce: { cfop: '51' } }), /CFOP/);
  assert.throws(() => core.normalizeProfile({ name: 'x', nfce: { pisRate: '150' } }), /percentual/);
});
test('avisa CSOSN de ST com CFOP sem ST e PIS/COFINS com alíquota no Simples', () => {
  const { warnings } = core.normalizeProfile({ name: 'x', nfce: { cfop: '5102', csosn: '500', pisCst: '49', cofinsCst: '01', pisRate: '0.65' } });
  assert.ok(warnings.some(w => /substituição tributária/.test(w)));
  assert.ok(warnings.some(w => /DAS/.test(w)));
  assert.ok(warnings.some(w => /diferentes/.test(w)));
  assert.ok(warnings.some(w => /exige CEST/.test(w)));
});
test('CSOSN 101 exige pCredSN; outros descartam', () => {
  assert.ok(core.normalizeProfile({ name: 'x', nfce: { cfop: '5102', csosn: '101', pisCst: '49', cofinsCst: '49' } }).errors.some(e => /pCredSN/.test(e)));
  assert.equal(core.normalizeProfile({ name: 'x', nfce: { csosn: '102', pCredSN: '1.25' } }).profile.nfce.pCredSN, '');
});
test('celular com ST: NFC-e usa 5405/500 e exige CEST compatível', () => {
  const profile = view(celularST, 'p1');
  const ok = core.resolveProductTax({ product: { ncm: '85171300', cest: '2105300', origin: '0' }, profile, model: '65', catalog });
  assert.equal(ok.ready, true, ok.issues.join()); assert.equal(ok.fields.cfop, '5405'); assert.equal(ok.fields.csosn, '500');
  const sem = core.resolveProductTax({ product: { ncm: '85171300', origin: '0' }, profile, model: '65', catalog });
  assert.ok(sem.issues.includes('cest_required_missing'));
  const errado = core.resolveProductTax({ product: { ncm: '85171300', cest: '2104300', origin: '0' }, profile, model: '65', catalog });
  assert.ok(errado.issues.includes('cest_not_compatible_with_ncm'));
});
test('NF-e escolhe CFOP pelo destino', () => {
  const profile = view(celularST, 'p1');
  const product = { ncm: '85171300', cest: '2105300', origin: '0' };
  assert.equal(core.resolveProductTax({ product, profile, model: '55', destination: 'internal', catalog }).fields.cfop, '5405');
  assert.equal(core.resolveProductTax({ product, profile, model: '55', destination: 'interstate', catalog }).fields.cfop, '6404');
});
test('acessório sem ST não exige CEST', () => {
  const r = core.resolveProductTax({ product: { ncm: '85044010', origin: '0' }, profile: view(acessorio, 'p2'), model: '65', catalog });
  assert.equal(r.ready, true, r.issues.join()); assert.equal(r.fields.cfop, '5102');
});
test('NCM de 6 dígitos bloqueia o produto', () => {
  const r = core.resolveProductTax({ product: { ncm: '851713', cest: '2105300', origin: '0' }, profile: view(celularST, 'p1'), model: '65', catalog });
  assert.ok(r.issues.includes('ncm_incomplete'));
});
test('produto sem perfil ou com perfil em rascunho não fica pronto', () => {
  assert.ok(core.resolveProductTax({ product: { ncm: '85171300', origin: '0' }, model: '65', catalog }).issues.includes('fiscal_profile_missing'));
  const draft = view({ ...celularST, status: 'draft' }, 'p3');
  assert.ok(core.resolveProductTax({ product: { ncm: '85171300', cest: '2105300', origin: '0' }, profile: draft, model: '65', catalog }).issues.includes('fiscal_profile_not_approved'));
});
test('ajuste só no produto sobrescreve o campo do perfil', () => {
  const overrides = core.normalizeOverrides({ nfce: { cfop: '5403', csosn: '', unit: '' } });
  assert.deepEqual(overrides, { nfce: { cfop: '5403' } });
  const r = core.resolveProductTax({ product: { ncm: '85171300', cest: '2105300', origin: '0' }, settings: { overrides }, profile: view(celularST, 'p1'), model: '65', catalog });
  assert.equal(r.fields.cfop, '5403'); assert.deepEqual(r.overriddenFields, ['cfop']); assert.equal(r.fields.csosn, '500');
});
test('perfil sem NF-e não serve para modelo 55', () => {
  const p = view({ ...acessorio, nfe: { used: false } }, 'p4');
  assert.ok(core.resolveProductTax({ product: { ncm: '85044010', origin: '0' }, profile: p, model: '55', catalog }).issues.includes('profile_not_used_for_nfe'));
});
test('sugestão de perfil pelo NCM usa o prefixo mais específico', () => {
  const profiles = [view(acessorio, 'p2'), view(celularST, 'p1')];
  assert.equal(core.suggestProfile(profiles, '85171300').id, 'p1');
  assert.equal(core.suggestProfile(profiles, '85044010').id, 'p2');
  assert.equal(core.suggestProfile(profiles, '39269090'), null);
});
