'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dispatchPrint3dOrder } = require('../services/print3dDispatch.cjs');
const ORDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const JOB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LOCATION = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const input = { orderId:ORDER,actorId:'admin-1',trackingCode:'BR123456789' };

function fakeStore({ paid = true, complete = true, stock = 3, failOutputs = false } = {}) {
  const state = {
    order:{id:ORDER,company_id:'company-1',storefront:'loja_3d',customer_id:null,print3d_customer_id:'customer-1',status:'awaiting_payment',payment_status:paid?'paid':'pending',subtotal:900,discount:0,shipping_cost:100,total:1000},
    plan:{order_id:ORDER,ready_amount_cents:400,preorder_amount_cents:500,subtotal_cents:900,deposit_amount_cents:450,
      due_on_confirmation_cents:450,due_before_shipping_cents:550,payment_terms_version:1,initial_payment_bps:5000,
      shipping_payment_mode:'later',shipping_initial_cents:0,minimum_initial_cents:450},
    receipts:paid?1000:450,
    item:{order_item_id:ITEM,order_id:ORDER,product_id:PRODUCT,quantity:3,ready_quantity:2,preorder_quantity:1},
    reservation:{order_id:ORDER,product_id:PRODUCT,stock_location_id:LOCATION,deposit_id:'dep',location_id:'loc',quantity_reserved:2,quantity_released:0,quantity_consumed:0},
    job:{id:JOB,order_item_id:ITEM,product_id:PRODUCT,status:complete?'completed':'in_progress',target_quantity:1,approved_quantity:complete?1:0},
    output:complete?{id:'output-1',order_item_id:ITEM,product_id:PRODUCT,job_id:JOB,quantity:1,status:'reserved_for_order'}:null,
    location:{id:LOCATION,company_id:'company-1',product_id:PRODUCT,quantity:stock,reserved_quantity:2},
    productStock:stock,dispatch:null,movements:[],commits:0,rollbacks:0,
  };
  let before;
  const connection = {
    async beginTransaction() { before=structuredClone(state); },
    async commit() { state.commits++; },
    async rollback() { Object.assign(state,before,{rollbacks:state.rollbacks+1}); },
    release() {},
    async query(sql,args=[]) {
      if (sql.startsWith('SELECT * FROM orders')) return [[state.order]];
      if (sql.startsWith('SELECT * FROM print3d_order_dispatches')) return [state.dispatch?[state.dispatch]:[]];
      if (sql.startsWith('SELECT * FROM print3d_order_plans')) return [[state.plan]];
      if (sql.includes('SUM(amount_cents)')) return [[{confirmed_cents:state.receipts}]];
      if (sql.startsWith('SELECT * FROM print3d_order_item_plans')) return [[state.item]];
      if (sql.startsWith('SELECT id FROM products')) return [[{id:PRODUCT}]];
      if (sql.startsWith('SELECT * FROM print3d_order_stock_reservations')) return [[state.reservation]];
      if (sql.startsWith('SELECT * FROM print3d_production_jobs')) return [[state.job]];
      if (sql.startsWith('SELECT * FROM print3d_production_outputs')) return [state.output?[state.output]:[]];
      if (sql.startsWith('SELECT * FROM product_stock_locations')) return [[state.location]];
      if (sql.startsWith('UPDATE product_stock_locations')) {
        if (state.location.quantity<args[3] || state.location.reserved_quantity<args[4]) return [{affectedRows:0}];
        state.location.quantity-=args[0]; state.location.reserved_quantity-=args[1]; return [{affectedRows:1}];
      }
      if (sql.startsWith('INSERT INTO stock_location_movements')) { state.movements.push(args); return [{affectedRows:1}]; }
      if (sql.startsWith('UPDATE print3d_order_stock_reservations')) { state.reservation.quantity_consumed+=args[0]; return [{affectedRows:1}]; }
      if (sql.startsWith('UPDATE print3d_production_outputs')) { if (failOutputs) throw Error('falha simulada no banco'); state.output.status='dispatched'; return [{affectedRows:1}]; }
      if (sql.includes('SUM(quantity)') && sql.includes('product_stock_locations')) return [[{quantity:state.location.quantity}]];
      if (sql.startsWith('UPDATE products')) { state.productStock=args[0]; return [{affectedRows:1}]; }
      if (sql.startsWith('INSERT INTO print3d_order_dispatches')) { state.dispatch={order_id:args[0],tracking_code:args[1],ready_quantity:args[3],produced_quantity:args[4]}; return [{affectedRows:1}]; }
      if (sql.startsWith('UPDATE orders')) { state.order.status='shipped'; return [{affectedRows:1}]; }
      throw new Error('Unexpected query: '+sql);
    },
  };
  return { state,pool:{getConnection:async()=>connection} };
}

test('expedição exige quitação integral no ledger, não apenas status paid',async()=>{
  const {state,pool}=fakeStore({paid:false});
  await assert.rejects(dispatchPrint3dOrder(pool,input),/Quite o valor integral/);
  assert.equal(state.dispatch,null); assert.equal(state.location.quantity,3); assert.equal(state.rollbacks,1);
});

test('expedição bloqueia produção incompleta e estoque reservado insuficiente',async()=>{
  const incomplete=fakeStore({complete:false});
  await assert.rejects(dispatchPrint3dOrder(incomplete.pool,input),/produção ainda não concluiu/);
  assert.equal(incomplete.state.dispatch,null);
  const short=fakeStore({stock:1});
  await assert.rejects(dispatchPrint3dOrder(short.pool,input),/Saldo físico reservado insuficiente/);
  assert.equal(short.state.location.quantity,1); assert.equal(short.state.output.status,'reserved_for_order');
});

test('expedição consome estoque pronto, vincula saída produzida e repete sem dupla baixa',async()=>{
  const {state,pool}=fakeStore();
  const first=await dispatchPrint3dOrder(pool,input);
  assert.deepEqual([first.ready_quantity,first.produced_quantity,first.replayed],[2,1,false]);
  assert.equal(state.location.quantity,1); assert.equal(state.location.reserved_quantity,0);
  assert.equal(state.reservation.quantity_consumed,2); assert.equal(state.output.status,'dispatched');
  assert.equal(state.productStock,1); assert.equal(state.order.status,'shipped'); assert.equal(state.movements.length,1);
  const replay=await dispatchPrint3dOrder(pool,input);
  assert.equal(replay.replayed,true); assert.equal(state.location.quantity,1); assert.equal(state.movements.length,1);
  await assert.rejects(dispatchPrint3dOrder(pool,{...input,trackingCode:'OUTRO123'}),/outro rastreio/);
  assert.equal(state.dispatch.tracking_code,'BR123456789');
});

test('erro após baixa das peças prontas reverte estoque, movimentos e pedido',async()=>{
  const {state,pool}=fakeStore({failOutputs:true});
  await assert.rejects(dispatchPrint3dOrder(pool,input),/falha simulada/);
  assert.equal(state.location.quantity,3); assert.equal(state.location.reserved_quantity,2);
  assert.equal(state.reservation.quantity_consumed,0); assert.equal(state.movements.length,0);
  assert.equal(state.output.status,'reserved_for_order'); assert.equal(state.order.status,'awaiting_payment');
  assert.equal(state.dispatch,null); assert.equal(state.rollbacks,1);
});
