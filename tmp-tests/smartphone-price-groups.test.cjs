'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Fastify = require('fastify');
const core = require('../services/smartphonePriceGroupsCore.cjs');
const { registerSmartphonePriceGroupRoutes, withSmartphonePriceWrite, insertProductRecordsWithGroupPrices, patchProductWithGroupPrices } = require('../services/smartphonePriceGroupsServer.cjs');

const sale = { price_retail: 113200, price_reseller: 108200, price_wholesale: 103200 };
const model = { id: 'redmi15c', company_id: 'store', name: 'Redmi 15c', category_name: 'Smartphones', template_values: { version: 'Global', rede_operadora: '4G' } };
const phone = (id, extra = {}) => ({ id, sku: id, name: model.name, model_id: model.id, company_id: null,
  specs: { ram: '8GB', storage: '256GB', color: id }, status: 'active', stock_quantity: 1, price_cost: 93200, ...sale, ...extra });

function fixture(t, options = {}) {
  let state = { model: structuredClone(model), products: options.products || [phone('R15C8256A', { price_cost: 98200 }), phone('R15C8256L'), phone('R15C8256V', { status: 'inactive', stock_quantity: 0 })], groups: [], history: [], writes: [] };
  let snapshot;
  const query = async (sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.startsWith('CREATE TABLE IF NOT EXISTS smartphone_price_groups')) {
      state.schemaEnsured = true;
      return [{}];
    }
    if (q.includes('FROM models m')) return [[structuredClone(state.model)].filter(m => m.id === params[0])];
    if (q.startsWith('SELECT * FROM smartphone_price_groups')) return [structuredClone(state.groups.filter(g => q.includes('WHERE model_id') ? g.model_id === params[0] : g.id === params[0]))];
    if (q.startsWith('SELECT') && q.includes('FROM products')) {
      return [structuredClone(state.products.filter(p => q.includes('WHERE model_id=?') ? p.model_id === params[0] : q.includes('WHERE sku=?') || q.includes('WHERE `sku`=?') ? p.sku === params[0] : p.id === params[0]))];
    }
    if (q.includes('FROM units u')) return [[{ product_id: 'R15C8256A', cost_price: 98000 }, { product_id: 'R15C8256A', cost_price: 99000 }]];
    if (q.startsWith('INSERT INTO smartphone_price_groups')) {
      const old = state.groups.find(g => g.id === params[0]);
      const saved = { id: params[0], model_id: params[1], company_id: params[2], configuration: params[3], price_retail: params[4], price_reseller: params[5], price_wholesale: params[6], revision: (old?.revision || 0) + 1 };
      state.groups = [...state.groups.filter(g => g.id !== saved.id), saved]; return [{}];
    }
    if (q.startsWith('UPDATE products SET')) {
      const keys = q.split(' SET ')[1].split(' WHERE ')[0].split(',').filter(s => !s.includes('CURRENT_TIMESTAMP')).map(s => s.split('=')[0].replaceAll('`', ''));
      const row = state.products.find(p => p.id === params.at(-1));
      if (row) keys.forEach((key, i) => { row[key] = params[i]; });
      return [{ affectedRows: row ? 1 : 0 }];
    }
    if (q.startsWith('INSERT INTO product_price_history')) {
      if (options.failHistory) throw new Error('history unavailable');
      state.history.push({ product_id: params[1], cost: params[2], retail: params[3] }); return [{}];
    }
    if (q.startsWith('INSERT INTO products')) {
      const keys = q.match(/^INSERT INTO products \(([^)]+)\)/)[1].split(',').map(k => k.replaceAll('`', ''));
      const row = Object.fromEntries(keys.map((k, i) => [k, params[i]]));
      if (row.sku === 'FAIL') throw new Error('simulated insert failure');
      state.products.push(row); return [{}];
    }
    throw new Error(`Unexpected SQL in fixture: ${q}`);
  };
  const connection = { query, beginTransaction: async () => { snapshot = structuredClone(state); }, commit: async () => {}, rollback: async () => { state = snapshot; }, release() {} };
  const pool = { query, getConnection: async () => connection };
  const app = Fastify(); t.after(() => app.close());
  registerSmartphonePriceGroupRoutes(app, { pool, requireSyncKey: async (req, reply) => { if (req.headers['x-sync-key'] !== 'test') return reply.code(401).send({ error: 'unauthorized' }); } });
  const request = (method, url, payload) => app.inject({ method, url, payload, headers: { 'x-sync-key': 'test' } });
  const list = async () => { const r = await request('GET', `/models/${model.id}/smartphone-price-groups`); assert.equal(r.statusCode, 200, r.body); return r.json(); };
  const save = (g, prices = sale) => request('PUT', `/models/${model.id}/smartphone-price-groups/${g.id}`, { product_id: g.products[0].id, revision: g.revision, prices });
  return { state: () => state, pool, app, request, list, save };
}

test('colors, numeric memory and physical RAM identify the same configuration', () => {
  const base = core.configuration(phone('A'), model);
  assert.equal(base.id, core.configuration(phone('V', { specs: { ram: '8 + 8GB', storage: '256 gb', color: 'Verde' } }), model).id);
  assert.equal(base.id, core.configuration(phone('L', { specs: { memory_ram: 8, armazenamento: '256GiB' } }), model).id);
  assert.equal(core.configuration(phone('1', { specs: { ram: '8GB', storage: '1TB' } }), model).id,
    core.configuration(phone('2', { specs: { ram: '8GB', storage: '1024GB' } }), model).id);
  assert.equal(core.configuration(phone('A'), { ...model, template_values: { ram_fisica: '12GB' } }).ram, '8GB');
});

