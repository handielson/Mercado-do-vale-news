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
      if (table === 'unit_journal_events' && /imei_1_before/.test(sql)) {   // busca por IMEI/serial antigo
        const wanted = params.map(String);
        const hit = j => [j.before_data?.unit, j.after_data?.unit].some(u => u && ['imei_1', 'imei_2', 'serial'].some(k => u[k] != null && wanted.includes(String(u[k]))));
        return [[...new Set(fixture.journal.filter(hit).map(j => j.unit_id))].map(unit_id => ({ unit_id }))];
      }
      if (table === 'unit_journal_events' && /unit_id = \?/.test(sql)) {
        return [fixture.journal.filter(j => String(j.unit_id) === String(params[0]))];
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

test('venda apagada: cliente e vendedor vêm dos ids guardados no diário', async t => {
  const app = Fastify();
  const base = fakePool([fixture.unit]);
  const pool = { queries: [], async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (/\bFROM\s+`?sales`?/i.test(sql)) return [[]];                     // venda apagada
    if (/FROM customers WHERE id IN/i.test(sql)) {
      const ids = params.flat().map(String);
      return [fixture.customers.filter(c => ids.includes(String(c.id)))];
    }
    return base.query(sql, params);
  } };
  registerUnitTimelineRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }) });
  t.after(() => app.close());
  const body = (await app.inject({ url: `/admin/units/${UNIT}/timeline` })).json();
  const sold = body.events.find(e => e.type === 'sold');
  assert.match(sold.detail, /Cliente Teste/);
  assert.match(sold.actor, /Vendedor Teste/);
});

test('IMEI antigo ou aparelho apagado: acha pelo diário', async t => {
  const app = Fastify();
  const OLD_IMEI = '999999999999999';
  const base = fakePool([]);                                            // unidade não existe mais em units
  const pool = { queries: [], async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (/FROM unit_journal_events/i.test(sql) && /imei_1_before/i.test(sql)) {
      return [params.map(String).includes(OLD_IMEI) ? [{ unit_id: UNIT }] : []];
    }
    return base.query(sql, params);
  } };
  registerUnitTimelineRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }) });
  t.after(() => app.close());
  const r = await app.inject({ url: `/admin/units/timeline?identifier=${OLD_IMEI}` });
  assert.equal(r.statusCode, 200);
  const body = r.json();
  assert.equal(body.unit.id, UNIT);
  assert.equal(body.unit.deleted, true);
  assert.equal(body.current.status, 'available');                        // último snapshot do diário
  assert.ok(body.events.some(e => e.type === 'sold'));
  const byId = await app.inject({ url: `/admin/units/${UNIT}/timeline` });
  assert.equal(byId.statusCode, 200);
  assert.equal(byId.json().unit.deleted, true);
});

test('unit_events ausente (tabela não criada) não quebra a rota', async t => {
  const app = Fastify();
  const base = fakePool([fixture.unit]);
  const pool = { async query(sql, params) {
    if (/FROM unit_events/i.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    return base.query(sql, params);
  } };
  registerUnitTimelineRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }) });
  t.after(() => app.close());
  const r = await app.inject({ url: `/admin/units/${UNIT}/timeline` });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().events.length, 4);
});

test('eventos de local entram na resposta da rota', async t => {
  const app = Fastify();
  const base = fakePool([fixture.unit]);
  const pool = { async query(sql, params) {
    if (/FROM unit_events/i.test(sql)) return [[{ id: 'e1', unit_id: UNIT, event_type: 'location_set', occurred_at: '2026-11-18 15:00:00', to_deposit_id: fixture.deposits[0].id, to_location_id: fixture.locations[0].id, reason: 'inicial' }]];
    return base.query(sql, params);
  } };
  registerUnitTimelineRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }) });
  t.after(() => app.close());
  const ev = (await app.inject({ url: `/admin/units/${UNIT}/timeline` })).json().events[0];
  assert.equal(ev.type, 'location_set');
  assert.match(ev.detail, /Loja Principal \/ Estoque Geral · inicial/);
});

test('diário lido só com os tipos que viram linha do tempo, do mais novo para o mais antigo', async t => {
  const pool = fakePool([fixture.unit]);
  const app = Fastify();
  registerUnitTimelineRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }) });
  t.after(() => app.close());
  await app.inject({ url: `/admin/units/${UNIT}/timeline` });
  const q = pool.queries.find(x => /FROM unit_journal_events WHERE unit_id = \?/.test(x.sql) && /event_type IN/.test(x.sql));
  assert.ok(q, 'consulta filtra event_type');
  assert.match(q.sql, /ORDER BY id DESC LIMIT 2000/);
});

test('quem fez a entrada por foto vem do cadastro ligado ao login', async t => {
  const base = fakePool([{ ...fixture.unit }]);
  const pool = { queries: [], async query(sql, params) {
    if (/FROM smartphone_photo_intakes/.test(sql)) return [[{ ...fixture.intakes[0], created_by: fixture.sales[0].seller_id }]];
    return base.query(sql, params);
  } };
  const app = Fastify();
  registerUnitTimelineRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }) });
  t.after(() => app.close());
  const body = (await app.inject({ url: `/admin/units/${UNIT}/timeline` })).json();
  assert.equal(body.events.find(e => e.type === 'entry').actor, 'Vendedor Teste');
});
