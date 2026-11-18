// Parte 3: devolver estoque só dos itens e quantidades devolvidos, dentro da transação da devolução.
const test = require('node:test');
const assert = require('node:assert/strict');
const { restoreStockMovements } = require('../services/stockMovementRestoration.cjs');

function setup() {
  const state = { balances: { p1: 0, p2: 5 }, restores: [], began: 0, committed: 0, released: 0 };
  const movements = [
    { id: 'm1', product_id: 'p1', from_deposit_id: 'd', from_location_id: 'l', company_id: 'c', quantity: 2 },
    { id: 'm2', product_id: 'p2', from_deposit_id: 'd', from_location_id: 'l', company_id: 'c', quantity: 1 },
  ];
  const db = {
    beginTransaction: async () => { state.began++; }, commit: async () => { state.committed++; }, rollback: async () => {}, release: () => { state.released++; },
    query: async (sql, args) => {
      if (sql.startsWith('SET TRANSACTION')) return [];
      if (/SELECT id FROM sales/.test(sql)) return [[{ id: args[0] }]];
      if (sql.startsWith('SELECT id,company_id')) return [[{ id: args[0], company_id: 'c' }]];
      if (sql.startsWith('SELECT * FROM stock_location_movements')) return [movements];
      if (sql.startsWith('SELECT product_id,to_deposit_id')) return [state.restores.map(r => ({ product_id: r.product_id, to_deposit_id: 'd', to_location_id: 'l', quantity: r.quantity }))];
      throw new Error('SQL inesperado ' + sql);
    },
  };
  const helpers = {
    getStockLocationRow: async p => ({ quantity: state.balances[p], reserved_quantity: 0, company_id: 'c' }),
    upsertStockLocationBalance: async i => { state.balances[i.productId] = i.quantity; },
    insertStockMovement: async row => { state.restores.push(row); },
    syncProductStockFromLocations: async () => {},
    getDefaultStockCompanyId: async () => 'c',
  };
  const pool = { getConnection: async () => db };
  const opts = extra => ({ referenceType: 'sale', restoreReferenceType: 'sale_restore', referenceId: 'S', reason: 'Devolução', notes: null, ...extra });
  return { state, db, pool, helpers, opts };
}

test('com limite devolve só o produto e a quantidade pedidos', async () => {
  const { state, pool, helpers, opts } = setup();
  const result = await restoreStockMovements(pool, opts({ limits: new Map([['p1', 1]]) }), helpers);
  assert.deepEqual(result.map(r => [r.product_id, r.quantity_restored]), [['p1', 1]]);
  assert.deepEqual(state.balances, { p1: 1, p2: 5 });
});

test('segunda devolução completa o que faltava sem passar do que saiu', async () => {
  const { state, pool, helpers, opts } = setup();
  await restoreStockMovements(pool, opts({ limits: new Map([['p1', 1]]) }), helpers);
  await restoreStockMovements(pool, opts({ limits: new Map([['p1', 5]]) }), helpers);
  assert.equal(state.balances.p1, 2);
});

test('com conexão da devolução não abre nem fecha transação própria', async () => {
  const { state, db, pool, helpers, opts } = setup();
  await restoreStockMovements(pool, opts({ connection: db, limits: new Map([['p2', 1]]) }), helpers);
  assert.deepEqual([state.began, state.committed, state.released], [0, 0, 0]);
  assert.equal(state.balances.p2, 6);
});

test('sem limite continua devolvendo tudo', async () => {
  const { state, pool, helpers, opts } = setup();
  await restoreStockMovements(pool, opts(), helpers);
  assert.deepEqual(state.balances, { p1: 2, p2: 6 });
  assert.equal(state.committed, 1);
});
