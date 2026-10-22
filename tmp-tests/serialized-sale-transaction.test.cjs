const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const Fastify = require('fastify');
const { finalizeSerializedSale } = require('../services/serializedSaleFinalization.cjs');
function fixture(failure, smartphone = false) {
  let state = { sales: [], items: [], units: ['u1', 'u2'].map(id => ({ id, product_id: 'p1', status: 'available', sale_id: null, order_id: null })), stock: 2 };
  const model = { id:'m1',name:'Phone',company_id:'store',category_name:'Smartphones' };
  const product = { id:'p1',model_id:'m1',specs:{ram:'4GB',storage:'256GB',version:'Global'},price_retail:97200,price_wholesale:78200,price_reseller:92200 };
  state.costStates = {}; state.basis = [];
  if (smartphone) {
    state.units = [92500,99900,117000].map((cost_price,i)=>({id:'u'+(i+1),product_id:'p1',cost_price,status:'available',sale_id:null,order_id:null}));
    state.stock=3;
  }
  let working; let releaseLock; let tail = Promise.resolve(); const events = [];
  const pool = { getConnection: async () => {
    let local;
    return {
      beginTransaction: async () => {
        const prior = tail;
        tail = new Promise(resolve => { releaseLock = resolve; });
        const unlock = releaseLock;
        await prior;
        local = { unlock }; working = structuredClone(state); events.push('begin');
      },
      query: async (sql, args) => {
        if (sql.startsWith('SET TRANSACTION ISOLATION')) return [{}];
        if (sql.startsWith('SELECT * FROM sales')) return [working.sales.filter(row => row.id === args[0])];
        if (sql.startsWith('SELECT * FROM sale_items')) return [working.items.filter(row => row.sale_id === args[0])];
        if (sql.startsWith('SELECT * FROM products')) return [[smartphone ? product : { id: args[0] }]];
        if (sql.includes('SELECT DISTINCT m.id')) return [smartphone ? [model] : []];
        if (sql.includes('FROM models WHERE id=')) return [[model]];
        if (sql.includes('FROM smartphone_inventory_cost_state')) return [[working.costStates[args[0]]].filter(Boolean)];
        if (sql.includes('FROM unit_journal_events')) return [[]];
        if (sql.includes('FROM units u')) return [working.units];
        if (sql.includes('FROM smartphone_sale_cost_basis')) return [working.basis.filter(b=>b.sale_id===args[0])];
        if (sql.startsWith('INSERT INTO smartphone_inventory_cost_state')) {
          if (failure === 'cost-ledger') throw Error('cost ledger write failed');
          working.costStates[args[0]]={state:args[1],initialized_at:'2026-10-22'};return [{}];
        }
        if (sql.startsWith('INSERT IGNORE INTO smartphone_sale_cost_basis')) {
          const [sale_id,unit_id,configuration_id,unit_cost,purchase_cost]=args;
          if(!working.basis.some(b=>b.sale_id===sale_id&&b.unit_id===unit_id)) working.basis.push({sale_id,unit_id,configuration_id,unit_cost,purchase_cost});
          return [{}];
        }
        if (sql.startsWith('SELECT * FROM units')) return [working.units.filter(row => row.id === args[0])];
        if (sql.startsWith('SELECT id, status, sale_id FROM units')) return [working.units.filter(row => row.sale_id === args[0])];
        if (sql.startsWith('INSERT INTO')) {
          const table = sql.match(/INSERT INTO (\w+)/)[1];
          const keys = [...sql.matchAll(/`(\w+)`/g)].map(match => match[1]);
          const row = Object.fromEntries(keys.map((key, i) => [key, args[i]]));
          if (failure === 'items' && table === 'sale_items' && working.items.length) throw Error('item write failed');
          working[table === 'sales' ? 'sales' : 'items'].push(row); events.push('insert:' + table); return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('UPDATE units')) {
          if (failure === 'second-unit' && args[1] === 'u2') throw Error('second unit write failed');
          const unit = working.units.find(row => row.id === args[1] && row.status === 'available');
          if (!unit) return [{ affectedRows: 0 }];
          Object.assign(unit, { status: 'sold', sale_id: args[0] }); events.push('sold:' + unit.id);
          return [{ affectedRows: 1 }];
        }
        throw Error('unexpected SQL: ' + sql);
      },
      commit: async () => { state = working; events.push('commit'); },
      rollback: async () => { events.push('rollback'); },
      release: () => { local?.unlock(); events.push('release'); },
    };
  } };
  const syncProductStock = async (_id, db) => {
    assert.ok(db.query); events.push('sync');
    working.stock = working.units.filter(unit => unit.status === 'available').length;
    if (failure === 'sync') throw Error('balance write failed');
  };
  const body = { sale: { id: 'sale1', payment_status: 'paid', total: 20000 }, items: ['u1', 'u2'].map(id => ({ sale_id: 'sale1', product_id: 'p1', serialized_unit_id: id, quantity: 1, unit_price: 10000 })) };
  return { pool, syncProductStock, body, events, state: () => structuredClone(state) };
}
test('sale/items/units commit together and identical retry is idempotent', async () => {
  const f = fixture();
  const result = await finalizeSerializedSale({ ...f, ...f.body });
  assert.equal(result.replay, false); assert.equal(f.state().sales.length, 1);
  assert.equal(f.state().items.length, 2); assert.equal(f.state().stock, 0);
  assert.ok(f.state().units.every(unit => unit.status === 'sold' && unit.sale_id === 'sale1'));
  assert.ok(f.events.indexOf('commit') > f.events.indexOf('sync'));
  const retry = await finalizeSerializedSale({ ...f, ...f.body });
  assert.equal(retry.replay, true); assert.equal(f.state().items.length, 2);
});
test('retry compares database decimals and canonical JSON by value',async()=>{
  const f=fixture(),body={sale:{...f.body.sale,payment_methods:[{operator_fee_amount:100,method:'pix',amount:20000}]},items:f.body.items.map(i=>({...i,unit_cost:5000,total:10000}))};
  await finalizeSerializedSale({...f,...body});
  const original=f.pool.getConnection;
  f.pool.getConnection=async()=>{
    const db=await original(),query=db.query;
    db.query=async(sql,args)=>{
      const result=await query(sql,args);
      if(sql.startsWith('SELECT * FROM sales'))return [result[0].map(r=>({...r,total:Number(r.total).toFixed(2),payment_methods:[{amount:20000,method:'pix',operator_fee_amount:100}]}))];
      if(sql.startsWith('SELECT * FROM sale_items'))return [result[0].map(r=>({...r,unit_price:Number(r.unit_price).toFixed(2),unit_cost:Number(r.unit_cost).toFixed(2),total:Number(r.total).toFixed(2)}))];
      return result;
    };return db;
  };
  assert.equal((await finalizeSerializedSale({...f,...body})).replay,true);
});
test('a database deadlock retries the complete transaction without duplicating a sale',async()=>{
  const f=fixture(undefined,true);let attempts=0;
  const sync=async(...args)=>{if(attempts++===0)throw Object.assign(Error('retry fixture'),{code:'ER_LOCK_DEADLOCK'});return f.syncProductStock(...args);};
  await finalizeSerializedSale({...f,...f.body,syncProductStock:sync});
  assert.equal(attempts,2);assert.equal(f.state().sales.length,1);
  assert.equal(f.state().items.length,2);assert.equal(f.state().basis.length,2);
});
for (const failure of ['items', 'second-unit', 'sync']) test('rollback preserves entire original state after ' + failure, async () => {
  const f = fixture(failure); const original = f.state();
  await assert.rejects(finalizeSerializedSale({ ...f, ...f.body }));
  assert.deepEqual(f.state(), original); assert.ok(f.events.includes('rollback')); assert.ok(!f.events.includes('commit'));
});
test('concurrent sales cannot sell the same units twice', async () => {
  const f = fixture(); const other = { sale: { ...f.body.sale, id: 'sale2' }, items: f.body.items.map(item => ({ ...item, sale_id: 'sale2' })) };
  const results = await Promise.allSettled([finalizeSerializedSale({ ...f, ...f.body }), finalizeSerializedSale({ ...f, ...other })]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(f.state().sales.length, 1); assert.equal(f.state().items.length, 2);
});
test('smartphone sale persists authoritative average, immutable basis and real purchase in the same commit', async () => {
  const f=fixture(undefined,true);
  const body={sale:{id:'sale1',payment_status:'paid',total:97200,cost_total:92500,profit:4700,payment_methods:[{operator_fee_amount:100}],delivery_total:200},
    items:[{sale_id:'sale1',product_id:'p1',serialized_unit_id:'u1',quantity:1,unit_price:97200,unit_cost:92500,total:97200}]};
  const result=await finalizeSerializedSale({...f,...body});
  assert.equal(result.sale.cost_total,103133);
  assert.equal(result.sale.profit,-6233);
  assert.equal(f.state().items[0].unit_cost,103133);
  assert.equal(f.state().units[0].cost_price,92500);
  assert.equal(f.state().basis[0].purchase_cost,92500);
  assert.equal(f.state().basis[0].unit_cost,103133);
  assert.equal((await finalizeSerializedSale({...f,...body})).replay,true);
  assert.equal(f.state().basis.length,1);
  const second={sale:{...body.sale,id:'sale2'},items:[{...body.items[0],sale_id:'sale2',serialized_unit_id:'u2',unit_cost:99900}]};
  await finalizeSerializedSale({...f,...second});
  assert.equal(f.state().items[1].unit_cost,103134);
  const ledger=JSON.parse(f.state().costStates.m1.state);
  const g=Object.values(ledger.groups)[0];
  assert.equal(require('../services/smartphoneMovingAverageCore.cjs').average(g),103133);
  assert.equal(g.quantity,1);
});
test('failed cost ledger persistence rolls back sale, financial totals and IMEI stock',async()=>{
  const f=fixture('cost-ledger',true),before=f.state();
  await assert.rejects(finalizeSerializedSale({...f,...f.body}),/ledger/);
  assert.deepEqual(f.state(),before);
});
test('concurrent different IMEIs share the configuration balance instead of using purchase costs',async()=>{
  const f=fixture(undefined,true);
  const saleFor=(id,unitId)=>({sale:{id,payment_status:'paid',total:97200},items:[{sale_id:id,product_id:'p1',serialized_unit_id:unitId,quantity:1,unit_price:97200,unit_cost:1}]});
  const results=await Promise.all([finalizeSerializedSale({...f,...saleFor('first','u1')}),finalizeSerializedSale({...f,...saleFor('second','u2')})]);
  assert.deepEqual(results.map(r=>r.sale.cost_total),[103133,103134]);
  assert.equal(f.state().stock,1);
  assert.deepEqual(f.state().units.map(u=>u.cost_price),[92500,99900,117000]);
});
test('duplicate unit, quantity and mismatched product/status fail without completed sale', async () => {
  for (const variant of ['duplicate', 'quantity', 'product', 'hidden']) {
    const f = fixture(); const body = structuredClone(f.body);
    if (variant === 'duplicate') body.items[1].serialized_unit_id = 'u1';
    if (variant === 'quantity') body.items[0].quantity = 2;
    if (variant === 'product') body.items[0].product_id = 'other';
    if (variant === 'hidden') {
      // Disponibilidade negada pela leitura da unidade, sem modificar estoque real.
      const original = f.pool.getConnection;
      f.pool.getConnection = async () => {
        const db = await original(); const query = db.query;
        db.query = async (sql, args) => sql.startsWith('SELECT * FROM units') ? [[{ id: args[0], product_id: 'p1', status: 'hidden' }]] : query(sql, args);
        return db;
      };
    }
    await assert.rejects(finalizeSerializedSale({ ...f, ...body }));
    assert.equal(f.state().sales.length, 0); assert.equal(f.state().stock, 2);
  }
});
test('client chooses atomic endpoint and no longer performs per-unit rollback', () => {
  const source = fs.readFileSync('services/saleService.ts', 'utf8');
  const create = source.slice(source.indexOf('export const createSale ='), source.indexOf('export const getSales ='));
  assert.match(create, /hasSerializedUnits \? '\/sales\/finalize-serialized'/);
  assert.doesNotMatch(create, /unitService\.(markAsSold|release)\(/);
  assert.match(create, /if \(!hasSerializedUnits\) await vpsClient.post\('\/table-data\/sale_items\/bulk'/);
});
test('canonical serialized balance writer uses the transaction for all product/location writes', async () => {
  for (const file of ['vps_server.cjs', 'vps_server.js']) {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf('async function syncSerializedProductStockFromUnits(');
    const end = source.indexOf('// ─── Recibos Avulsos', start);
    const calls = [];
    const db = { query: async (sql, values) => {
      calls.push(sql);
      if (sql.startsWith('SELECT id, company_id')) return [[{ id: 'p1', company_id: 'company' }]];
      if (sql.includes('physical_quantity')) return [[{ physical_quantity: 1, available_quantity: 1, reserved_quantity: 0, deposit_id: 'deposit', location_id: 'location' }]];
      return [{ affectedRows: 1 }];
    } };
    let balanceDb;
    const sync = new Function('pool', 'getDefaultStockCompanyId', 'ensureDefaultStockLocation', 'upsertStockLocationBalance', 'require',
      source.slice(start, end) + ';return syncProductStock;')(
      { query: () => { throw Error('escaped transaction'); } }, () => 'company', () => ({ depositId: 'deposit', locationId: 'location' }),
      async input => { balanceDb = input.db; }, () => ({ synchronizeProduct: async (_pool, _id, transaction) => assert.equal(transaction, db) }));
    assert.equal(await sync('p1', db), 1);
    assert.equal(balanceDb, db);
    assert.ok(calls.some(sql => sql.startsWith('DELETE FROM product_stock_locations')));
    assert.ok(calls.some(sql => sql.startsWith('UPDATE products SET stock_quantity')));
  }
});
test('client propagates rejected atomic write without items, stock or notification requests', async () => {
  const calls = [];
  const modules = {
    '../utils/saleCalculations': {
      calculateSaleTotals: () => ({ subtotal: 10000, discount_total: 0, cost_total: 5000 }),
      calculateSalePaymentTotals: () => ({ total: 10000 }), prepareSalePayments: () => [],
    },
    '../utils/money': { moneyToCents: value => Number(value), moneyReaisToCents: value => Math.round(Number(value) * 100) },
    './vpsClient': { vpsClient: { post: async (path, body) => { calls.push({ path, body }); throw Error('Unidade indisponivel'); } } },
  };
  const context = { exports: {}, require: id => modules[id] || {}, console: { error() {}, warn() {}, log() {} }, crypto: require('node:crypto').webcrypto };
  const code = ts.transpileModule(fs.readFileSync('services/saleService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, context);
  await assert.rejects(context.exports.createSale({ items: [{ product_id: 'p1', quantity: 1, unit_price: 10000, total: 10000,
    serialized_unit: { unitId: 'u1' } }], payment_methods: [] }), /Unidade indisponivel/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/sales/finalize-serialized');
  assert.equal(calls[0].body.items[0].serialized_unit_id, 'u1');
});
test('HTTP entrypoints return committed sale and start effects only after commit', async () => {
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    for (const failure of [undefined, 'second-unit']) {
      const f = fixture(failure); const app = Fastify();
      const source = fs.readFileSync(file, 'utf8');
      const start = source.indexOf("fastify.post('/sales/finalize-serialized'");
      const end = source.indexOf("fastify.post('/table-data/:name'", start);
      const notify = async () => { assert.ok(f.events.includes('commit')); f.events.push('notify'); };
      const deps = { fastify: app, pool: f.pool, syncProductStock: f.syncProductStock,
        requireSyncKeyOrAdmin: async () => {}, require: () => ({ finalizeSerializedSale }),
        ensurePurchaseCoinsForSaleVps: notify, notifyTelegramPdvSaleVps: notify, recordMobilePdvSaleVps: notify,
        console: { error() {} } };
      new Function(...Object.keys(deps), source.slice(start, end))(...Object.values(deps));
      try {
        const response = await app.inject({ method: 'POST', url: '/sales/finalize-serialized', payload: f.body });
        assert.equal(response.statusCode, failure ? 500 : 200);
        if (failure) assert.ok(!f.events.includes('notify'));
        else { assert.equal(response.json().id, 'sale1'); assert.ok(f.events.includes('notify')); }
      } finally { await app.close(); }
    }
  }
});
