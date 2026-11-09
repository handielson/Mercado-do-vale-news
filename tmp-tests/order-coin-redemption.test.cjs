'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CoinRedemptionError,
  hasCoinRedemption,
  validateCoinRedemption,
  debitCoinsForOrder,
  refundCoinsForOrder,
} = require('../services/orderCoinRedemption.cjs');

const SETTINGS = { active: 1, coins_to_brl_rate: 100, max_redeem_percent: 20, min_coins_to_redeem: 100 };

function order(overrides = {}) {
  return { id: 'order-1', customer_id: 'cust-1', subtotal: 100000, coins_spent: 500, coins_discount: 500, ...overrides };
}

// Banco em memória com só o que o módulo usa: cashback_settings, coin_balances e coin_transactions.
function fakeDb({ balance = 1000, settings = SETTINGS } = {}) {
  const state = {
    settings,
    balances: new Map(balance == null ? [] : [['cust-1', { customer_id: 'cust-1', balance, lifetime_earned: balance, lifetime_spent: 0 }]]),
    transactions: [],
  };
  const connection = {
    async query(sql, params = []) {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('SELECT * FROM cashback_settings')) return [[state.settings].filter(Boolean)];
      if (s.startsWith('SELECT id FROM orders')) return [[{ id: params[0] }]];
      if (s.startsWith('SELECT * FROM coin_balances')) {
        const row = state.balances.get(params[0]);
        return [[row ? { ...row } : undefined].filter(Boolean)];
      }
      if (s.startsWith('UPDATE coin_balances SET balance = balance -')) {
        const [coins, , customerId, minimum] = params;
        const row = state.balances.get(customerId);
        if (!row || row.balance < minimum) return [{ affectedRows: 0 }];
        row.balance -= coins;
        row.lifetime_spent += coins;
        return [{ affectedRows: 1 }];
      }
      if (s.startsWith('INSERT INTO coin_balances')) {
        const [, customerId, coins] = params;
        const row = state.balances.get(customerId) || { customer_id: customerId, balance: 0, lifetime_earned: 0, lifetime_spent: 0 };
        row.balance += coins;
        row.lifetime_spent = Math.max(0, row.lifetime_spent - coins);
        state.balances.set(customerId, row);
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
          if (t.reference_id !== params[0] || t.reference_type !== 'order' || t.status !== 'completed') continue;
          if (!['spend_discount', 'refund_cancel'].includes(t.type)) continue;
          const key = `${t.customer_id}|${t.type}`;
          sums.set(key, (sums.get(key) || 0) + t.amount);
        }
        return [[...sums].map(([key, total]) => { const [customer_id, type] = key.split('|'); return { customer_id, type, total }; })];
      }
      throw new Error(`SQL não previsto no teste: ${s}`);
    },
  };
  return { state, connection };
}

test('pedido sem moedas não exige resgate', () => {
  assert.equal(hasCoinRedemption({ coins_spent: 0, coins_discount: 0 }), false);
  assert.equal(hasCoinRedemption({}), false);
  assert.equal(hasCoinRedemption({ coins_spent: 500 }), true);
  assert.equal(hasCoinRedemption({ coins_discount: 500 }), true);
});

test('resgate válido debita o saldo e grava a movimentação de resgate', async () => {
  const { state, connection } = fakeDb({ balance: 1000 });
  const result = await debitCoinsForOrder(connection, order());
  assert.deepEqual(result, { coins: 500, discountCents: 500 });
  assert.equal(state.balances.get('cust-1').balance, 500);
  assert.equal(state.balances.get('cust-1').lifetime_spent, 500);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, 'spend_discount');
  assert.equal(state.transactions[0].amount, -500);
  assert.equal(state.transactions[0].reference_id, 'order-1');
});

test('pedido sem moedas não mexe no banco', async () => {
  const { state, connection } = fakeDb();
  assert.equal(await debitCoinsForOrder(connection, order({ coins_spent: 0, coins_discount: 0 })), null);
  assert.equal(state.transactions.length, 0);
});

