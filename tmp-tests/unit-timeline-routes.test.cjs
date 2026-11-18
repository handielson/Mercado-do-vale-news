// Rotas admin da linha do tempo do aparelho.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Fastify = require('fastify');
const fixture = require('./fixtures/unit-timeline-868499080873669.json');
const { registerUnitTimelineRoutes } = require('../services/unitTimelineServer.cjs');

const UNIT = fixture.unit.id;
const MISSING = '00000000-0000-4000-8000-000000000000';
const OTHER = { ...fixture.unit, id: '11111111-1111-4111-8111-111111111111', imei_1: 'DUP', imei_2: null, serial: 'S-OTHER' };
const DUP_UNIT = { ...fixture.unit, serial: 'DUP' };

// Pool falso: responde pela tabela do FROM; units filtra pelo que a rota pediu.
function fakePool(units) {
  const tables = {
    products: [fixture.product], unit_journal_events: fixture.journal, sales: fixture.sales,
    sale_items: fixture.saleItems, customers: [...fixture.customers, { id: 'seller-customer', name: 'Vendedor Teste', auth_user_id: fixture.sales[0].seller_id }],
    smartphone_photo_intakes: fixture.intakes, warranty_documents: [], signed_warranty_documents: [],
    stock_deposits: fixture.deposits, stock_locations: fixture.locations,
  };
  return {
    queries: [],
    async query(sql, params = []) {
      this.queries.push({ sql, params });
      const table = (sql.match(/\bFROM\s+`?(\w+)`?/i) || [])[1];
      if (table === 'units') {
        const wanted = params.map(String);
        return [units.filter(u => ['id', 'imei', 'imei_1', 'imei_2', 'serial'].some(k => u[k] != null && wanted.includes(String(u[k]))))];
      }
      return [tables[table] || []];
    },
  };
}
function setup(t, { admin = true, units = [fixture.unit, OTHER] } = {}) {
  const app = Fastify();
  registerUnitTimelineRoutes(app, { pool: fakePool(units), getBearerAuthContext: async () => (admin ? { isAdmin: true, userId: 'op' } : { isAdmin: false }) });
  t.after(() => app.close());
  return app;
}

test('sem sessão admin → 401 nas duas rotas', async t => {
  const app = setup(t, { admin: false });
  assert.equal((await app.inject({ url: `/admin/units/${UNIT}/timeline` })).statusCode, 401);
  assert.equal((await app.inject({ url: '/admin/units/timeline?identifier=868499080873669' })).statusCode, 401);
});

test('unitId inválido → 400; identifier vazio ou >100 → 400', async t => {
  const app = setup(t);
  for (const url of ['/admin/units/x/timeline', '/admin/units/timeline?identifier=', `/admin/units/timeline?identifier=${'9'.repeat(101)}`]) {
    assert.equal((await app.inject({ url })).statusCode, 400, url);
  }
});

test('por id, IMEI 1, IMEI 2 e serial acha a mesma unidade', async t => {
  const app = setup(t);
  for (const url of [`/admin/units/${UNIT}/timeline`, ...['868499080873669', '868499080873677', '81346W6V100217'].map(i => `/admin/units/timeline?identifier=${i}`)]) {
    const r = await app.inject({ url });
    assert.equal(r.statusCode, 200, url);
    const body = r.json();
    assert.equal(body.unit.id, UNIT);
    assert.equal(body.current.status, 'available');
    assert.deepEqual(body.events.map(e => e.type), ['returned_to_stock', 'sale_cancelled', 'sold', 'entry']);
    assert.match(body.events.find(e => e.type === 'sold').actor, /Vendedor Teste/);
    assert.equal(body.product.sku, 'POCO0001-03');
    assert.equal('before_data' in body.unit, false);
  }
});

test('identifier em duas unidades → matches', async t => {
  const app = setup(t, { units: [DUP_UNIT, OTHER] });
  const body = (await app.inject({ url: '/admin/units/timeline?identifier=DUP' })).json();
  assert.equal(body.matches.length, 2);
  assert.deepEqual(Object.keys(body.matches[0]).sort(), ['id', 'imei1', 'imei2', 'productName', 'serial', 'status']);
});

test('unidade inexistente → 404', async t => {
  const app = setup(t);
  for (const url of [`/admin/units/${MISSING}/timeline`, '/admin/units/timeline?identifier=000']) {
    const r = await app.inject({ url });
    assert.equal(r.statusCode, 404, url);
    assert.equal(r.json().error, 'Aparelho não encontrado.');
  }
});

test('Cache-Control no-store', async t => {
  const app = setup(t);
  assert.equal((await app.inject({ url: `/admin/units/${UNIT}/timeline` })).headers['cache-control'], 'no-store');
});

test('vps_server.js e .cjs registram registerUnitTimelineRoutes', () => {
  for (const f of ['vps_server.js', 'vps_server.cjs']) {
    assert.match(fs.readFileSync(f, 'utf8'), /unitTimelineServer\.cjs'\)\.registerUnitTimelineRoutes\(fastify, \{ pool, getBearerAuthContext: getVpsBearerAuthContext \}\)/, f);
  }
});
