'use strict';

// order-coin-redemption-v1: roda as rotas reais /table-data (recortadas de vps_server.js e
// vps_server.cjs) com um banco em memória, como stock-entry-lock.test.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const SETTINGS = { active: 1, coins_to_brl_rate: 100, max_redeem_percent: 20, min_coins_to_redeem: 100 };

function slice(src, start, end) {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `trecho nao encontrado: ${start}`);
  const to = src.indexOf(end, from + start.length);
  assert.ok(to > from, `fim nao encontrado: ${end}`);
  return src.slice(from, to);
}

function fakeReply() {
  return {
    statusCode: 200, payload: undefined,
    code(c) { this.statusCode = c; return this; },
    send(p) { this.payload = p; return this; },
  };
}

function createDb({ balance = 1000 } = {}) {
  const state = {
    orders: new Map(),
    balances: new Map([['cust-1', { customer_id: 'cust-1', balance, lifetime_earned: balance, lifetime_spent: 0 }]]),
    transactions: [],
    commits: 0,
    rollbacks: 0,
  };
  async function query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT * FROM cashback_settings')) return [[SETTINGS]];
    if (s.startsWith('SELECT * FROM coin_balances')) {
      const row = state.balances.get(params[0]);
      return [row ? [{ ...row }] : []];
    }
    if (s.startsWith('UPDATE coin_balances SET balance = balance -')) {
      const [coins, , customerId, minimum] = params;
      const row = state.balances.get(customerId);
      if (!row || row.balance < minimum) return [{ affectedRows: 0 }];
      row.balance -= coins; row.lifetime_spent += coins;
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('INSERT INTO coin_balances')) {
      const [, customerId, coins] = params;
      const row = state.balances.get(customerId);
      row.balance += coins; row.lifetime_spent = Math.max(0, row.lifetime_spent - coins);
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('INSERT INTO coin_transactions')) {
      const [id, customerId, amount, type, description, referenceId] = params;
      state.transactions.push({ id, customer_id: customerId, amount, type, status: 'completed', description, reference_id: referenceId, reference_type: 'order' });
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('SELECT customer_id, type, SUM(amount) AS total FROM coin_transactions')) {
      const sums = new Map();
      for (const t of state.transactions) {
        if (t.reference_id !== params[0]) continue;
        const key = `${t.customer_id}|${t.type}`;
        sums.set(key, (sums.get(key) || 0) + t.amount);
      }
      return [[...sums].map(([key, total]) => { const [customer_id, type] = key.split('|'); return { customer_id, type, total }; })];
    }
    if (s.startsWith('INSERT INTO `orders`')) {
      const cols = [...s.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]).slice(1);
      const row = Object.fromEntries(cols.map((c, i) => [c, params[i]]));
      state.orders.set(row.id, row);
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('SELECT * FROM `orders`') || s.startsWith('SELECT * FROM orders WHERE id')) {
      const row = state.orders.get(params[0]);
      return [row ? [{ ...row }] : []];
    }
    if (s.startsWith('SELECT id FROM orders')) return [state.orders.has(params[0]) ? [{ id: params[0] }] : []];
    if (s.startsWith('SELECT storefront FROM orders')) return [state.orders.has(params[0]) ? [{ storefront: null }] : []];
    if (s.startsWith('UPDATE `orders` SET')) {
      const cols = [...s.matchAll(/`([a-z_]+)` = \?/g)].map((m) => m[1]).filter((c) => c !== 'id');
      const id = params[params.length - 1];
      const row = state.orders.get(id);
      cols.forEach((c, i) => { row[c] = params[i]; });
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('DELETE FROM `orders`')) {
      const existed = state.orders.delete(params[0]);
      return [{ affectedRows: existed ? 1 : 0 }];
    }
    throw new Error(`SQL não previsto no teste: ${s}`);
  }
  const pool = {
    query,
    async getConnection() {
      return {
        query,
        async beginTransaction() {},
        async commit() { state.commits += 1; },
        async rollback() { state.rollbacks += 1; },
        release() {},
      };
    },
  };
  return { state, pool };
}

