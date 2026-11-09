'use strict';

// order-coupon-redemption-v1: o uso de cupom passa a ser contado no servidor, uma vez por
// pedido, na mesma transação que grava o pedido. Cancelar ou excluir o pedido libera o uso.
// Antes, o navegador chamava /coupons/:code/use com o ID do cupom e o contador nunca subia.

const { couponAllowanceCents, couponMatchesCustomer } = require('./orderTotalGuard.cjs');

class CouponRedemptionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CouponRedemptionError';
    this.code = code;
    this.statusCode = 409;
  }
}

function fail(code, message) {
  throw new CouponRedemptionError(code, message);
}

function hasCouponRedemption(order) {
  // Só há o que proteger quando o cupom gera desconto; código sem desconto não conta uso.
  return Number(order?.coupon_discount || 0) > 0;
}

let tableReady = null;
// CREATE TABLE faz commit implícito no MySQL: chamar FORA da transação.
function ensureCouponRedemptionTable(pool) {
  if (!tableReady) {
    tableReady = pool.query(`CREATE TABLE IF NOT EXISTS coupon_redemptions (
      order_id CHAR(36) NOT NULL PRIMARY KEY,
      coupon_id CHAR(36) NOT NULL,
      code VARCHAR(80) NOT NULL,
      discount_cents INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      released_at TIMESTAMP NULL DEFAULT NULL,
      INDEX idx_coupon_redemptions_coupon (coupon_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch((error) => { tableReady = null; throw error; });
  }
  return tableReady;
}

function isActive(value) {
  return value === 1 || value === true || value === '1';
}

// Deve rodar dentro da transação que insere o pedido.
async function reserveCouponForOrder(connection, order) {
  const discount = Math.round(Number(order?.coupon_discount || 0));
  const code = String(order?.coupon_code || '').trim().toUpperCase();
  if (!(discount > 0)) return null;
  if (!code) fail('coupon_missing', 'Desconto de cupom sem código de cupom.');

  const [existing] = await connection.query('SELECT * FROM coupon_redemptions WHERE order_id = ? LIMIT 1 FOR UPDATE', [order.id]);
  if (existing?.[0]) return { coupon_id: existing[0].coupon_id, reused: true };

  const [coupons] = await connection.query('SELECT * FROM coupons WHERE code = ? LIMIT 1 FOR UPDATE', [code]);
  const coupon = coupons?.[0];
  if (!coupon || !isActive(coupon.active)) fail('coupon_invalid', 'Cupom inválido ou inativo.');
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) fail('coupon_expired', 'Este cupom está expirado.');
  if (coupon.max_uses != null && Number(coupon.uses_count || 0) >= Number(coupon.max_uses)) fail('coupon_limit', 'Este cupom atingiu o limite de usos.');

  let customerType = 'retail';
  if (order.customer_id) {
    const [customers] = await connection.query('SELECT customer_type FROM customers WHERE id = ? LIMIT 1', [order.customer_id]);
    customerType = customers?.[0]?.customer_type || 'retail';
  }
  if (!couponMatchesCustomer(coupon, customerType)) fail('coupon_customer_type', 'Cupom não disponível para o seu tipo de cliente.');

  const subtotal = Math.round(Number(order.subtotal || 0));
  if (subtotal < Math.round(Number(coupon.min_order || 0) * 100)) fail('coupon_min_order', 'O pedido não atinge o valor mínimo do cupom.');
  if (discount > couponAllowanceCents(coupon, subtotal) + 1) fail('coupon_above_allowed', 'O desconto do cupom não confere. Aplique o cupom novamente.');

  const [update] = await connection.query(
    'UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ? AND (max_uses IS NULL OR uses_count < max_uses)',
    [coupon.id]
  );
  if (!update?.affectedRows) fail('coupon_limit', 'Este cupom atingiu o limite de usos.');
  await connection.query(
    'INSERT INTO coupon_redemptions (order_id, coupon_id, code, discount_cents) VALUES (?, ?, ?, ?)',
    [order.id, coupon.id, code, discount]
  );
  return { coupon_id: coupon.id, reused: false };
}

// Idempotente: libera o uso só uma vez. Deve rodar dentro de uma transação.
async function releaseCouponForOrder(connection, orderId) {
  if (!orderId) return false;
  const [rows] = await connection.query('SELECT * FROM coupon_redemptions WHERE order_id = ? AND released_at IS NULL LIMIT 1 FOR UPDATE', [orderId]);
  const redemption = rows?.[0];
  if (!redemption) return false;
  await connection.query('UPDATE coupons SET uses_count = GREATEST(uses_count - 1, 0) WHERE id = ?', [redemption.coupon_id]);
  await connection.query('UPDATE coupon_redemptions SET released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);
  return true;
}

module.exports = {
  CouponRedemptionError,
  hasCouponRedemption,
  ensureCouponRedemptionTable,
  reserveCouponForOrder,
  releaseCouponForOrder,
};
