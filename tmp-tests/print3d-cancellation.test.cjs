'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { cancelPrint3dOrder, cancelPrint3dOrderOnConnection, expireDuePrint3dOrders } = require('../services/print3dCancellation.cjs');
const { settlePayment } = require('../services/print3dPayments.cjs');

const ORDER='11111111-1111-4111-8111-111111111111';
const PRODUCT='22222222-2222-4222-8222-222222222222';
const LOCATION='33333333-3333-4333-8333-333333333333';
const CHARGE='44444444-4444-4444-8444-444444444444';
function fixture({ paymentStatus='pending', chargeStatus='pending', expiresAt='2026-09-27T12:00:00.000Z', receipts=0 } = {}) {
  const state = {
    order:{ id:ORDER, storefront:'loja_3d', customer_id:null, print3d_customer_id:'customer-3d', company_id:'company', status:'awaiting_payment', payment_status:paymentStatus },
    charges:[{ id:CHARGE, order_id:ORDER, stage:'initial', amount_cents:500, status:chargeStatus, expires_at:expiresAt }],
    reservations:[{ order_id:ORDER, product_id:PRODUCT, stock_location_id:LOCATION, deposit_id:'deposit', location_id:'place', quantity_reserved:2, quantity_released:0, quantity_consumed:0 }],
    location:{ id:LOCATION, company_id:'company', product_id:PRODUCT, quantity:10, reserved_quantity:2 },
    jobs:[{ id:'job', order_id:ORDER, status:'awaiting_payment' }], receipts, movements:[], events:[], commits:0, rollbacks:0,
  };
  const connection = { async beginTransaction(){}, async commit(){ state.commits++; }, async rollback(){ state.rollbacks++; }, release(){},
    async query(sql,args=[]) {
      if (sql.startsWith('SELECT * FROM orders')) return [[state.order]];
      if (sql.startsWith('SELECT COALESCE(SUM(amount_cents)')) return [[{ confirmed_cents:state.receipts }]];
      if (sql.startsWith('SELECT id,status FROM print3d_production_jobs')) return [state.jobs];
      if (sql.startsWith('SELECT id,status,expires_at FROM print3d_payment_charges')) return [state.charges];
      if (sql.startsWith('SELECT * FROM print3d_order_stock_reservations')) return [state.reservations];
      if (sql.startsWith('SELECT * FROM product_stock_locations')) return [[state.location]];
      if (sql.startsWith('UPDATE product_stock_locations')) { state.location.reserved_quantity -= args[0]; return [{ affectedRows:1 }]; }
      if (sql.startsWith('INSERT INTO stock_location_movements')) { state.movements.push({ quantity:args[5], reason:args[6], reference_id:args[7] }); return [{}]; }
      if (sql.startsWith('UPDATE print3d_order_stock_reservations')) { state.reservations[0].quantity_released += args[0]; return [{}]; }
      if (sql.startsWith("UPDATE print3d_payment_charges SET status='cancelled'")) { state.charges.forEach(row=>{ if (row.order_id===args[0] && ['creating','pending','in_process'].includes(row.status)) row.status='cancelled'; }); return [{}]; }
      if (sql.startsWith("UPDATE print3d_production_jobs SET status='cancelled'")) { state.jobs.forEach(job=>{ if (job.order_id===args[0] && job.status==='awaiting_payment') job.status='cancelled'; }); return [{}]; }
      if (sql.startsWith("UPDATE orders SET status='cancelled'")) { state.order.status='cancelled'; state.order.payment_status='cancelled'; return [{}]; }
      if (sql.startsWith('INSERT INTO print3d_order_cancellation_events')) { state.events.push({ event_type:args[2], actor_type:args[3], actor_id:args[4], reason:args[5], details:JSON.parse(args[6]) }); return [{}]; }
      throw new Error('SQL inesperado: '+sql);
    },
  };
  const pool = { async getConnection(){ return connection; }, async query(sql,args=[]) {
    if (sql.startsWith('SELECT order_id FROM print3d_payment_charges')) return [state.charges.filter(row=>['creating','pending','in_process'].includes(row.status) && row.expires_at && row.order_id>args[0]).slice(0,args[1]).map(row=>({order_id:row.order_id}))];
    return connection.query(sql,args);
  } };
  return { state, connection, pool };
}
test('cancelamento 3D libera cada reserva uma vez, cancela cobrança e não mistura estoque MDV', async () => {
  const { state, pool } = fixture();
  const first = await cancelPrint3dOrder(pool,{orderId:ORDER,actorType:'customer',actorId:'customer-3d',reason:'Cliente desistiu antes do pagamento.'});
  assert.equal(first.released[0].quantity,2);
  assert.equal(state.location.reserved_quantity,0);
  assert.equal(state.reservations[0].quantity_released,2);
  assert.equal(state.movements.length,1);
  assert.equal(state.movements[0].reference_id,ORDER);
  assert.equal(state.order.status,'cancelled'); assert.equal(state.order.payment_status,'cancelled');
  assert.equal(state.charges[0].status,'cancelled'); assert.equal(state.jobs[0].status,'cancelled');
  const second = await cancelPrint3dOrder(pool,{orderId:ORDER,actorType:'customer',actorId:'customer-3d',reason:'Repetição segura.'});
  assert.equal(second.already_cancelled,true); assert.equal(state.movements.length,1); assert.equal(state.location.reserved_quantity,0);
});
test('cancelamento recusa pedido pago ou produção iniciada sem liberar estoque', async () => {
  const paid = fixture({receipts:500});
  await assert.rejects(cancelPrint3dOrder(paid.pool,{orderId:ORDER,actorType:'admin',actorId:'admin',reason:'Teste pago.'}),/estorno/);
  assert.equal(paid.state.location.reserved_quantity,2);
  const started = fixture(); started.state.jobs[0].status='in_progress';
  await assert.rejects(cancelPrint3dOrder(started.pool,{orderId:ORDER,actorType:'admin',actorId:'admin',reason:'Teste produção.'}),/Produção/);
  assert.equal(started.state.location.reserved_quantity,2);
});
test('expiração processa somente PIX vencido e também libera a reserva de modo rastreável', async () => {
  const { state, pool } = fixture({expiresAt:'2026-09-27T11:59:59.000Z'});
  const result = await expireDuePrint3dOrders(pool,{now:new Date('2026-09-27T12:00:00.000Z')});
  assert.deepEqual(result,{scanned:1,expired:1,skipped:0,order_ids:[ORDER]});
  assert.equal(state.events[0].event_type,'expired'); assert.equal(state.location.reserved_quantity,0);
  const future = fixture({expiresAt:'2026-09-27T12:00:01.000Z'});
  const outcome = await cancelPrint3dOrderOnConnection(future.connection,{orderId:ORDER,actorType:'system',actorId:'expiry',reason:'Expiração.',requireExpired:true,now:new Date('2026-09-27T12:00:00.000Z')});
  assert.equal(outcome.skipped,'not_expired'); assert.equal(future.state.location.reserved_quantity,2);
});
test('pagamento tardio fica em revisão e nunca recria recibo, produção ou pedido cancelado', async () => {
  const { state } = fixture(); state.order.status='cancelled'; state.order.payment_status='cancelled'; state.charges[0].status='cancelled';
  const connection = { async beginTransaction(){}, async commit(){}, async rollback(){}, release(){}, async query(sql,args=[]) {
    if (sql.startsWith('SELECT order_id FROM print3d_payment_charges')) return [[{order_id:ORDER}]];
    if (sql.startsWith('SELECT * FROM orders')) return [[state.order]];
    if (sql.startsWith('SELECT * FROM print3d_payment_charges')) return [[state.charges[0]]];
    if (sql.startsWith('INSERT INTO print3d_order_cancellation_events')) { state.events.push({event_type:args[2]}); return [{}]; }
    if (sql.startsWith("UPDATE print3d_payment_charges SET status='late_payment'")) { state.charges[0].status='late_payment'; return [{}]; }
    throw new Error('SQL tardio inesperado: '+sql);
  } };
  const payment={id:123,collector_id:456,currency_id:'BRL',payment_method_id:'pix',external_reference:`print3d:${CHARGE}`,transaction_amount:5,status:'approved',date_approved:'2026-09-27T12:00:00Z'};
  const result=await settlePayment({getConnection:async()=>connection},{payment,chargeId:CHARGE,collectorId:'456'});
  assert.equal(result.late_payment,true); assert.equal(result.review_required,true);
  assert.equal(state.order.status,'cancelled'); assert.equal(state.charges[0].status,'late_payment'); assert.deepEqual(state.events,[{event_type:'late_payment'}]);
});