test('recusa saldo insuficiente sem debitar', async () => {
  const { state, connection } = fakeDb({ balance: 300 });
  await assert.rejects(debitCoinsForOrder(connection, order()), (error) => error instanceof CoinRedemptionError && error.code === 'insufficient_balance');
  assert.equal(state.balances.get('cust-1').balance, 300);
  assert.equal(state.transactions.length, 0);
});

test('recusa cliente sem saldo cadastrado', async () => {
  const { connection } = fakeDb({ balance: null });
  await assert.rejects(debitCoinsForOrder(connection, order()), { code: 'below_minimum' });
});

test('recusa desconto maior que o valor das moedas', () => {
  assert.throws(() => validateCoinRedemption({ order: order({ coins_discount: 900 }), balance: { balance: 1000 }, settings: SETTINGS }), { code: 'discount_above_coins' });
});

test('aceita diferença de 1 centavo de arredondamento do navegador', () => {
  const result = validateCoinRedemption({ order: order({ coins_spent: 333, coins_discount: 334 }), balance: { balance: 1000 }, settings: SETTINGS });
  assert.equal(result.discountCents, 334);
});

test('recusa desconto acima do limite percentual do pedido', () => {
  // 20% de R$ 10,00 = R$ 2,00; 500 moedas valem R$ 5,00
  assert.throws(() => validateCoinRedemption({ order: order({ subtotal: 1000 }), balance: { balance: 1000 }, settings: SETTINGS }), { code: 'discount_above_limit' });
});

test('recusa desconto em moedas sem moedas informadas', () => {
  assert.throws(() => validateCoinRedemption({ order: order({ coins_spent: 0, coins_discount: 500 }), balance: { balance: 1000 }, settings: SETTINGS }), { code: 'discount_without_coins' });
});

test('recusa quando o programa de moedas está inativo', () => {
  assert.throws(() => validateCoinRedemption({ order: order(), balance: { balance: 1000 }, settings: { ...SETTINGS, active: 0 } }), { code: 'cashback_inactive' });
});

test('recusa pedido sem cliente', () => {
  assert.throws(() => validateCoinRedemption({ order: order({ customer_id: null }), balance: { balance: 1000 }, settings: SETTINGS }), { code: 'missing_customer' });
});

test('recusa saldo abaixo do mínimo para resgate', () => {
  assert.throws(() => validateCoinRedemption({ order: order({ coins_spent: 50, coins_discount: 50 }), balance: { balance: 80 }, settings: SETTINGS }), { code: 'below_minimum' });
});

test('recusa quantidade de moedas fracionada ou negativa', () => {
  assert.throws(() => validateCoinRedemption({ order: order({ coins_spent: 10.5 }), balance: { balance: 1000 }, settings: SETTINGS }), { code: 'invalid_coins' });
  assert.throws(() => validateCoinRedemption({ order: order({ coins_spent: -5 }), balance: { balance: 1000 }, settings: SETTINGS }), { code: 'invalid_coins' });
});

test('cancelamento devolve as moedas uma única vez', async () => {
  const { state, connection } = fakeDb({ balance: 1000 });
  await debitCoinsForOrder(connection, order());
  assert.equal(state.balances.get('cust-1').balance, 500);

  assert.equal(await refundCoinsForOrder(connection, 'order-1'), 500);
  assert.equal(state.balances.get('cust-1').balance, 1000);
  assert.equal(state.balances.get('cust-1').lifetime_spent, 0);
  const refund = state.transactions.find((t) => t.type === 'refund_cancel');
  assert.equal(refund.amount, 500);

  assert.equal(await refundCoinsForOrder(connection, 'order-1'), 0);
  assert.equal(state.balances.get('cust-1').balance, 1000);
  assert.equal(state.transactions.filter((t) => t.type === 'refund_cancel').length, 1);
});

test('cancelar pedido sem moedas não gera estorno', async () => {
  const { state, connection } = fakeDb();
  assert.equal(await refundCoinsForOrder(connection, 'order-sem-moedas'), 0);
  assert.equal(state.transactions.length, 0);
});
