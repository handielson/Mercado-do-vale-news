'use strict';

// 3D checkout reservations are held in product_stock_locations.  This module is
// deliberately separate from the legacy order release endpoint: a 3D order has
// an immutable reservation ledger and may never be released by a generic CRUD
// update to orders.status.
const { randomUUID } = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE_CHARGE_STATUSES = new Set(['creating','pending','in_process']);

function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function validOrderId(value) { return UUID.test(value || ''); }
function cancelReason(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 500 || /[\x00-\x1f]/.test(text)) fail(400, 'Motivo de cancelamento inválido.');
  return text;
}
function chargeExpired(charge, now) {
  if (!ACTIVE_CHARGE_STATUSES.has(String(charge.status || ''))) return false;
  const timestamp = Date.parse(String(charge.expires_at || ''));
  return Number.isFinite(timestamp) && timestamp <= now.valueOf();
}
async function transaction(pool, callback) {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await callback(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
async function lockPrint3dOrder(connection, orderId) {
  if (!validOrderId(orderId)) fail(404, 'Pedido 3D não encontrado.');
  const [rows] = await connection.query('SELECT * FROM orders WHERE id=? LIMIT 1 FOR UPDATE', [orderId]);
  const order = rows[0];
  if (!order || order.storefront !== 'loja_3d' || order.customer_id || !order.print3d_customer_id) fail(404, 'Pedido 3D não encontrado.');
  return order;
}
async function releaseReservationsOnConnection(connection, { order, reason, notes }) {
  const [reservations] = await connection.query(
    'SELECT * FROM print3d_order_stock_reservations WHERE order_id=? ORDER BY stock_location_id FOR UPDATE', [order.id]
  );
  const released = [];
  for (const reservation of reservations) {
    const releasable = Number(reservation.quantity_reserved) - Number(reservation.quantity_released) - Number(reservation.quantity_consumed);
    if (!Number.isSafeInteger(releasable) || releasable < 0) fail(409, 'Reserva 3D inconsistente.');
    if (!releasable) continue;
    const [locations] = await connection.query('SELECT * FROM product_stock_locations WHERE id=? LIMIT 1 FOR UPDATE', [reservation.stock_location_id]);
    const location = locations[0];
    if (!location || location.product_id !== reservation.product_id || Number(location.reserved_quantity) < releasable) {
      fail(409, 'Reserva de estoque 3D inconsistente.');
    }
    const previousReserved = Number(location.reserved_quantity);
    const previousQuantity = Number(location.quantity);
    const [updated] = await connection.query(
      'UPDATE product_stock_locations SET reserved_quantity=reserved_quantity-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND reserved_quantity>=?',
      [releasable, location.id, releasable]
    );
    if (Number(updated.affectedRows) !== 1) fail(409, 'Conflito ao liberar a reserva 3D.');
    await connection.query(
      `INSERT INTO stock_location_movements
        (id,company_id,product_id,from_deposit_id,from_location_id,quantity,movement_type,reason,reference_type,reference_id,previous_from_quantity,new_from_quantity,notes)
       VALUES (?,?,?,?,?,?, 'release_reservation', ?, 'print3d_order_release', ?, ?, ?, ?)`,
      [randomUUID(), location.company_id || order.company_id, reservation.product_id, reservation.deposit_id, reservation.location_id,
        releasable, reason, order.id, previousQuantity, previousQuantity, notes]
    );
    await connection.query(
      'UPDATE print3d_order_stock_reservations SET quantity_released=quantity_released+? WHERE order_id=? AND stock_location_id=?',
      [releasable, order.id, reservation.stock_location_id]
    );
    released.push({ stock_location_id:reservation.stock_location_id, product_id:reservation.product_id, quantity:releasable,
      previous_reserved_quantity:previousReserved, new_reserved_quantity:previousReserved - releasable });
  }
  return released;
}
async function cancelPrint3dOrderOnConnection(connection, { orderId, actorType, actorId, reason, now = new Date(), requireExpired = false }) {
  const order = await lockPrint3dOrder(connection, orderId);
  const normalizedReason = cancelReason(reason);
  if (actorType === 'customer' && order.print3d_customer_id !== actorId) fail(404, 'Pedido 3D não encontrado.');
  if (!['customer','admin','system'].includes(actorType) || !String(actorId || '').trim()) fail(400, 'Responsável pelo cancelamento inválido.');
  if (order.status === 'cancelled') return { order_id:order.id, cancelled:true, already_cancelled:true, released:[] };
  const [[coverage]] = await connection.query(
    "SELECT COALESCE(SUM(amount_cents),0) AS confirmed_cents FROM print3d_order_payment_receipts WHERE order_id=? AND status='confirmed' FOR UPDATE", [order.id]
  );
  if (Number(coverage.confirmed_cents) > 0 || ['paid','approved','refunded'].includes(order.payment_status)) {
    fail(409, 'Pedido com pagamento confirmado exige análise de estorno.');
  }
  const [jobs] = await connection.query('SELECT id,status FROM print3d_production_jobs WHERE order_id=? FOR UPDATE', [order.id]);
  if (jobs.some(job => !['awaiting_payment','cancelled'].includes(job.status))) fail(409, 'Produção já iniciada; o cancelamento exige análise manual.');
  const [charges] = await connection.query('SELECT id,status,expires_at FROM print3d_payment_charges WHERE order_id=? ORDER BY created_at,id FOR UPDATE', [order.id]);
  if (charges.some(charge => charge.status === 'approved')) fail(409, 'Cobrança aprovada exige análise de estorno.');
  if (requireExpired && !charges.some(charge => chargeExpired(charge, now))) return { order_id:order.id, cancelled:false, skipped:'not_expired' };
  const released = await releaseReservationsOnConnection(connection, { order, reason:normalizedReason, notes:`Cancelamento 3D (${actorType}): ${normalizedReason}` });
  await connection.query("UPDATE print3d_payment_charges SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status IN ('creating','pending','in_process')", [order.id]);
  await connection.query("UPDATE print3d_production_jobs SET status='cancelled' WHERE order_id=? AND status='awaiting_payment'", [order.id]);
  await connection.query("UPDATE orders SET status='cancelled',payment_status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?", [order.id]);
  await connection.query(
    'INSERT INTO print3d_order_cancellation_events (id,order_id,event_type,actor_type,actor_id,reason,details_json) VALUES (?,?,?,?,?,?,?)',
    [randomUUID(), order.id, requireExpired ? 'expired' : 'cancelled', actorType, String(actorId), normalizedReason,
      JSON.stringify({ released_reservations:released.length, expired_at:requireExpired ? now.toISOString() : null })]
  );
  return { order_id:order.id, cancelled:true, already_cancelled:false, released };
}
async function cancelPrint3dOrder(pool, input) {
  return transaction(pool, connection => cancelPrint3dOrderOnConnection(connection, input));
}
async function expireDuePrint3dOrders(pool, { now = new Date(), limit = 100 } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) fail(400, 'Data de expiração inválida.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail(400, 'Limite de expiração inválido.');
  const result = { scanned:0, expired:0, skipped:0, order_ids:[] };
  const review = [];
  let cursor = '';
  const pageSize = Math.min(limit,100);
  while (result.expired < limit) {
    // Stable keyset pagination: cancelled candidates disappear from the result,
    // so OFFSET would skip later orders. Future/review candidates must not pin
    // every execution to the same first page.
    const [candidates] = await pool.query(
      "SELECT order_id FROM print3d_payment_charges WHERE status IN ('creating','pending','in_process') AND expires_at IS NOT NULL AND order_id>? GROUP BY order_id ORDER BY order_id ASC LIMIT ?",
      [cursor,pageSize]
    );
    if (!candidates.length) break;
    for (const candidate of candidates) {
      cursor = candidate.order_id;
      result.scanned++;
      try {
        const outcome = await cancelPrint3dOrder(pool, { orderId:candidate.order_id, actorType:'system', actorId:'print3d-expiry',
          reason:'Cobrança PIX expirada sem confirmação de pagamento.', now, requireExpired:true });
        if (outcome.cancelled && !outcome.already_cancelled) { result.expired++; result.order_ids.push(candidate.order_id); }
        else result.skipped++;
      } catch (error) {
        if (![404,409].includes(error.statusCode)) throw error;
        result.skipped++;
        review.push(candidate.order_id);
      }
      if (result.expired >= limit) break;
    }
    if (candidates.length < pageSize) break;
  }
  if (review.length) result.review_order_ids = review;
  return result;
}
// A gateway confirmation after local cancellation must be auditable but may not
// create a receipt, revive the order or release production.
async function recordLatePrint3dPaymentOnConnection(connection, { orderId, chargeId, providerPaymentId, amountCents, occurredAt }) {
  const timestamp = occurredAt instanceof Date && Number.isFinite(occurredAt.valueOf()) ? occurredAt.toISOString() : new Date().toISOString();
  await connection.query(
    `INSERT INTO print3d_order_cancellation_events
      (id,order_id,event_type,actor_type,actor_id,provider_payment_id,reason,details_json)
     VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`,
    [randomUUID(), orderId, 'late_payment', 'gateway', String(providerPaymentId), String(providerPaymentId),
      'Pagamento confirmado após cancelamento; revisão e estorno necessários.',
      JSON.stringify({ charge_id:chargeId,provider_payment_id:String(providerPaymentId),amount_cents:Number(amountCents),occurred_at:timestamp })]
  );
}
module.exports = { UUID, ACTIVE_CHARGE_STATUSES, chargeExpired, lockPrint3dOrder, releaseReservationsOnConnection,
  cancelPrint3dOrderOnConnection, cancelPrint3dOrder, expireDuePrint3dOrders, recordLatePrint3dPaymentOnConnection };
