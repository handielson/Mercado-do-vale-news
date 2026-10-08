const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { restoreStockMovements } = require('../services/stockMovementRestoration.cjs');

function fixture() {
  const movements = ['p1', 'p2'].map((product_id, index) => ({
    id: 'm' + index, product_id, from_deposit_id: 'd', from_location_id: 'l',
    company_id: 'company', quantity: index + 1,
  }));
  let state = {
    balances: { p1: { quantity: 3, reserved_quantity: 1 }, p2: { quantity: 4, reserved_quantity: 2 } },
    totals: { p1: 3, p2: 4 }, restores: [],
  };
  let tail = Promise.resolve(), failAt = null;
  let commits = 0, rollbacks = 0, releases = 0, acquired = 0;
  const pool = { getConnection: async () => {
    acquired++;
    let unlock, draft;
    const counts = {};
    const check = stage => {
      counts[stage] = (counts[stage] || 0) + 1;
      if (failAt === stage + ':' + counts[stage]) throw new Error('failure ' + stage);
    };
    const db = {
      get draft() { return draft; }, check,
      beginTransaction: async () => {},
      query: async (sql, args) => {
        if (sql.startsWith('SET TRANSACTION')) return [];
        if (/SELECT id FROM (sales|orders)/.test(sql)) {
          assert.match(sql, /WHERE id=\? FOR UPDATE$/);
          const previous = tail;
          tail = new Promise(resolve => { unlock = resolve; });
          await previous;
          draft = structuredClone(state);
          return [args[0] === 'missing' ? [] : [{ id: args[0] }]];
        }
        if (sql.startsWith('SELECT id,company_id')) {
          assert.match(sql, /FOR UPDATE$/);
          return [[{ id: args[0], company_id: 'company' }]];
        }
        if (sql.startsWith('SELECT * FROM stock_location_movements')) return [structuredClone(movements)];
        if (sql.startsWith('SELECT product_id,to_deposit_id')) return [structuredClone(draft.restores)];
        throw new Error('Unexpected SQL: ' + sql);
      },
      commit: async () => { check('commit'); state = draft; commits++; },
      rollback: async () => { rollbacks++; },
      release: () => { releases++; unlock?.(); },
    };
    return db;
  }};
  const helpers = {
    getStockLocationRow: async (product, deposit, location, lock, db) => {
      assert.equal(lock, true); assert.equal(deposit, 'd'); assert.equal(location, 'l');
      return { ...db.draft.balances[product], company_id: 'company' };
    },
    upsertStockLocationBalance: async input => {
      input.db.check('balance');
      input.db.draft.balances[input.productId] = { quantity: input.quantity, reserved_quantity: input.reservedQuantity };
    },
    insertStockMovement: async (row, db) => {
      db.check('movement'); db.draft.restores.push({ ...row });
    },
    syncProductStockFromLocations: async (id, db) => {
      db.check('total'); db.draft.totals[id] = db.draft.balances[id].quantity;
    },
    getDefaultStockCompanyId: async () => 'company',
  };
  const input = { referenceType: 'sale', restoreReferenceType: 'sale_restore', referenceId: 'sale', reason: 'test', notes: null };
  return {
    run: overrides => restoreStockMovements(pool, { ...input, ...overrides }, helpers),
    get state() { return state; }, movements,
    fail: stage => { failAt = stage; },
    get stats() { return { acquired, releases, commits, rollbacks }; },
  };
}

test('balances, reserved quantities, movements and product totals commit together', async () => {
  const f = fixture();
  const rows = await f.run();
  assert.deepEqual(rows.map(row => row.quantity_restored), [1, 2]);
  assert.deepEqual(f.state.balances, { p1: { quantity: 4, reserved_quantity: 1 }, p2: { quantity: 6, reserved_quantity: 2 } });
  assert.deepEqual(f.state.totals, { p1: 4, p2: 6 });
  assert.equal(f.state.restores.length, 2);
  assert.deepEqual(await f.run(), []);
  assert.equal(f.state.restores.length, 2);
  assert.equal(f.stats.releases, f.stats.acquired);
});