test('memory, commercial version, network, company and condition never merge', () => {
  const base = core.configuration(phone('A'), model).id;
  for (const specs of [{ ram: '6GB' }, { storage: '128GB' }, { version: 'India' }, { network: '5G' }, { condition: 'used' }]) {
    assert.notEqual(base, core.configuration(phone('B', { specs: { ram: '8GB', storage: '256GB', ...specs } }), model).id);
  }
  assert.notEqual(base, core.configuration(phone('B', { company_id: 'another' }), model).id);
  assert.equal(core.configuration(phone('A', { is_parent: 1 }), model), null);
  assert.equal(core.configuration(phone('A', { specs: { ram: 'unknown', storage: '256GB' } }), model), null);
  assert.equal(core.isSmartphoneCategory('Acessórios para celulares'), false);
});

test('listing is read-only, includes empty stock and shows actual unit costs without identifiers', async t => {
  const f = fixture(t);
  const result = await f.list();
  assert.equal(f.state().schemaEnsured, true);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].products.length, 3);
  assert.equal(result.groups[0].cost_max, 99000);
  assert.equal(result.groups[0].confirmed, false);
  assert.deepEqual(result.groups[0].prices, sale);
  assert.equal(f.state().groups.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /imei|serial|photo_private/);
  assert.equal((await f.app.inject({ url: `/models/${model.id}/smartphone-price-groups` })).statusCode, 401);
});

test('divergence requires a choice; save updates every color, preserves cost and writes history', async t => {
  const f = fixture(t, { products: [phone('A'), phone('B', { price_retail: 120000, price_cost: 100000, stock_quantity: 0 })] });
  const [g] = (await f.list()).groups;
  assert.equal(g.divergent, true); assert.equal(g.prices, null);
  const res = await f.save(g, { ...sale, price_retail: 115000 });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(f.state().products.map(p => p.price_retail), [115000, 115000]);
  assert.deepEqual(f.state().products.map(p => p.price_cost), [93200, 100000]);
  assert.deepEqual(f.state().history.map(h => h.cost), [93200, 100000]);
  assert.equal((await f.save(g)).statusCode, 409, 'stale revision must not overwrite another edit');
});

test('saving a group rolls back all prices and its definition if history fails', async t => {
  const f = fixture(t, { failHistory: true });
  const [g] = (await f.list()).groups;
  const before = structuredClone(f.state());
  assert.equal((await f.save(g, { ...sale, price_retail: 116000 })).statusCode, 500);
  assert.deepEqual(f.state(), before);
});

test('new entry inherits group price despite higher cost and suggested selling price', async t => {
  const f = fixture(t);
  const [g] = (await f.list()).groups;
  assert.equal((await f.save(g)).statusCode, 200);
  let actual;
  await withSmartphonePriceWrite(f.pool, phone('new', { price_cost: 110000, price_retail: 130000 }), async (_db, p) => { actual = p; });
  assert.equal(actual.price_cost, 110000); assert.equal(actual.price_retail, sale.price_retail);
  assert.equal(actual.price_reseller, sale.price_reseller);
});

test('first entry price definition and product insert share a transaction', async t => {
  const f = fixture(t, { products: [] });
  await assert.rejects(withSmartphonePriceWrite(f.pool, phone('new'), async () => { throw new Error('insert failed'); }), /insert failed/);
  assert.equal(f.state().groups.length, 0);
  await insertProductRecordsWithGroupPrices(f.pool, [phone('first')]);
  assert.equal(f.state().groups.length, 1);
  assert.equal(f.state().products.length, 1);
});

test('divergent legacy stock remains editable without selecting a new price; new colors await review', async t => {
  const f = fixture(t, { products: [phone('A'), phone('B', { price_retail: 125000 })] });
  await patchProductWithGroupPrices(f.pool, 'A', { price_cost: 99000, price_retail: 150000, stock_quantity: 2 });
  assert.equal(f.state().products[0].price_cost, 99000);
  assert.equal(f.state().products[0].stock_quantity, 2);
  assert.equal(f.state().products[0].price_retail, sale.price_retail);
  assert.equal(f.state().groups.length, 0);
  await assert.rejects(withSmartphonePriceWrite(f.pool, phone('C'), async () => {}), /divergentes/);
});

test('atomic bulk insert rolls back all products and price definitions on a later failure', async t => {
  const f = fixture(t, { products: [] });
  await assert.rejects(insertProductRecordsWithGroupPrices(f.pool, [phone('first'), phone('FAIL')]), /simulated insert failure/);
  assert.equal(f.state().products.length, 0); assert.equal(f.state().groups.length, 0);
});

test('invalid monetary values and mismatched product group are rejected', async t => {
  const f = fixture(t);
  const [g] = (await f.list()).groups;
  for (const price_retail of [-1, 12.34, null, '', ' ', true, 3e12]) assert.equal((await f.save(g, { ...sale, price_retail })).statusCode, 400);
  assert.equal((await f.save({ ...g, id: 'wrong' })).statusCode, 409);
  assert.equal(f.state().groups.length, 0);
});

test('group update does not touch another memory, network or company', async t => {
  const f = fixture(t, { products: [phone('A'), phone('B'), phone('128', { specs: { ram: '8GB', storage: '128GB' } }),
    phone('5G', { specs: { ram: '8GB', storage: '256GB', network: '5G' } }), phone('other-store', { company_id: 'another' })] });
  const g = (await f.list()).groups.find(g => g.products.some(p => p.id === 'A'));
  assert.equal((await f.save(g, { ...sale, price_retail: 115000 })).statusCode, 200);
  assert.deepEqual(f.state().products.map(p => p.price_retail), [115000, 115000, 113200, 113200, 113200]);
});
