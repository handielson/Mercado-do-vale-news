'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  CouponRedemptionError,
  hasCouponRedemption,
  reserveCouponForOrder,
  releaseCouponForOrder,
} = require('../services/orderCouponRedemption.cjs');

const root = path.resolve(__dirname, '..');

function createDb({ coupon = {}, customerType = 'retail', balance = 1000 } = {}) {
  const state = {
    coupons: new Map([['c-1', { id: 'c-1', code: 'VALE10', type: 'percent', value: 10, min_order: 0, max_uses: 2, uses_count: 0, expires_at: null, active: 1, target_type: 'all', ...coupon }]]),
    redemptions: new Map(),
    orders: new Map(),
    balances: new Map([['cust-1', { customer_id: 'cust-1', balance, lifetime_spent: 0 }]]),
    transactions: [],
    customerType,
  };
  async function query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('CREATE TABLE IF NOT EXISTS coupon_redemptions')) return [{}];
    if (s.startsWith('SELECT * FROM coupon_redemptions WHERE order_id = ? AND released_at IS NULL')) {
      const r = state.redemptions.get(params[0]);
      return [r && !r.released_at ? [{ ...r }] : []];
    }
    if (s.startsWith('SELECT * FROM coupon_redemptions')) { const r = state.redemptions.get(params[0]); return [r ? [{ ...r }] : []]; }
    if (s.startsWith('SELECT * FROM coupons WHERE code')) return [[...state.coupons.values()].filter((c) => c.code === params[0]).map((c) => ({ ...c }))];
    if (s.startsWith('SELECT customer_type FROM customers')) return [[{ customer_type: state.customerType }]];
    if (s.startsWith('UPDATE coupons SET uses_count = uses_count + 1')) {
      const c = state.coupons.get(params[0]);
      if (c.max_uses != null && c.uses_count >= c.max_uses) return [{ affectedRows: 0 }];
      c.uses_count += 1; return [{ affectedRows: 1 }];
    }
    if (s.startsWith('UPDATE coupons SET uses_count = GREATEST')) { const c = state.coupons.get(params[0]); c.uses_count = Math.max(c.uses_count - 1, 0); return [{ affectedRows: 1 }]; }
    if (s.startsWith('INSERT INTO coupon_redemptions')) { const [order_id, coupon_id, code, discount_cents] = params; state.redemptions.set(order_id, { order_id, coupon_id, code, discount_cents, released_at: null }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('UPDATE coupon_redemptions SET released_at')) { state.redemptions.get(params[0]).released_at = 'agora'; return [{ affectedRows: 1 }]; }
    // moedas (o pedido pode ter cupom e moedas juntos)
    if (s.startsWith('SELECT * FROM cashback_settings')) return [[{ active: 1, coins_to_brl_rate: 100, max_redeem_percent: 20, min_coins_to_redeem: 100 }]];
    if (s.startsWith('SELECT * FROM coin_balances')) { const b = state.balances.get(params[0]); return [b ? [{ ...b }] : []]; }
    if (s.startsWith('UPDATE coin_balances SET balance = balance -')) { const b = state.balances.get(params[2]); if (b.balance < params[3]) return [{ affectedRows: 0 }]; b.balance -= params[0]; return [{ affectedRows: 1 }]; }
    if (s.startsWith('INSERT INTO coin_balances')) { state.balances.get(params[1]).balance += params[2]; return [{ affectedRows: 1 }]; }
    if (s.startsWith('INSERT INTO coin_transactions')) { state.transactions.push({ customer_id: params[1], amount: params[2], type: params[3], reference_id: params[5] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('SELECT customer_id, type, SUM(amount)')) {
      const sums = new Map();
      for (const t of state.transactions) if (t.reference_id === params[0]) { const k = `${t.customer_id}|${t.type}`; sums.set(k, (sums.get(k) || 0) + t.amount); }
      return [[...sums].map(([k, total]) => ({ customer_id: k.split('|')[0], type: k.split('|')[1], total }))];
    }
    // pedidos
    if (s.startsWith('INSERT INTO `orders`')) {
      const cols = [...s.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]).slice(1);
      const row = Object.fromEntries(cols.map((c, i) => [c, params[i]]));
      state.orders.set(row.id, row); return [{ affectedRows: 1 }];
    }
    if (s.startsWith('SELECT * FROM `orders`') || s.startsWith('SELECT * FROM orders WHERE id')) { const o = state.orders.get(params[0]); return [o ? [{ ...o }] : []]; }
    if (s.startsWith('SELECT id FROM orders')) return [state.orders.has(params[0]) ? [{ id: params[0] }] : []];
    if (s.startsWith('SELECT storefront FROM orders')) return [state.orders.has(params[0]) ? [{ storefront: null }] : []];
    if (s.startsWith('UPDATE `orders` SET')) {
      const cols = [...s.matchAll(/`([a-z_]+)` = \?/g)].map((m) => m[1]).filter((c) => c !== 'id');
      const o = state.orders.get(params[params.length - 1]); cols.forEach((c, i) => { o[c] = params[i]; }); return [{ affectedRows: 1 }];
    }
    if (s.startsWith('DELETE FROM `orders`')) return [{ affectedRows: state.orders.delete(params[0]) ? 1 : 0 }];
    throw new Error(`SQL não previsto no teste: ${s}`);
  }
  const pool = {
    query,
    async getConnection() {
      return { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
    },
  };
  return { state, pool, connection: pool };
}

function order(overrides = {}) {
  return { id: 'order-1', customer_id: 'cust-1', subtotal: 100000, coupon_code: 'vale10', coupon_discount: 10000, coins_spent: 0, coins_discount: 0, ...overrides };
}

test('só conta uso quando o cupom gera desconto', () => {
  assert.equal(hasCouponRedemption({ coupon_code: 'VALE10', coupon_discount: 0 }), false);
  assert.equal(hasCouponRedemption({ coupon_code: 'VALE10', coupon_discount: 500 }), true);
});

test('reserva o uso uma vez por pedido', async () => {
  const { state, connection } = createDb();
  await reserveCouponForOrder(connection, order());
  await reserveCouponForOrder(connection, order());
  assert.equal(state.coupons.get('c-1').uses_count, 1);
  assert.equal(state.redemptions.size, 1);
});

test('recusa cupom esgotado, expirado, inativo ou de outro tipo de cliente', async () => {
  await assert.rejects(reserveCouponForOrder(createDb({ coupon: { uses_count: 2 } }).connection, order()), { code: 'coupon_limit' });
  await assert.rejects(reserveCouponForOrder(createDb({ coupon: { expires_at: '2020-01-01' } }).connection, order()), { code: 'coupon_expired' });
  await assert.rejects(reserveCouponForOrder(createDb({ coupon: { active: 0 } }).connection, order()), { code: 'coupon_invalid' });
  await assert.rejects(reserveCouponForOrder(createDb({ coupon: { target_type: 'atacado' } }).connection, order()), { code: 'coupon_customer_type' });
  await reserveCouponForOrder(createDb({ coupon: { target_type: 'atacado' }, customerType: 'wholesale' }).connection, order());
});

test('recusa desconto acima do cupom e pedido abaixo do mínimo', async () => {
  await assert.rejects(reserveCouponForOrder(createDb().connection, order({ coupon_discount: 50000 })), { code: 'coupon_above_allowed' });
  await assert.rejects(reserveCouponForOrder(createDb({ coupon: { min_order: 2000 } }).connection, order()), { code: 'coupon_min_order' });
  await assert.rejects(reserveCouponForOrder(createDb().connection, order({ coupon_code: '' })), (e) => e instanceof CouponRedemptionError && e.code === 'coupon_missing');
});

test('liberar devolve o uso uma única vez', async () => {
  const { state, connection } = createDb();
  await reserveCouponForOrder(connection, order());
  assert.equal(await releaseCouponForOrder(connection, 'order-1'), true);
  assert.equal(await releaseCouponForOrder(connection, 'order-1'), false);
  assert.equal(state.coupons.get('c-1').uses_count, 0);
});

// ── Rotas reais (recortadas de vps_server.js e vps_server.cjs) ──────────────
function slice(src, start, end) {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `trecho nao encontrado: ${start}`);
  return src.slice(from, src.indexOf(end, from + start.length));
}

