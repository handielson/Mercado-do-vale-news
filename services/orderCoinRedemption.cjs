'use strict';

// Resgate de Moedas do Vale em pedidos online.
// O pedido chega do navegador com coins_spent (moedas) e coins_discount (centavos).
// O servidor confere as regras do programa, debita o saldo na mesma transação em que
// grava o pedido e devolve as moedas uma única vez se o pedido for cancelado ou excluído.

const crypto = require('node:crypto');

class CoinRedemptionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CoinRedemptionError';
    this.code = code;
    this.statusCode = 409;
  }
}

function fail(code, message) {
  throw new CoinRedemptionError(code, message);
}

function hasCoinRedemption(order) {
  return Number(order?.coins_spent || 0) !== 0 || Number(order?.coins_discount || 0) !== 0;
}

function isActive(value) {
  return value === 1 || value === true || value === '1';
}

function formatBrl(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// Regras espelhadas de validateCoinRedeem (services/cashbackService.ts), com tolerância
// de 1 centavo para o arredondamento feito no navegador.
function validateCoinRedemption({ order, balance, settings }) {
  const coins = Number(order?.coins_spent || 0);
  const discountCents = Number(order?.coins_discount || 0);
  if (!Number.isInteger(coins) || coins < 0) fail('invalid_coins', 'Quantidade de moedas inválida.');
  if (!Number.isInteger(discountCents) || discountCents < 0) fail('invalid_discount', 'Desconto em moedas inválido.');
  if (coins === 0 && discountCents > 0) fail('discount_without_coins', 'Desconto em moedas sem moedas informadas.');
  if (coins === 0) return { coins: 0, discountCents: 0 };

  if (!order?.customer_id) fail('missing_customer', 'O resgate de moedas exige cliente identificado.');
  if (!settings || !isActive(settings.active)) fail('cashback_inactive', 'O programa de moedas está inativo.');
  const rate = Number(settings.coins_to_brl_rate);
  if (!(rate > 0)) fail('invalid_rate', 'Taxa de conversão de moedas não configurada.');

  const available = Number(balance?.balance || 0);
  const minimum = Number(settings.min_coins_to_redeem || 0);
  if (available < minimum) fail('below_minimum', `Saldo mínimo para resgate: ${minimum} moedas.`);
  if (coins > available) fail('insufficient_balance', 'Saldo de moedas insuficiente.');

  const coinValueCents = Math.round((coins / rate) * 100);
  if (discountCents > coinValueCents + 1) fail('discount_above_coins', 'Desconto maior que o valor das moedas usadas.');

  const percent = Number(settings.max_redeem_percent || 0);
  const capCents = Math.round((Number(order.subtotal || 0) * percent) / 100);
  if (discountCents > capCents + 1) fail('discount_above_limit', `Desconto em moedas acima do limite de ${percent}% do pedido.`);

  return { coins, discountCents };
}

// Deve rodar dentro da transação que insere o pedido (connection com beginTransaction).
async function debitCoinsForOrder(connection, order) {
  if (!hasCoinRedemption(order)) return null;
  const [settingsRows] = await connection.query('SELECT * FROM cashback_settings ORDER BY updated_at DESC LIMIT 1');
  let balance = null;
  if (order.customer_id) {
    const [balanceRows] = await connection.query('SELECT * FROM coin_balances WHERE customer_id = ? LIMIT 1 FOR UPDATE', [order.customer_id]);
    balance = balanceRows?.[0] || null;
  }
  const result = validateCoinRedemption({ order, balance, settings: settingsRows?.[0] || null });
  if (!result.coins) return null;

  const [update] = await connection.query(
    `UPDATE coin_balances SET balance = balance - ?, lifetime_spent = lifetime_spent + ?, updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND balance >= ?`,
    [result.coins, result.coins, order.customer_id, result.coins]
  );
  if (!update?.affectedRows) fail('insufficient_balance', 'Saldo de moedas insuficiente.');

  await connection.query(
    `INSERT INTO coin_transactions (id, customer_id, amount, type, status, description, reference_id, reference_type)
     VALUES (?, ?, ?, ?, 'completed', ?, ?, 'order')`,
    [crypto.randomUUID(), order.customer_id, -result.coins, 'spend_discount', `Desconto no pedido - R$ ${formatBrl(result.discountCents)}`, order.id]
  );
  return result;
}

// Idempotente: devolve só o que foi debitado e ainda não estornado para este pedido.
// Deve rodar dentro de uma transação; trava o pedido para evitar estorno duplo em paralelo.
async function refundCoinsForOrder(connection, orderId) {
  if (!orderId) return 0;
  await connection.query('SELECT id FROM orders WHERE id = ? LIMIT 1 FOR UPDATE', [orderId]);
  const [rows] = await connection.query(
    `SELECT customer_id, type, SUM(amount) AS total FROM coin_transactions
      WHERE reference_id = ? AND reference_type = 'order' AND status = 'completed'
        AND type IN ('spend_discount', 'refund_cancel')
      GROUP BY customer_id, type`,
    [orderId]
  );
  const owedByCustomer = new Map();
  for (const row of rows || []) {
    // spend_discount soma negativo e refund_cancel soma positivo: o que falta devolver é -(spend + refund).
    const current = owedByCustomer.get(row.customer_id) || 0;
    owedByCustomer.set(row.customer_id, current - Number(row.total || 0));
  }

  let refunded = 0;
  for (const [customerId, owed] of owedByCustomer) {
    if (!(owed > 0)) continue;
    await connection.query('SELECT * FROM coin_balances WHERE customer_id = ? LIMIT 1 FOR UPDATE', [customerId]);
    await connection.query(
      `INSERT INTO coin_balances (id, customer_id, balance, lifetime_earned, lifetime_spent)
       VALUES (?, ?, ?, 0, 0)
       ON DUPLICATE KEY UPDATE
         balance = balance + VALUES(balance),
         lifetime_spent = GREATEST(lifetime_spent - VALUES(balance), 0),
         updated_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), customerId, owed]
    );
    await connection.query(
      `INSERT INTO coin_transactions (id, customer_id, amount, type, status, description, reference_id, reference_type)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, 'order')`,
      [crypto.randomUUID(), customerId, owed, 'refund_cancel', 'Estorno de moedas do pedido cancelado', orderId]
    );
    refunded += owed;
  }
  return refunded;
}

module.exports = {
  CoinRedemptionError,
  hasCoinRedemption,
  validateCoinRedemption,
  debitCoinsForOrder,
  refundCoinsForOrder,
};