for (const failure of ['balance:1', 'balance:2', 'movement:1', 'movement:2', 'total:1', 'total:2', 'commit:1']) {
  test('rollback and complete retry after ' + failure, async () => {
    const f = fixture(), original = structuredClone(f.state);
    f.fail(failure);
    await assert.rejects(f.run(), /failure/);
    assert.deepEqual(f.state, original);
    assert.equal(f.stats.rollbacks, 1);
    f.fail(null);
    assert.equal((await f.run()).length, 2);
    assert.deepEqual(f.state.totals, { p1: 4, p2: 6 });
    assert.equal(f.state.restores.length, 2);
    assert.equal(f.stats.releases, f.stats.acquired);
  });
}

test('concurrent attempts for the same sale restore each movement once', async () => {
  const f = fixture();
  const result = await Promise.all([f.run(), f.run()]);
  assert.equal(result.reduce((count, rows) => count + rows.length, 0), 2);
  assert.deepEqual(f.state.totals, { p1: 4, p2: 6 });
  assert.equal(f.state.restores.length, 2);
});

test('retry of historical partial restoration returns only missing quantities', async () => {
  const f = fixture();
  f.state.balances.p1.quantity = 4; f.state.totals.p1 = 4;
  f.state.restores.push({ product_id: 'p1', to_deposit_id: 'd', to_location_id: 'l', quantity: 1 });
  const rows = await f.run();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].product_id, 'p2');
  assert.equal(rows[0].quantity_restored, 2);
  assert.deepEqual(f.state.totals, { p1: 4, p2: 6 });
});

test('multiple original movements in one location account for partial returns', async () => {
  const f = fixture();
  f.movements.push({ ...f.movements[0], id: 'm3', quantity: 2 });
  f.state.balances.p1.quantity = 5; f.state.totals.p1 = 5;
  f.state.restores.push({ product_id: 'p1', to_deposit_id: 'd', to_location_id: 'l', quantity: 2 });
  const rows = await f.run();
  assert.equal(rows.filter(row => row.product_id === 'p1').reduce((sum, row) => sum + row.quantity_restored, 0), 1);
  assert.equal(f.state.totals.p1, 6);
  assert.deepEqual(await f.run(), []);
});

test('invalid reference and contradictory historical returns do not mutate stock', async () => {
  const f = fixture();
  await assert.rejects(f.run({ referenceId: '' }), error => error.statusCode === 400);
  assert.equal(f.stats.acquired, 0);
  await assert.rejects(f.run({ referenceId: 'missing' }), error => error.statusCode === 404);
  f.state.restores.push({ product_id: 'p1', to_deposit_id: 'd', to_location_id: 'l', quantity: 10 });
  const original = structuredClone(f.state);
  await assert.rejects(f.run(), error => error.statusCode === 409);
  assert.deepEqual(f.state, original);
});

test('orders use the same transactional restoration and empty movements are harmless', async () => {
  const f = fixture();
  assert.equal((await f.run({ referenceType: 'order', restoreReferenceType: 'order_restore' })).length, 2);
  assert.ok(f.state.restores.every(row => row.reference_type === 'order_restore'));
  const empty = fixture(); empty.movements.length = 0;
  assert.deepEqual(await empty.run(), []);
});

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  test(file + ': existing restore routes delegate to the canonical transaction', () => {
    const source = fs.readFileSync(file, 'utf8');
    for (const name of ['getStockLocationRow', 'insertStockMovement', 'syncProductStockFromLocations']) {
      const start = source.indexOf('async function ' + name + '(');
      const helper = source.slice(start, source.indexOf('\n}', start) + 2);
      assert.match(helper, /db = pool/);
      assert.match(helper, /db.query/);
      assert.doesNotMatch(helper, /pool.query/);
    }
    const start = source.indexOf('async function restoreStockFromMovements(');
    const body = source.slice(start, source.indexOf('\n}', start) + 2);
    assert.match(body, /stockMovementRestoration.cjs/);
    assert.doesNotMatch(body, /if \(existing/);
    assert.match(source, /fastify.post\('\/stock-locations\/sale-restores'/);
    assert.match(source, /fastify.post\('\/stock-locations\/order-restores'/);
  });
}