function loadRoutes(file, db) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const handlers = {};
  const context = {
    fastify: {
      post: (url, _opts, handler) => { handlers[`POST ${url}`] = handler; },
      patch: (url, _opts, handler) => { handlers[`PATCH ${url}`] = handler; },
      delete: (url, _opts, handler) => { handlers[`DELETE ${url}`] = handler; },
      get() {}, put() {},
    },
    pool: db.pool,
    require: (id) => require(id.startsWith('./') ? path.join(root, id) : id),
    crypto: require('node:crypto'),
    requireSyncKey() {},
    isValidTable: (name) => /^[a-zA-Z0-9_]+$/.test(name),
    isStockEntryLockedTableInsert: () => false,
    isStockEntryLockedProductWrite: () => false,
    stockEntryLockPayload: () => ({}),
    getPrimaryKey: async () => 'id',
    normalizeTableDataValue: (v) => (v === undefined ? null : v),
    syncCustomerGoogleContactRecord: async () => {},
    validateCashSessionForOperation: async () => null,
    recordCashEvent: async () => {},
  };
  vm.createContext(context);
  vm.runInContext(slice(src, "fastify.post('/table-data/:name',", '// INSERT em massa'), context);
  vm.runInContext(slice(src, "fastify.patch('/table-data/:name/:pkValue',", '// DELETE por PK'), context);
  vm.runInContext(slice(src, "fastify.delete('/table-data/:name/:pkValue',", '// EXPORT completo'), context);
  return handlers;
}

function orderBody(overrides = {}) {
  return { id: 'order-1', customer_id: 'cust-1', status: 'pending', subtotal: 100000, total: 99500, coins_spent: 500, coins_discount: 500, ...overrides };
}

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: criar pedido com moedas debita o saldo junto com o pedido`, async () => {
    const db = createDb({ balance: 1000 });
    const routes = loadRoutes(file, db);
    const reply = fakeReply();
    const row = await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: orderBody(), query: {} }, reply);
    assert.equal(reply.statusCode, 201);
    assert.equal(row.id, 'order-1');
    assert.equal(db.state.balances.get('cust-1').balance, 500);
    assert.deepEqual(db.state.transactions.map((t) => [t.type, t.amount]), [['spend_discount', -500]]);
    assert.equal(db.state.commits, 1);
  });

  test(`${file}: saldo insuficiente recusa o pedido com 409 e não grava nada`, async () => {
    const db = createDb({ balance: 200 });
    const routes = loadRoutes(file, db);
    const reply = fakeReply();
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: orderBody(), query: {} }, reply);
    assert.equal(reply.statusCode, 409);
    assert.equal(reply.payload.code, 'insufficient_balance');
    assert.equal(db.state.orders.size, 0);
    assert.equal(db.state.balances.get('cust-1').balance, 200);
    assert.equal(db.state.transactions.length, 0);
    assert.equal(db.state.rollbacks, 1);
  });

  test(`${file}: pedido sem moedas segue o caminho de sempre`, async () => {
    const db = createDb();
    const routes = loadRoutes(file, db);
    const reply = fakeReply();
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: orderBody({ coins_spent: 0, coins_discount: 0 }), query: {} }, reply);
    assert.equal(reply.statusCode, 201);
    assert.equal(db.state.orders.size, 1);
    assert.equal(db.state.transactions.length, 0);
    assert.equal(db.state.commits, 0);
  });

  test(`${file}: cancelar devolve as moedas uma vez, mesmo cancelando de novo`, async () => {
    const db = createDb({ balance: 1000 });
    const routes = loadRoutes(file, db);
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: orderBody(), query: {} }, fakeReply());
    for (let i = 0; i < 2; i += 1) {
      const reply = fakeReply();
      const row = await routes['PATCH /table-data/:name/:pkValue']({ params: { name: 'orders', pkValue: 'order-1' }, body: { status: 'cancelled' }, query: {} }, reply);
      assert.equal(row.status, 'cancelled');
    }
    assert.equal(db.state.balances.get('cust-1').balance, 1000);
    assert.deepEqual(db.state.transactions.map((t) => [t.type, t.amount]), [['spend_discount', -500], ['refund_cancel', 500]]);
  });

  test(`${file}: excluir o pedido (rollback do checkout) devolve as moedas`, async () => {
    const db = createDb({ balance: 1000 });
    const routes = loadRoutes(file, db);
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: orderBody(), query: {} }, fakeReply());
    const result = await routes['DELETE /table-data/:name/:pkValue']({ params: { name: 'orders', pkValue: 'order-1' }, query: {} }, fakeReply());
    assert.equal(result.ok, true);
    assert.equal(result.deleted, 1);
    assert.equal(db.state.orders.size, 0);
    assert.equal(db.state.balances.get('cust-1').balance, 1000);
  });

  test(`${file}: mudar status sem cancelar não devolve moedas`, async () => {
    const db = createDb({ balance: 1000 });
    const routes = loadRoutes(file, db);
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: orderBody(), query: {} }, fakeReply());
    await routes['PATCH /table-data/:name/:pkValue']({ params: { name: 'orders', pkValue: 'order-1' }, body: { status: 'completed' }, query: {} }, fakeReply());
    assert.equal(db.state.balances.get('cust-1').balance, 500);
    assert.equal(db.state.transactions.length, 1);
  });
}