function fakeReply() {
  return { statusCode: 200, payload: undefined, code(c) { this.statusCode = c; return this; }, send(p) { this.payload = p; return this; } };
}

function loadRoutes(file, db) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const handlers = {};
  const context = {
    fastify: {
      post: (url, _o, h) => { handlers[`POST ${url}`] = h; },
      patch: (url, _o, h) => { handlers[`PATCH ${url}`] = h; },
      delete: (url, _o, h) => { handlers[`DELETE ${url}`] = h; },
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

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: pedido com cupom conta o uso; cupom esgotado recusa com 409`, async () => {
    const db = createDb({ coupon: { max_uses: 1 } });
    const routes = loadRoutes(file, db);
    const reply = fakeReply();
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: order(), query: {} }, reply);
    assert.equal(reply.statusCode, 201);
    assert.equal(db.state.coupons.get('c-1').uses_count, 1);

    const second = fakeReply();
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: order({ id: 'order-2' }), query: {} }, second);
    assert.equal(second.statusCode, 409);
    assert.equal(second.payload.code, 'coupon_limit');
    assert.equal(db.state.orders.has('order-2'), false);
  });

  test(`${file}: cupom e moedas no mesmo pedido; cancelar libera os dois`, async () => {
    const db = createDb();
    const routes = loadRoutes(file, db);
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: order({ coins_spent: 500, coins_discount: 500 }), query: {} }, fakeReply());
    assert.equal(db.state.coupons.get('c-1').uses_count, 1);
    assert.equal(db.state.balances.get('cust-1').balance, 500);
    await routes['PATCH /table-data/:name/:pkValue']({ params: { name: 'orders', pkValue: 'order-1' }, body: { status: 'cancelled' }, query: {} }, fakeReply());
    assert.equal(db.state.coupons.get('c-1').uses_count, 0);
    assert.equal(db.state.balances.get('cust-1').balance, 1000);
  });

  test(`${file}: excluir pedido (rollback do checkout) libera o cupom`, async () => {
    const db = createDb();
    const routes = loadRoutes(file, db);
    await routes['POST /table-data/:name']({ params: { name: 'orders' }, body: order(), query: {} }, fakeReply());
    await routes['DELETE /table-data/:name/:pkValue']({ params: { name: 'orders', pkValue: 'order-1' }, query: {} }, fakeReply());
    assert.equal(db.state.coupons.get('c-1').uses_count, 0);
  });
}
