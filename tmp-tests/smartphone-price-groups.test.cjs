'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Fastify = require('fastify');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../services/smartphonePriceGroupsCore.cjs');
const { photoIntakePriceSpecs } = require('../services/smartphonePhotoIntakeCore.cjs');
const { registerSmartphonePriceGroupRoutes, withSmartphonePriceWrite, insertProductRecordsWithGroupPrices, patchProductWithGroupPrices } = require('../services/smartphonePriceGroupsServer.cjs');

const sale = { price_retail: 113200, price_reseller: 108200, price_wholesale: 103200 };
const model = { id: 'redmi15c', company_id: 'store', name: 'Redmi 15c', category_name: 'Smartphones', template_values: { version: 'Global', rede_operadora: '4G' } };
const phone = (id, extra = {}) => ({ id, sku: id, name: model.name, model_id: model.id, company_id: null,
  specs: { ram: '8GB', storage: '256GB', color: id }, status: 'active', stock_quantity: 1, price_cost: 93200, ...sale, ...extra });

test('existing unit update route changes only the selected purchase cost and preserves sale prices', async t => {
  for (const entry of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
    const source = fs.readFileSync(entry, 'utf8');
    const start = source.indexOf("fastify.put('/units/:id'");
    const end = source.indexOf("fastify.delete('/units/:id'", start);
    assert.ok(start > 0 && end > start);
    const app = Fastify(); t.after(() => app.close());
    const units = [{ id: 'one', product_id: 'phone', cost_price: 99000, imei_1: 'fixture-one', status: 'available' },
      { id: 'two', product_id: 'phone', cost_price: 123000, imei_1: 'fixture-two', status: 'available' }];
    const product = { ...sale, price_cost: 99000 };
    const queries = [];
    vm.runInNewContext(source.slice(start, end), { fastify: app, requireSyncKey: async () => {},
      collectUnitSerializedIdentifiers: () => [], findUnitSerializedIdentifierConflict: async () => null,
      syncProductStock: async id => assert.equal(id, 'phone'),
      pool: { query: async (sql, params) => {
        queries.push(sql);
        if (sql.startsWith('UPDATE units SET')) {
          assert.equal(sql, 'UPDATE units SET cost_price = ? WHERE id = ?');
          units.find(u => u.id === params[1]).cost_price = params[0];
          return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('SELECT * FROM units')) return [[units.find(u => u.id === params[0])]];
        throw new Error('Unexpected write: ' + sql);
      } },
    });
    const response = await app.inject({ method: 'PUT', url: '/units/one', payload: { cost_price: 111000 } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(units[0].cost_price, 111000);
    assert.equal(units[1].cost_price, 123000);
    assert.equal(units[0].imei_1, 'fixture-one');
    assert.equal(units[0].status, 'available');
    assert.deepEqual(product, { ...sale, price_cost: 99000 });
    assert.equal(queries.length, 2);
  }
});

function fixture(t, options = {}) {
  let state = { model: structuredClone(options.model || model), products: options.products || [phone('R15C8256A', { price_cost: 98200 }), phone('R15C8256L'), phone('R15C8256V', { status: 'inactive', stock_quantity: 0 })], groups: [], history: [], writes: [] };
  let snapshot;
  const query = async (sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.startsWith('CREATE TABLE IF NOT EXISTS smartphone_price_groups')) {
      state.schemaEnsured = true;
      return [{}];
    }
    if (q.includes('FROM models m')) return [[structuredClone(state.model)].filter(m => m.id === params[0])];
    if (q.startsWith('SELECT name FROM versions')) return [[...(params[0] === 'india-version' ? [{name:'India'}] : [])]];
    if (q.startsWith('SELECT * FROM smartphone_price_groups')) return [structuredClone(state.groups.filter(g => q.includes('WHERE model_id') ? g.model_id === params[0] : g.id === params[0]))];
    if (q.startsWith('SELECT') && q.includes('FROM products')) {
      return [structuredClone(state.products.filter(p => q.includes('WHERE model_id=?') ? p.model_id === params[0] : q.includes('WHERE sku=?') || q.includes('WHERE `sku`=?') ? p.sku === params[0] : p.id === params[0]))];
    }
    if (q.includes('FROM units u')) {
      const rows = (options.units || [{ product_id: 'R15C8256A', cost_price: 98000 }, { product_id: 'R15C8256A', cost_price: 99000 }]).map(u => ({ status: 'available', ...u }));
      return [q.includes("u.status='available'") ? rows.filter(u => u.status === 'available') : rows];
    }
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
  registerSmartphonePriceGroupRoutes(app, { pool, inventoryCosts: async () => ({}), requireSyncKey: async (req, reply) => { if (req.headers['x-sync-key'] !== 'test') return reply.code(401).send({ error: 'unauthorized' }); } });
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

test('conferencia por foto consulta o preco Global confirmado e nao o grupo legado sem versao', async t => {
  const f = fixture(t, { model: { ...model, template_values: { rede_operadora: '5G' } }, products: [
    phone('global', { specs: { ram: '12GB', storage: '512GB', version: 'Global' } }),
    phone('legacy', { specs: { ram: '12GB', storage: '512GB' } }),
  ] });
  const global = (await f.list()).groups.find(g => g.version === 'global');
  assert.equal((await f.save(global, { price_retail: 286000, price_reseller: 282000, price_wholesale: 276000 })).statusCode, 200);
  const intake = { detected_ram: '12GB', detected_storage: '512GB', extracted_data: JSON.stringify({ commercial_version: 'Global' }) };
  const response = await f.request('POST', `/models/${model.id}/smartphone-price-reference`, { specs: photoIntakePriceSpecs(intake) });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().group_id, global.id);
  assert.equal(response.json().prices.price_retail, 286000);
  assert.equal(f.state().products.find(p => p.id === 'legacy').price_retail, sale.price_retail);
});

test('3D products never inherit or change phone group prices even with inherited phone specs', async t => {
  const piece = phone('PIECE', {is_print3d:1,price_retail:2500});
  const f = fixture(t, {products:[phone('PHONE'),piece]});
  assert.equal(core.configuration(piece,model),null);
  const listing=await f.list();assert.equal(listing.groups.length,1);
  assert.deepEqual(listing.groups[0].products.map(p=>p.id),['PHONE']);assert.deepEqual(listing.unresolved,[]);
  const reference=await f.request('POST',`/models/${model.id}/smartphone-price-reference`,piece);
  assert.equal(reference.json().controlled,false);
  const saved=await f.save(listing.groups[0],{...sale,price_retail:120000});assert.equal(saved.statusCode,200,saved.body);
  assert.equal(f.state().products.find(p=>p.id==='PIECE').price_retail,2500);
  let written;
  await withSmartphonePriceWrite(f.pool,{id:'PIECE',price_retail:2900},async(_db,p)=>{written=p;});
  assert.equal(written.price_retail,2900);
  await withSmartphonePriceWrite(f.pool,{...piece,id:'NEW-3D',specs:{material:'PLA'},price_retail:3500},async(_db,p)=>{written=p;});
  assert.equal(written.price_retail,3500,'no RAM/storage required for a manufactured part');
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

test('available stock average excludes sold/reserved/hidden units and inactive products; last purchase is historical', async t => {
  const f = fixture(t, { products: [phone('active', { stock_quantity: 2 }), phone('disabled', { status: 'inactive', stock_quantity: 1 })], units: [
    { id: 'available-1', product_id: 'active', status: 'available', cost_price: 100000, created_at: '2026-10-01T12:00:00Z' },
    { id: 'available-2', product_id: 'active', status: 'available', cost_price: 120000, created_at: '2026-10-02T12:00:00Z' },
    { id: 'sold', product_id: 'active', status: 'sold', cost_price: 130000, created_at: '2026-10-05T12:00:00Z' },
    { id: 'reserved', product_id: 'active', status: 'reserved', cost_price: 990000, created_at: '2026-09-01T12:00:00Z' },
    { id: 'hidden', product_id: 'active', status: 'hidden', cost_price: 880000, created_at: '2026-09-01T12:00:00Z' },
    { id: 'inactive', product_id: 'disabled', status: 'available', cost_price: 770000, created_at: '2026-09-01T12:00:00Z' },
    { id: 'unknown-cost', product_id: 'active', status: 'sold', cost_price: null, created_at: '2026-10-06T12:00:00Z' },
  ] });
  const group = (await f.list()).groups[0];
  assert.equal(group.cost_average_in_stock, 110000);
  assert.equal(group.cost_min, 100000);
  assert.equal(group.cost_max, 120000);
  assert.equal(group.last_purchase_cost, 130000);
  assert.equal(group.last_purchase_at, '2026-10-05T12:00:00.000Z');
});

test('stock average uses individual costs and weights legacy products by stock, without writing prices', async t => {
  const f = fixture(t, { products: [
    phone('units', { stock_quantity: 2, price_cost: 500000 }),
    phone('legacy', { stock_quantity: 3, price_cost: 100000 }),
    phone('empty', { stock_quantity: 0, price_cost: 900000 }),
    phone('unknown', { stock_quantity: 5, price_cost: null }),
  ], units: [{ product_id: 'units', cost_price: 99000 }, { product_id: 'units', cost_price: 123000 }] });
  const before = structuredClone(f.state());
  const [group] = (await f.list()).groups;
  assert.equal(group.cost_average_in_stock, 104400);
  assert.deepEqual(f.state().products, before.products);
  assert.deepEqual(f.state().history, []);
  assert.deepEqual(f.state().groups, []);
});

test('stock cost range excludes sold-out colors and uses the same available costs as the average', async t => {
  const f = fixture(t, { products: [
    phone('sold-out', { stock_quantity: 0, price_cost: 77200 }),
    phone('green', { price_cost: 99000 }),
    phone('blue', { stock_quantity: 2, price_cost: 99900 }),
  ], units: [
    { product_id: 'sold-out', status: 'sold', cost_price: 77200 },
    { product_id: 'green', status: 'sold', cost_price: 99000 },
    { product_id: 'green', status: 'reserved', cost_price: 10000 },
    { product_id: 'green', status: 'hidden', cost_price: 500000 },
    { product_id: 'green', status: 'available', cost_price: 92500 },
    { product_id: 'blue', status: 'available', cost_price: 99900 },
    { product_id: 'blue', status: 'available', cost_price: 117000 },
  ] });
  const before = structuredClone(f.state().products);
  const [group] = (await f.list()).groups;
  assert.equal(group.cost_average_in_stock, 103133);
  assert.equal(group.cost_min, 92500);
  assert.equal(group.cost_max, 117000);
  assert.equal(group.products.find(p => p.id === 'sold-out').available_unit_count, 0);
  assert.deepEqual(f.state().products, before);
  assert.deepEqual(f.state().history, []);
});

test('serialized products never fall back to a historic product cost when available costs are missing', async t => {
  const f = fixture(t, { products: [phone('sold', { stock_quantity: 1 }), phone('unknown')], units: [
    { product_id: 'sold', status: 'sold', cost_price: 77200 },
    { product_id: 'unknown', status: 'available', cost_price: null },
  ] });
  const [group] = (await f.list()).groups;
  assert.equal(group.cost_average_in_stock, null);
  assert.equal(group.cost_min, null);
  assert.equal(group.cost_max, null);
  assert.deepEqual(f.state().history, []);
});

test('API write fills Global when smartphone payload has no version, without depending on browser defaults', async t => {
  const f = fixture(t, { products: [], model: {...model,template_values:{}} });
  let written;
  await withSmartphonePriceWrite(f.pool, phone('new'), async (_db, p) => { written = p; });
  assert.equal(written.specs.version, 'Global');
});

test('API write preserves existing India on blank input and resolves a legacy version id', async t => {
  const f = fixture(t, { products: [phone('india',{specs:{ram:'8GB',storage:'256GB',version:'India'}})], model:{...model,template_values:{}} });
  let written;
  await withSmartphonePriceWrite(f.pool, {id:'india',specs:{ram:'8GB',storage:'256GB',version:''}}, async (_db,p)=>{written=p;});
  assert.equal(written.specs.version,'India');
  await withSmartphonePriceWrite(f.pool, phone('legacy',{specs:{ram:'8GB',storage:'256GB',versao:'india-version'}}), async (_db,p)=>{written=p;});
  assert.equal(written.specs.version,'India');
});

test('stock average shows the screenshot example and rounds to cents', async t => {
  const f = fixture(t, { products: [phone('units', { stock_quantity: 2 })], units: [
    { product_id: 'units', cost_price: 99000 }, { product_id: 'units', cost_price: 123000 },
  ] });
  assert.equal((await f.list()).groups[0].cost_average_in_stock, 111000);
  f.state().products[0].price_cost = 101;
  f.state().products.push(phone('legacy', { price_cost: 100, stock_quantity: 2 }));
  f.state().products[0].id = 'no-units';
  f.state().products[0].stock_quantity = 1;
  assert.equal((await f.list()).groups[0].cost_average_in_stock, 100);
});

test('stock average is unavailable without stock or known costs; zero cost is valid', async t => {
  const f = fixture(t, { products: [phone('empty', { stock_quantity: 0 }), phone('unknown', { price_cost: null })], units: [] });
  assert.equal((await f.list()).groups[0].cost_average_in_stock, null);
  f.state().products.push(phone('free', { price_cost: 0, stock_quantity: 2 }));
  assert.equal((await f.list()).groups[0].cost_average_in_stock, 0);
});

test('listing exposes stock disagreement without changing stock and counts units with unknown cost', async t => {
  const f = fixture(t, { products: [phone('green', { stock_quantity: 1 })], units: [
    { product_id: 'green', cost_price: 93200 }, { product_id: 'green', cost_price: null },
    { product_id: 'green', cost_price: 94700 }, { product_id: 'green', cost_price: 98200 },
  ] });
  const [group] = (await f.list()).groups;
  assert.equal(group.products[0].available_unit_count, 4);
  assert.equal(group.products[0].stock_quantity, 1);
  assert.deepEqual(group.products[0].unit_costs, [93200, 94700, 98200]);
  assert.equal(f.state().products[0].stock_quantity, 1);
  assert.deepEqual(f.state().history, []);
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

test('generic product patch preserves the system SKU', async t => {
  const f = fixture(t);
  await assert.rejects(
    patchProductWithGroupPrices(f.pool, 'R15C8256A', { sku: 'SKU-ALTERADO', price_retail: 150000 }),
    /não pode ser alterado/
  );
  assert.equal(f.state().products[0].sku, 'R15C8256A');
  await patchProductWithGroupPrices(f.pool, 'R15C8256A', { sku: 'R15C8256A', stock_quantity: 3 });
  assert.equal(f.state().products[0].sku, 'R15C8256A');
  assert.equal(f.state().products[0].stock_quantity, 3);
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
test('product patch removes technical copies, rejects financial metadata tampering and retains operational custom fields', async t => {
  const original = phone('LEGACY', { specs: { ram: '8GB', storage: '256GB', color: 'Verde', rede_operadora: '5G', nfc: 'Sim' },
    custom_fields: { featured: true, inherit_parent_cost: true, provider_flag: 'keep', rede_operadora: '5G' } });
  const f = fixture(t, { products: [original] });
  const before = core.configuration(original, model).id;
  await patchProductWithGroupPrices(f.pool, original.id, { specs: { ram: '8GB', storage: '256GB', rede_operadora: '4G', _price_group_network: '4G' }, custom_fields: { rede_operadora: '5G' } });
  const saved = f.state().products[0];
  const specs = core.object(saved.specs), custom = core.object(saved.custom_fields);
  assert.equal(specs.rede_operadora, undefined); assert.equal(specs.nfc, undefined);
  assert.equal(specs._price_group_network, '5G'); assert.equal(specs.color, 'Verde');
  assert.equal(core.configuration(saved, model).id, before);
  assert.deepEqual(custom, { featured: true, inherit_parent_cost: true, provider_flag: 'keep' });
  assert.equal(saved.stock_quantity, original.stock_quantity); assert.equal(saved.price_cost, original.price_cost);
  assert.equal(saved.price_retail, original.price_retail);
});
test('new smartphone writes use model-confirmed financial discriminator and do not persist technical template copies', async t => {
  const f = fixture(t, { products: [] });
  let saved;
  await withSmartphonePriceWrite(f.pool, phone('NEW', { specs: { ram: '8GB', storage: '256GB', rede_operadora: '5G', _price_group_network: '5G', nfc: 'Sim' } }), async (_db, product) => { saved = product; });
  assert.equal(saved.specs.rede_operadora, undefined); assert.equal(saved.specs.nfc, undefined);
  assert.equal(saved.specs._price_group_network, '4G');
  assert.equal(core.configuration(saved, model).network, '4g');
});
