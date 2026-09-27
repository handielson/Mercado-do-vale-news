'use strict';

const { randomUUID } = require('node:crypto');
const { readPrint3dPaymentCoverageOnConnection } = require('./print3dOrderPlan.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const quantity = value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) fail(409, 'Quantidade do pedido 3D inconsistente.');
  return number;
};

async function dispatchPrint3dOrder(pool, { orderId, actorId, trackingCode }) {
  const tracking = String(trackingCode || '').trim();
  if (!UUID.test(orderId || '') || !String(actorId || '').trim() || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(tracking)) {
    fail(400, 'Pedido, responsável ou código de rastreio inválido.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Payment, production, cancellation and dispatch serialize on the order.
    const [orders] = await connection.query('SELECT * FROM orders WHERE id=? LIMIT 1 FOR UPDATE', [orderId]);
    const order = orders[0];
    if (!order || order.storefront !== 'loja_3d' || order.customer_id || !order.print3d_customer_id) fail(404, 'Pedido 3D não encontrado.');
    const [previous] = await connection.query('SELECT * FROM print3d_order_dispatches WHERE order_id=?', [orderId]);
    if (previous[0]) {
      if (previous[0].tracking_code !== tracking) fail(409, 'Este pedido já foi expedido com outro rastreio.');
      await connection.commit();
      return { order_id:orderId,tracking_code:tracking,ready_quantity:quantity(previous[0].ready_quantity),
        produced_quantity:quantity(previous[0].produced_quantity),replayed:true };
    }
    if (['cancelled','shipped','delivered','completed'].includes(order.status) || ['refunded','failed','cancelled'].includes(order.payment_status)) {
      fail(409, 'Este pedido não pode ser expedido.');
    }
    const coverage = await readPrint3dPaymentCoverageOnConnection(connection, orderId);
    if (!coverage.fully_paid || coverage.outstanding_cents !== 0 || order.payment_status !== 'paid') {
      fail(409, 'Quite o valor integral dos produtos e do frete antes da expedição.');
    }
    const [items] = await connection.query('SELECT * FROM print3d_order_item_plans WHERE order_id=? ORDER BY order_item_id FOR UPDATE', [orderId]);
    if (!items.length) fail(409, 'Pedido sem itens 3D.');
    const expected = new Map();
    for (const item of items) {
      const ready = quantity(item.ready_quantity), preorder = quantity(item.preorder_quantity);
      if (!item.product_id || expected.has(item.product_id) || ready + preorder !== quantity(item.quantity) || !item.quantity) {
        fail(409, 'Plano de itens da encomenda inconsistente.');
      }
      expected.set(item.product_id, { ready,preorder,item_id:item.order_item_id });
    }
    const productIds = [...expected.keys()].sort();
    const [products] = await connection.query(`SELECT id FROM products WHERE id IN (${productIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,productIds);
    if (products.length !== productIds.length) fail(409, 'Produto do pedido não encontrado.');
    const [reservations] = await connection.query('SELECT * FROM print3d_order_stock_reservations WHERE order_id=? ORDER BY stock_location_id FOR UPDATE', [orderId]);
    const readyByProduct = new Map(productIds.map(id => [id,0]));
    for (const reservation of reservations) {
      if (!expected.has(reservation.product_id) || quantity(reservation.quantity_released) || quantity(reservation.quantity_consumed)) {
        fail(409, 'Reserva de estoque do pedido inconsistente.');
      }
      readyByProduct.set(reservation.product_id,readyByProduct.get(reservation.product_id)+quantity(reservation.quantity_reserved));
    }
    for (const id of productIds) if (readyByProduct.get(id) !== expected.get(id).ready) fail(409, 'Peças prontas reservadas não conferem com o pedido.');
    const [jobs] = await connection.query('SELECT * FROM print3d_production_jobs WHERE order_id=? ORDER BY order_item_id FOR UPDATE', [orderId]);
    const jobsByItem = new Map(jobs.map(job => [job.order_item_id,job]));
    if (jobsByItem.size !== jobs.length) fail(409, 'Ordens de produção duplicadas.');
    for (const item of items) {
      const job = jobsByItem.get(item.order_item_id), need = expected.get(item.product_id).preorder;
      if (need ? (!job || job.product_id !== item.product_id || job.status !== 'completed'
        || quantity(job.target_quantity) !== need || quantity(job.approved_quantity) !== need) : Boolean(job)) {
        fail(409, 'A produção ainda não concluiu todas as peças do pedido.');
      }
    }
    const [outputs] = await connection.query('SELECT * FROM print3d_production_outputs WHERE order_id=? ORDER BY id FOR UPDATE', [orderId]);
    const producedByProduct = new Map(productIds.map(id => [id,0]));
    for (const output of outputs) {
      const item = expected.get(output.product_id), job = jobsByItem.get(output.order_item_id);
      if (!item || !job || job.id !== output.job_id || item.item_id !== output.order_item_id || output.status !== 'reserved_for_order') {
        fail(409, 'Peças produzidas não estão integralmente reservadas a este pedido.');
      }
      producedByProduct.set(output.product_id,producedByProduct.get(output.product_id)+quantity(output.quantity));
    }
    for (const id of productIds) if (producedByProduct.get(id) !== expected.get(id).preorder) fail(409, 'Peças produzidas não conferem com o pedido.');
    for (const reservation of reservations) {
      const units = quantity(reservation.quantity_reserved);
      if (!units) fail(409, 'Reserva vazia no pedido.');
      const [locations] = await connection.query('SELECT * FROM product_stock_locations WHERE id=? LIMIT 1 FOR UPDATE', [reservation.stock_location_id]);
      const location = locations[0];
      if (!location || location.product_id !== reservation.product_id || (location.company_id && location.company_id !== order.company_id)
        || quantity(location.quantity) < units || quantity(location.reserved_quantity) < units) fail(409, 'Saldo físico reservado insuficiente para expedir.');
      const [updated] = await connection.query(`UPDATE product_stock_locations
        SET quantity=quantity-?,reserved_quantity=reserved_quantity-?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND quantity>=? AND reserved_quantity>=?`,[units,units,location.id,units,units]);
      if (Number(updated.affectedRows) !== 1) fail(409, 'Estoque mudou durante a expedição.');
      await connection.query(`INSERT INTO stock_location_movements
        (id,company_id,product_id,from_deposit_id,from_location_id,quantity,movement_type,reason,reference_type,reference_id,previous_from_quantity,new_from_quantity,notes,created_by)
        VALUES (?,?,?,?,?,?,'sale','Expedição loja 3D','print3d_order_dispatch',?,?,?,?,?)`,
        [randomUUID(),location.company_id || order.company_id,reservation.product_id,reservation.deposit_id,reservation.location_id,units,
          orderId,quantity(location.quantity),quantity(location.quantity)-units,tracking,String(actorId)]);
      const [consumed] = await connection.query(`UPDATE print3d_order_stock_reservations
        SET quantity_consumed=quantity_consumed+? WHERE order_id=? AND stock_location_id=?
        AND quantity_reserved=quantity_released+quantity_consumed+?`,[units,orderId,location.id,units]);
      if (Number(consumed.affectedRows) !== 1) fail(409, 'Reserva mudou durante a expedição.');
    }
    if (outputs.length) {
      const [changed] = await connection.query("UPDATE print3d_production_outputs SET status='dispatched' WHERE order_id=? AND status='reserved_for_order'",[orderId]);
      if (Number(changed.affectedRows) !== outputs.length) fail(409, 'Peças produzidas mudaram durante a expedição.');
    }
    for (const id of productIds) {
      const [[balance]] = await connection.query('SELECT COALESCE(SUM(quantity),0) AS quantity FROM product_stock_locations WHERE product_id=?',[id]);
      await connection.query('UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[quantity(balance.quantity),id]);
    }
    const readyTotal = [...readyByProduct.values()].reduce((sum,value) => sum+value,0);
    const producedTotal = [...producedByProduct.values()].reduce((sum,value) => sum+value,0);
    await connection.query(`INSERT INTO print3d_order_dispatches
      (order_id,tracking_code,actor_id,ready_quantity,produced_quantity) VALUES (?,?,?,?,?)`,
      [orderId,tracking,String(actorId),readyTotal,producedTotal]);
    await connection.query("UPDATE orders SET status='shipped',updated_at=CURRENT_TIMESTAMP WHERE id=?",[orderId]);
    await connection.commit();
    return { order_id:orderId,tracking_code:tracking,ready_quantity:readyTotal,produced_quantity:producedTotal,replayed:false };
  } catch (error) { try { await connection.rollback(); } catch {} throw error; }
  finally { connection.release(); }
}

module.exports = { dispatchPrint3dOrder };
