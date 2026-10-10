const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const fs = require('node:fs');
const { registerPrint3dMaterialRoutes, normalizeMaterialName, materialCatalog } = require('../services/print3dMaterialsServer.cjs');
const { registerPrint3dProductionRoutes } = require('../services/print3dProductionServer.cjs');

async function fixture(saved = null) {
  const app = Fastify();
  const state = { saved, writes: 0, rollbacks: 0, released: 0, fail: false };
  let queue = Promise.resolve();
  const query = async (sql, params) => {
    if (state.fail) throw new Error('database unavailable');
    if (sql.startsWith('SELECT')) return [[{ value_json: state.saved }]];
    if (sql.startsWith('INSERT IGNORE')) { state.saved ??= params[1]; return [{}]; }
    if (sql.startsWith('UPDATE')) { state.saved = params[0]; state.writes++; return [{}]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  registerPrint3dMaterialRoutes(app, { pool: { query, async getConnection() {
    let unlock;
    return { query, async beginTransaction() {
      const previous = queue;
      queue = new Promise(resolve => { unlock = resolve; });
      await previous;
    }, async commit() {}, async rollback() { state.rollbacks++; },
    release() { state.released++; unlock?.(); } };
  } }, requireAdminBearerToken: async (req, reply) => {
    if (req.headers.authorization !== 'Bearer admin') return reply.code(401).send({ error: 'admin required' });
  } });
  registerPrint3dProductionRoutes(app, { pool: {}, enabled: false, getCustomer: async () => null,
    getBearerAuthContext: async req => req.headers.authorization === 'Bearer admin' ? { isAdmin: true, userId: 'admin' } : null });
  await app.ready();
  return { app, state, call: (method, payload, auth = true) => app.inject({ method, url: '/admin/print3d/material-types', payload, headers: auth ? { authorization: 'Bearer admin' } : {} }) };
}

test('material types coexist with production stock routes and frontend uses the types endpoint', async t => {
  const { app, call } = await fixture(); t.after(() => app.close());
  assert.equal((await app.inject({ url: '/admin/print3d/materials', headers: { authorization: 'Bearer admin' } })).statusCode, 503);
  assert.equal((await call('GET')).statusCode, 200);
  assert.ok((await call('GET')).json().materials.every(value => typeof value === 'string'));
  const client = fs.readFileSync(require.resolve('../services/print3dMaterials.ts'), 'utf8');
  assert.equal((client.match(/\/admin\/print3d\/material-types/g) || []).length, 2);
  assert.ok(!client.includes("'/admin/print3d/materials'"));
});

test('known materials and saved names are returned without GET writes', async t => {
  const { app, state, call } = await fixture(JSON.stringify(['PETG', 'Material teste'])); t.after(() => app.close());
  const response = await call('GET');
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(response.json().materials.includes('PLA'));
  assert.ok(response.json().materials.includes('Resina'));
  assert.ok(response.json().materials.includes('Material teste'));
  assert.equal(response.json().materials.filter(x => x === 'PETG').length, 1);
  assert.equal(state.writes, 0);
});

test('normalization handles whitespace, case and nylon aliases without merging different materials', () => {
  assert.equal(normalizeMaterialName(' pla + '), 'PLA+');
  assert.equal(normalizeMaterialName(' nylon '), 'PA (Nylon)');
  assert.equal(normalizeMaterialName('  Custom   Material '), 'Custom Material');
  assert.equal(materialCatalog(['TESTE', 'teste']).filter(x => x.toLowerCase() === 'teste').length, 1);
  assert.ok(materialCatalog([]).includes('PLA'));
  assert.ok(materialCatalog([]).includes('PLA+'));
});

test('creation persists and duplicate names select existing canonical material', async t => {
  const { app, state, call } = await fixture(); t.after(() => app.close());
  assert.equal((await call('POST', { name: ' pla ' })).json().created, false);
  const created = await call('POST', { name: '  Material   Especial ' });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().name, 'Material Especial');
  const duplicate = await call('POST', { name: 'material especial' });
  assert.equal(duplicate.json().created, false);
  assert.equal(duplicate.json().name, 'Material Especial');
  assert.ok((await call('GET')).json().materials.includes('Material Especial'));
  assert.equal(state.writes, 1);
  assert.equal(state.released, 3);
});

test('concurrent additions preserve both names', async t => {
  const { app, call } = await fixture(); t.after(() => app.close());
  const responses = await Promise.all([call('POST', { name: 'Material A' }), call('POST', { name: 'Material B' })]);
  assert.deepEqual(responses.map(x => x.statusCode), [201, 201]);
  const names = (await call('GET')).json().materials;
  assert.ok(names.includes('Material A')); assert.ok(names.includes('Material B'));
});

test('auth and invalid input block writes; database failure is not false success', async t => {
  const { app, state, call } = await fixture(); t.after(() => app.close());
  assert.equal((await call('GET', undefined, false)).statusCode, 401);
  assert.equal((await call('POST', { name: 'PLA' }, false)).statusCode, 401);
  for (const name of ['', ' ', 'x'.repeat(81), '<script>', 123]) assert.equal((await call('POST', { name })).statusCode, 400);
  assert.equal(state.writes, 0);
  state.fail = true;
  assert.equal((await call('POST', { name: 'Material' })).statusCode, 500);
  assert.equal(state.rollbacks, 1);
  assert.equal(state.released, 1);
});

test('both generic and custom 3D material fields use selector and deploy includes backend module', () => {
  const ui = fs.readFileSync(require.resolve('../components/products/sections/ProductSpecifications.tsx'), 'utf8');
  assert.match(ui, /isPrint3d && normalizeSpecFieldKey\(key\).*material/);
  assert.match(ui, /isPrint3d && normalizeSpecFieldKey\(customField.key\).*material/);
  assert.match(fs.readFileSync(require.resolve('../deploy-vps-server-only.cjs'), 'utf8'), /services\/print3dMaterialsServer.cjs/);
  assert.match(fs.readFileSync(require.resolve('../vps_server.cjs'), 'utf8'), /registerPrint3dMaterialRoutes/);
  assert.match(fs.readFileSync(require.resolve('../vps_server.js'), 'utf8'), /registerPrint3dMaterialRoutes/);
});

test('catalog size limit rejects new entries but still permits selecting existing materials', async t => {
  const saved = materialCatalog([]);
  while (saved.length < 500) saved.push(`Material ${saved.length}`);
  const { app, state, call } = await fixture(JSON.stringify(saved)); t.after(() => app.close());
  assert.equal((await call('POST', { name: 'Mais um material' })).statusCode, 400);
  assert.equal((await call('POST', { name: 'PETG' })).statusCode, 200);
  assert.equal(state.writes, 0);
});

test('invalid stored data is reported instead of overwriting the catalog', async t => {
  const { app, state, call } = await fixture('{bad-json'); t.after(() => app.close());
  assert.equal((await call('GET')).statusCode, 500);
  assert.equal((await call('POST', { name: 'Material novo' })).statusCode, 500);
  assert.equal(state.saved, '{bad-json');
  assert.equal(state.writes, 0);
  assert.equal(state.rollbacks, 1);
});
