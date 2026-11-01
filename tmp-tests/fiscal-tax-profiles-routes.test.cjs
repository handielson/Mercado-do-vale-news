const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Fastify = require('fastify');
const { registerFiscalTaxProfileRoutes } = require('../services/fiscalTaxProfilesServer.cjs');

const company = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const phone = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cable = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const broken = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const parent = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const approvedBy = { reviewerName: 'Contadora', reviewerRegistration: 'CRC-PE 1', reviewedAt: '2026-11-01' };
const celular = { name: 'Celular com ST', status: 'approved', requiresCest: true, ncmPrefixes: ['85171300'], ...approvedBy,
  nfce: { cfop: '5405', csosn: '500', pisCst: '49', cofinsCst: '49' }, nfe: { cfopInternal: '5405', cfopInterstate: '6404', csosn: '500', pisCst: '49', cofinsCst: '49' } };

function fakeDb() {
  const db = {
    profiles: [], settings: [], events: [],
    products: [
      { id: phone, name: 'Smartphone X', sku: 'SMX', ncm: '8517.13.00', cest: '21.053.00', origin: '0', status: 'active', is_parent: 0 },
      { id: cable, name: 'Cabo USB', sku: 'CAB', ncm: '8544.42.00', cest: '', origin: '0', status: 'active', is_parent: 0 },
      { id: broken, name: 'Celular NCM curto', sku: 'BRK', ncm: '851713', cest: '', origin: '0', status: 'active', is_parent: 0 },
      { id: parent, name: 'Pai', sku: 'PAI', ncm: '85171300', cest: '', origin: '0', status: 'active', is_parent: 1 },
    ],
  };
  const clone = row => row && JSON.parse(JSON.stringify(row));
  async function query(sql, p = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('INSERT INTO company_fiscal_events')) { db.events.push({ actor: p[1], event: p[2], details: JSON.parse(p[3]) }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('SELECT * FROM company_fiscal_tax_profiles WHERE company_profile_id=? ORDER BY name')) return [db.profiles.filter(r => r.company_profile_id === p[0]).sort((a, b) => a.name.localeCompare(b.name)).map(clone)];
    if (s.startsWith('SELECT * FROM company_fiscal_tax_profiles WHERE id=? AND company_profile_id=?')) return [db.profiles.filter(r => r.id === p[0] && r.company_profile_id === p[1]).map(clone)];
    if (s.startsWith('SELECT * FROM company_fiscal_tax_profiles WHERE id=?')) return [db.profiles.filter(r => r.id === p[0]).map(clone)];
    if (s.startsWith('SELECT id FROM company_fiscal_tax_profiles WHERE company_profile_id=? AND name=? AND id<>?')) return [db.profiles.filter(r => r.company_profile_id === p[0] && r.name === p[1] && r.id !== p[2])];
    if (s.startsWith('SELECT id FROM company_fiscal_tax_profiles WHERE company_profile_id=? AND name=?')) return [db.profiles.filter(r => r.company_profile_id === p[0] && r.name === p[1])];
    if (s.startsWith('INSERT INTO company_fiscal_tax_profiles')) { db.profiles.push({ id: p[0], company_profile_id: p[1], name: p[2], status: p[3], data_json: p[4], version: 1, updated_by: p[5] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('UPDATE company_fiscal_tax_profiles SET')) { const r = db.profiles.find(x => x.id === p[4]); Object.assign(r, { name: p[0], status: p[1], data_json: p[2], version: r.version + 1, updated_by: p[3] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('DELETE FROM company_fiscal_tax_profiles')) { db.profiles = db.profiles.filter(r => r.id !== p[0]); return [{ affectedRows: 1 }]; }
    if (s.startsWith('SELECT tax_profile_id, COUNT(*) AS total')) { const m = new Map(); for (const r of db.settings) if (r.company_profile_id === p[0] && r.tax_profile_id) m.set(r.tax_profile_id, (m.get(r.tax_profile_id) || 0) + 1); return [[...m].map(([tax_profile_id, total]) => ({ tax_profile_id, total }))]; }
    if (s.startsWith('SELECT COUNT(*) AS total FROM product_fiscal_settings')) return [[{ total: db.settings.filter(r => r.company_profile_id === p[0] && r.tax_profile_id === p[1]).length }]];
    if (s.startsWith('SELECT product_id, tax_profile_id FROM product_fiscal_settings')) return [db.settings.filter(r => r.company_profile_id === p[0]).map(clone)];
    if (s.startsWith('SELECT * FROM product_fiscal_settings WHERE company_profile_id=? AND product_id=?')) return [db.settings.filter(r => r.company_profile_id === p[0] && r.product_id === p[1]).map(clone)];
    if (s.startsWith('SELECT * FROM product_fiscal_settings WHERE company_profile_id=?')) return [db.settings.filter(r => r.company_profile_id === p[0]).map(clone)];
    if (s.startsWith('INSERT INTO product_fiscal_settings')) { db.settings.push({ company_profile_id: p[0], product_id: p[1], tax_profile_id: p[2], overrides_json: p[3], version: 1, updated_by: p[4] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('UPDATE product_fiscal_settings SET tax_profile_id=?,overrides_json=?')) { const r = db.settings.find(x => x.company_profile_id === p[3] && x.product_id === p[4]); Object.assign(r, { tax_profile_id: p[0], overrides_json: p[1], version: r.version + 1, updated_by: p[2] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('UPDATE product_fiscal_settings SET tax_profile_id=?,version')) { const r = db.settings.find(x => x.company_profile_id === p[2] && x.product_id === p[3]); Object.assign(r, { tax_profile_id: p[0], version: r.version + 1, updated_by: p[1] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('SELECT id,name,sku,ncm,cest,origin') && s.includes('WHERE id=?')) return [db.products.filter(r => r.id === p[0]).map(clone)];
    if (s.startsWith('SELECT id,name,sku,ncm,cest,origin')) return [db.products.filter(r => !r.is_parent).map(clone)];
    if (s.startsWith('SELECT id,ncm FROM products')) return [db.products.filter(r => !r.is_parent).map(clone)];
    if (s.startsWith('SELECT id FROM products WHERE id IN')) return [db.products.filter(r => p[0].includes(r.id)).map(r => ({ id: r.id }))];
    if (s.startsWith('SELECT id FROM products WHERE id=?')) return [db.products.filter(r => r.id === p[0]).map(r => ({ id: r.id }))];
    throw new Error(`SQL inesperado: ${s}`);
  }
  const conn = { query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} };
  return { db, pool: { query, getConnection: async () => conn } };
}

async function fixture() {
  const app = Fastify();
  const { db, pool } = fakeDb();
  const requireAuth = async (req, reply) => { if (!req.headers.authorization) return reply.code(401).send({ error: 'login' }); };
  const requireEdit = async (req, reply) => {
    if (req.headers.authorization !== 'Bearer contadora') return reply.code(403).send({ error: 'sem acesso' });
    if (req.params.id !== company) return reply.code(403).send({ error: 'outra empresa' });
    req.accountantProfile = { id: company }; req.accountantActor = 'contadora-1';
  };
  registerFiscalTaxProfileRoutes(app, { pool, requireEdit, requireAuth });
  await app.ready();
  const call = (method, url, payload, auth = 'Bearer contadora') => app.inject({ method, url, payload, headers: auth ? { authorization: auth } : {} });
  return { app, db, call };
}
const base = `/accountant/companies/${company}`;

test('catálogo exige login e recusa NCM de 6 dígitos', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  assert.equal((await f.call('GET', '/accountant/fiscal-catalog/ncm/851713', null, null)).statusCode, 401);
  const r = (await f.call('GET', '/accountant/fiscal-catalog/ncm/851713')).json();
  assert.equal(r.valid, false); assert.equal(r.issue, 'ncm_incomplete');
  const ok = (await f.call('GET', '/accountant/fiscal-catalog/ncm/85171300')).json();
  assert.equal(ok.valid, true); assert.equal(ok.cest[0].formatted, '21.053.00');
});

test('perfil: cria, valida, controla versão, nome único e auditoria', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  assert.equal((await f.call('POST', `${base}/tax-profiles`, celular, 'Bearer outro')).statusCode, 403);
  assert.equal((await f.call('POST', `/accountant/companies/${other}/tax-profiles`, celular)).statusCode, 403);
  assert.equal((await f.call('POST', `${base}/tax-profiles`, { ...celular, reviewerName: '' })).statusCode, 400);
  const created = await f.call('POST', `${base}/tax-profiles`, celular);
  assert.equal(created.statusCode, 201, created.body);
  const profile = created.json().profile;
  assert.equal(profile.nfce.cfop, '5405'); assert.equal(profile.completeness.complete, true);
  assert.equal((await f.call('POST', `${base}/tax-profiles`, celular)).statusCode, 409);
  assert.equal((await f.call('PUT', `${base}/tax-profiles/${profile.id}`, { ...celular, version: 99 })).statusCode, 409);
  const updated = await f.call('PUT', `${base}/tax-profiles/${profile.id}`, { ...celular, description: 'revisado', version: profile.version });
  assert.equal(updated.statusCode, 200, updated.body); assert.equal(updated.json().profile.version, 2);
  assert.deepEqual(f.db.events.map(e => e.event), ['tax_profile_create', 'tax_profile_update']);
  assert.ok(f.db.events.every(e => e.actor === 'contadora-1'));
});

test('produtos: lista com prontidão, sugestão e vínculo em lote pelo NCM', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const profile = (await f.call('POST', `${base}/tax-profiles`, celular)).json().profile;
  let list = (await f.call('GET', `${base}/fiscal-products`)).json();
  assert.equal(list.summary.total, 3, 'produto pai fica de fora');
  assert.equal(list.summary.missingProfile, 3); assert.equal(list.summary.ncmInvalid, 1);
  const brk = list.items.find(i => i.id === broken);
  assert.equal(brk.ncm.issue, 'ncm_incomplete'); assert.equal(brk.suggestedProfile, null);
  assert.equal(list.items.find(i => i.id === phone).suggestedProfile.id, profile.id);
  const assigned = (await f.call('POST', `${base}/fiscal-products/assign`, { mode: 'suggested' })).json();
  assert.equal(assigned.changed, 1);
  list = (await f.call('GET', `${base}/fiscal-products?filter=ready`)).json();
  assert.deepEqual(list.items.map(i => i.id), [phone]);
  assert.equal(list.items[0].readiness.nfce.cfop, '5405');
  const invalid = (await f.call('GET', `${base}/fiscal-products?filter=ncm_invalid`)).json();
  assert.deepEqual(invalid.items.map(i => i.id), [broken]);
});

test('produto: ajuste individual sobrescreve só o campo e respeita versão', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const profile = (await f.call('POST', `${base}/tax-profiles`, celular)).json().profile;
  const saved = await f.call('PUT', `${base}/fiscal-products/${phone}`, { taxProfileId: profile.id, overrides: { nfce: { cfop: '5403' } } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal((await f.call('PUT', `${base}/fiscal-products/${phone}`, { taxProfileId: profile.id, version: 7 })).statusCode, 409);
  const detail = (await f.call('GET', `${base}/fiscal-products/${phone}`)).json();
  assert.equal(detail.resolved.nfce.fields.cfop, '5403'); assert.deepEqual(detail.resolved.nfce.overriddenFields, ['cfop']);
  assert.equal(detail.resolved.nfeInterstate.fields.cfop, '6404');
  assert.ok(detail.cestOptions.some(o => o.formatted === '21.053.00'));
  assert.equal((await f.call('DELETE', `${base}/tax-profiles/${profile.id}`)).statusCode, 409, 'perfil em uso não pode ser excluído');
  assert.equal((await f.call('PUT', `${base}/fiscal-products/${phone}`, { taxProfileId: null, version: 1 })).statusCode, 200);
  assert.equal((await f.call('DELETE', `${base}/tax-profiles/${profile.id}`)).statusCode, 200);
});

test('vínculo explícito em lote valida produtos e perfil da empresa', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const profile = (await f.call('POST', `${base}/tax-profiles`, celular)).json().profile;
  assert.equal((await f.call('POST', `${base}/fiscal-products/assign`, { productIds: ['x'], taxProfileId: profile.id })).statusCode, 400);
  assert.equal((await f.call('POST', `${base}/fiscal-products/assign`, { productIds: [phone], taxProfileId: '99999999-9999-4999-8999-999999999999' })).statusCode, 404);
  const ok = (await f.call('POST', `${base}/fiscal-products/assign`, { productIds: [phone, cable], taxProfileId: profile.id })).json();
  assert.equal(ok.changed, 2);
});

test('portal do contador registra as rotas com a permissão de edição', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'accountantPortalServer.cjs'), 'utf8');
  assert.match(source, /registerFiscalTaxProfileRoutes\(app, \{ pool, requireEdit: requireCompanyAccess\('edit'\), requireAuth: auth \}\)/);
});
