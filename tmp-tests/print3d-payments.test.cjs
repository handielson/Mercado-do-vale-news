'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {buildPaymentTerms} = require('../services/print3dPaymentTerms.cjs');
const {paymentsConfigured,verifyWebhook,verifyPayment,stageAmount,publicCharge,createMpAdapter,createCharge,settlePayment,refreshCharge,cancelPrint3dProviderCharges} = require('../services/print3dPayments.cjs');
const orderId='11111111-1111-4111-8111-111111111111', chargeId='22222222-2222-4222-8222-222222222222';
const charge={id:chargeId,order_id:orderId,amount_cents:500,stage:'initial',status:'creating'};
const payment={id:123,collector_id:456,currency_id:'BRL',payment_method_id:'pix',external_reference:`print3d:${chargeId}`,transaction_amount:5,status:'approved',date_approved:'2026-09-27T12:00:00Z'};
test('configuration stays closed without independently configured credentials',()=>{
  assert.equal(paymentsConfigured({}),false);
  assert.equal(paymentsConfigured({MDV_PRINT3D_PAYMENTS_ENABLED:'1',MP_ACCESS_TOKEN:'old-mdv-token'}),false);
});
test('notification URL requires exact HTTPS webhook path without userinfo, query or fragment',()=>{
  const env={MDV_PRINT3D_PAYMENTS_ENABLED:'1',MDV_PRINT3D_MP_ACCESS_TOKEN:'fake',MDV_PRINT3D_MP_COLLECTOR_ID:'456',MDV_PRINT3D_MP_WEBHOOK_SECRET:'fake'};
  const configured=url=>paymentsConfigured({...env,MDV_PRINT3D_MP_NOTIFICATION_URL:url});
  assert.equal(configured('https://example.invalid/print3d/payments/webhook'),true);
  for(const url of ['https://user:pass@example.invalid/print3d/payments/webhook','https://example.invalid/a/print3d/payments/webhook',
    'https://example.invalid/print3d/payments/webhook?token=x','https://example.invalid/print3d/payments/webhook#fragment',
    'http://example.invalid/print3d/payments/webhook','invalid']) assert.equal(configured(url),false,url);
});
test('initial charge follows chosen plan for both ready stock and preorder',()=>{
  const coverage={confirmed_cents:0,due_on_confirmation_cents:700,outstanding_cents:1400,initial_payment_covered:false};
  assert.equal(stageAmount('initial',{preorder_amount_cents:1000},coverage,{total:1400}),700);
  assert.equal(stageAmount('initial',{payment_terms_version:1,preorder_amount_cents:0},coverage,{total:1400}),700);
  assert.throws(()=>stageAmount('balance',{},coverage,{}));
  assert.equal(stageAmount('balance',{}, {...coverage,initial_payment_covered:true,outstanding_cents:700},{}),700);
});
test('legacy ready-stock initial keeps full freight; version 1 honors chosen entry',()=>{
  const coverage={confirmed_cents:0,due_on_confirmation_cents:1000,outstanding_cents:1100,initial_payment_covered:false};
  assert.equal(stageAmount('initial',{preorder_amount_cents:0},coverage,{total:1100}),1100);
  assert.equal(stageAmount('initial',{payment_terms_version:0,preorder_amount_cents:0},coverage,{total:1100}),1100);
  assert.equal(stageAmount('initial',{payment_terms_version:1,preorder_amount_cents:0},{...coverage,due_on_confirmation_cents:500},{total:1100}),500);
  assert.equal(stageAmount('initial',{payment_terms_version:0,preorder_amount_cents:1000},{...coverage,due_on_confirmation_cents:500},{total:1100}),500);
});
for (const [key,value] of Object.entries({collector_id:999,currency_id:'USD',payment_method_id:'visa',external_reference:'mdv:order',transaction_amount:4.99,id:'bad'})) {
  test(`reject provider mismatch ${key}`,()=>assert.throws(()=>verifyPayment({...payment,[key]:value},charge,'456')));
}
test('reject replacing already bound provider id',()=>assert.throws(()=>verifyPayment(payment,{...charge,provider_payment_id:'789'},'456')));
test('client projection omits credentials and payer email',()=>{
  const result=publicCharge({...charge,payer_email:'private@example.invalid',provider_payment_id:'123',status:'approved',pix_code:'secret'});
  assert.equal(result.payer_email,undefined); assert.equal(result.provider_payment_id,undefined); assert.equal(result.pix_code,'');
});
test('webhook verifies signed query id, timestamp and request id; forged body rejected',()=>{
  const ts='1790500000',now=Number(ts)*1000,secret='unit-test-only';
  const sig=crypto.createHmac('sha256',secret).update(`id:123;request-id:test-request;ts:${ts};`).digest('hex');
  const req={headers:{'x-signature':`ts=${ts},v1=${sig}`,'x-request-id':'test-request'},query:{'data.id':'123'},body:{type:'payment',data:{id:'123'}}};
  assert.equal(verifyWebhook(req,secret,now),'123');
  assert.throws(()=>verifyWebhook(req,'wrong',now));
  assert.throws(()=>verifyWebhook(req,secret,now+600001));
  assert.throws(()=>verifyWebhook({...req,body:{type:'payment',data:{id:'999'}}},secret,now));
});
test('adapter sends cent conversion and durable UUID to isolated official endpoint only',async()=>{
  let request;
  const adapter=createMpAdapter({MDV_PRINT3D_MP_ACCESS_TOKEN:'fake-only',MDV_PRINT3D_MP_NOTIFICATION_URL:'https://example.invalid/print3d/payments/webhook'},async(url,opts)=>{
    request={url,...opts};return {ok:true,json:async()=>payment};
  });
  await adapter.create({...charge,payer_email:'fake@example.invalid'});
  assert.equal(request.url,'https://api.mercadopago.com/v1/payments');
  assert.equal(request.headers['X-Idempotency-Key'],chargeId);
  assert.equal(JSON.parse(request.body).transaction_amount,5);
  assert.equal(JSON.parse(request.body).external_reference,`print3d:${chargeId}`);
});
test('adapter cancela somente o pagamento identificado na API oficial com chave própria',async()=>{
  let request;
  const adapter=createMpAdapter({MDV_PRINT3D_MP_ACCESS_TOKEN:'fake-only',MDV_PRINT3D_MP_NOTIFICATION_URL:'https://example.invalid/print3d/payments/webhook'},async(url,opts)=>{
    request={url,...opts};return {ok:true,json:async()=>({...payment,status:'cancelled'})};
  });
  await adapter.cancel(123);
  assert.equal(request.url,'https://api.mercadopago.com/v1/payments/123'); assert.equal(request.method,'PUT');
  assert.equal(JSON.parse(request.body).status,'cancelled'); assert.match(request.headers['X-Idempotency-Key'],/^[0-9a-f-]{36}$/);
});
test('cancelamento local tenta encerrar somente PIX pendente no provedor e mantém pedido cancelado',async()=>{
  const state={order:{id:orderId,storefront:'loja_3d',print3d_customer_id:'customer',customer_id:null,status:'cancelled',payment_status:'cancelled'},
    charge:{...charge,status:'cancelled',provider_payment_id:'123'}};
  const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,args=[])=>{
    if(sql.startsWith('SELECT order_id FROM print3d_payment_charges')) return [[{order_id:orderId}]];
    if(sql.startsWith('SELECT * FROM orders')) return [[state.order]];
    if(sql.startsWith('SELECT * FROM print3d_payment_charges')) return [[state.charge]];
    if(sql.startsWith("UPDATE print3d_payment_charges SET status='provider_cancelled'")) {state.charge.status='provider_cancelled';return [{}];}
    throw new Error('SQL inesperado no cancelamento do provedor: '+sql);
  }};
  const calls=[]; const adapter={get:async id=>{calls.push(['get',id]);return {...payment,status:'pending'};},cancel:async id=>{calls.push(['cancel',id]);return {...payment,status:'cancelled'};}};
  const pool={query:async sql=>{if(sql.startsWith('SELECT * FROM print3d_payment_charges')) return [[state.charge]];throw new Error(sql);},getConnection:async()=>connection};
  const result=await cancelPrint3dProviderCharges(pool,{orderId,adapter,collectorId:'456'});
  assert.deepEqual(calls,[['get','123'],['cancel','123']]); assert.deepEqual(result,[{charge_id:chargeId,status:'cancelled',review_required:false}]);
  assert.equal(state.order.status,'cancelled');
});
function fixture() {
  const state={charges:[],receipts:[],commits:0,rollbacks:0,released:0,unfinished:false,
    order:{id:orderId,storefront:'loja_3d',print3d_customer_id:'customer',customer_id:null,status:'pending',payment_status:'pending',subtotal:1000,shipping_cost:100,total:1100},
    plan:{preorder_amount_cents:1000,ready_amount_cents:0,subtotal_cents:1000,deposit_amount_cents:500,due_on_confirmation_cents:500,due_before_shipping_cents:500}};
  const c={beginTransaction:async()=>{},commit:async()=>{state.commits++},rollback:async()=>{state.rollbacks++},release(){},async query(sql,v=[]){
    if(sql.startsWith('SELECT * FROM orders'))return [[state.order]];
    if(sql.startsWith('SELECT * FROM print3d_order_plans'))return [[state.plan]];
    if(sql.includes('SUM(amount_cents)'))return [[{confirmed_cents:state.receipts.reduce((n,r)=>n+r.amount,0)}]];
    if(sql.startsWith('SELECT * FROM print3d_order_payment_receipts'))return [state.receipts.filter(r=>r.provider_payment_id===v[2])];
    if(sql.startsWith('INSERT INTO print3d_order_payment_receipts')){state.receipts.push({id:v[0],provider_payment_id:v[4],amount:v[5],payload_hash:v[7]});return [{}];}
    if(sql.startsWith('SELECT order_id FROM print3d_payment_charges'))return [state.charges.filter(r=>r.id===v[0]).map(r=>({order_id:r.order_id}))];
    if(sql.startsWith('SELECT * FROM print3d_payment_charges'))return [state.charges.filter(r=>sql.includes('WHERE id=')?r.id===v[0]:r.order_id===v[0])];
    if(sql.startsWith('INSERT INTO print3d_payment_charges')){const keys=['id','order_id','stage','idempotency_key','amount_cents','payer_email','status'];state.charges.push(Object.fromEntries(keys.map((k,i)=>[k,v[i]])));return [{}];}
    if(sql.startsWith('UPDATE print3d_payment_charges SET status=?')){Object.assign(state.charges.find(r=>r.id===v[5]),{status:v[0],provider_payment_id:v[1],pix_code:v[2],pix_qr_base64:v[3],expires_at:v[4]});return [{}];}
    if(sql.startsWith("UPDATE print3d_payment_charges SET status='refunded'")){Object.assign(state.charges.find(r=>r.id===v[1]),{status:'refunded',provider_payment_id:v[0]});return [{}];}
    if(sql.startsWith('UPDATE print3d_production_jobs')){state.released++;return [{affectedRows:1}];}
    if(sql.startsWith('UPDATE orders SET payment_status=\'paid\'')){state.order.payment_status='paid';return [{}];}
    if(sql.startsWith("UPDATE orders SET payment_status='refunded'")){state.order.payment_status='refunded';return [{}];}
    if(sql.startsWith('SELECT p.order_item_id'))return [state.unfinished?[{order_item_id:'item'}]:[]];
    throw new Error(sql);
  }};
  return {state,pool:{getConnection:async()=>c}};
}
test('durable intent survives timeout; replay uses same key; confirmed entry releases once and never marks fully paid',async()=>{
  const {state,pool}=fixture();let providerCalls=0,issuedKey;
  const adapter={async create(row){providerCalls++;assert.ok(state.commits>0);if(providerCalls===1){issuedKey=row.id;throw new Error('timeout');}
    assert.equal(row.id,issuedKey);return {...payment,external_reference:`print3d:${row.id}`};},async get(){return {...payment,external_reference:`print3d:${issuedKey}`};}};
  const input={orderId,customer:{id:'customer',email:'fake@example.invalid'},body:{stage:'initial',idempotency_key:chargeId},adapter,collectorId:'456'};
  await assert.rejects(createCharge(pool,input),/timeout/);
  assert.equal(state.charges.length,1);
  const result=await createCharge(pool,input);assert.equal(result.coverage.confirmed_cents,500);assert.equal(state.order.payment_status,'pending');
  await createCharge(pool,input);assert.equal(state.receipts.length,1);assert.equal(state.charges.length,1);
});
test('wrong account cannot create payment, and missing email never falls back to MDV',async()=>{
  const {state,pool}=fixture();
  const base={orderId,body:{stage:'initial',idempotency_key:chargeId},adapter:{create(){throw Error('must not call')}},collectorId:'456'};
  await assert.rejects(createCharge(pool,{...base,customer:{id:'other'}}),/não encontrado/);
  await assert.rejects(createCharge(pool,{...base,customer:{id:'customer'}}),/e-mail válido/);
  state.order.storefront='mercado_do_vale';
  await assert.rejects(createCharge(pool,{...base,customer:{id:'customer'}}),/não encontrado/);
});
test('forged amount cannot persist receipt or release production',async()=>{
  const {state,pool}=fixture();state.charges.push(charge);
  await assert.rejects(settlePayment(pool,{payment:{...payment,transaction_amount:4},chargeId,collectorId:'456'}));
  assert.equal(state.receipts.length,0);assert.equal(state.released,0);assert.equal(state.rollbacks,1);
});
test('balance includes freight, waits for production, then full payment marks paid',async()=>{
  const {state,pool}=fixture();state.receipts.push({provider_payment_id:'initial',amount:500});state.unfinished=true;
  const input={orderId,customer:{id:'customer',email:'fake@example.invalid'},body:{stage:'balance',idempotency_key:chargeId},collectorId:'456',
    adapter:{async create(row){assert.equal(row.amount_cents,600);return {...payment,id:789,transaction_amount:6,external_reference:`print3d:${row.id}`};}}};
  await assert.rejects(createCharge(pool,input),/produção estiver concluída/);
  assert.equal(state.charges.length,0);state.unfinished=false;
  const result=await createCharge(pool,input);
  assert.equal(result.coverage.fully_paid,true);assert.equal(result.coverage.confirmed_cents,1100);assert.equal(state.order.payment_status,'paid');
});
test('cancelled orders block provider calls',async()=>{
  const {state,pool}=fixture();state.order.status='cancelled';
  await assert.rejects(createCharge(pool,{orderId,customer:{id:'customer'},body:{stage:'initial',idempotency_key:chargeId},
    adapter:{create(){assert.fail('provider must not be called')}},collectorId:'456'}),/indisponível/);
});
for (const status of ['refunded','charged_back']) test(`${status} repeated notification remains review-only and rejects forged retry`,async()=>{
  const {state,pool}=fixture();state.charges.push({...charge});
  const input={payment:{...payment,status},chargeId,collectorId:'456'};
  assert.equal((await settlePayment(pool,input)).review_required,true);
  assert.equal(state.order.payment_status,'refunded');
  assert.equal((await settlePayment(pool,input)).review_required,true);
  assert.equal((await settlePayment(pool,{...input,payment})).review_required,true);
  await assert.rejects(settlePayment(pool,{...input,payment:{...payment,status,transaction_amount:3}}));
  assert.equal(state.receipts.length,0);assert.equal(state.released,0);
  const adapter={create(){assert.fail('must not create')},get(){assert.fail('must not fetch')}};
  await assert.rejects(createCharge(pool,{orderId,customer:{id:'customer'},body:{stage:'initial',idempotency_key:chargeId},adapter,collectorId:'456'}),/indisponível/);
  await assert.rejects(refreshCharge(pool,{orderId,customerId:'customer',chargeId,adapter,collectorId:'456'}),/indisponível/);
});
for (const scenario of [
  {name:'ready stock 50 percent',ready:1000,preorder:0,bps:5000,mode:'later',initial:500,shippingInitial:0},
  {name:'mixed basket 50 percent',ready:400,preorder:600,bps:5000,mode:'later',initial:500,shippingInitial:0},
  {name:'chosen 70 percent',ready:400,preorder:600,bps:7000,mode:'later',initial:700,shippingInitial:0},
  {name:'100 percent plus full freight',ready:1000,preorder:0,bps:10000,mode:'full_now',initial:1100,shippingInitial:100},
  {name:'100 percent products with freight later',ready:1000,preorder:0,bps:10000,mode:'later',initial:1000,shippingInitial:0},
  {name:'70 percent products with split freight',ready:1000,preorder:0,bps:7000,mode:'split',initial:770,shippingInitial:70},
]) test(`version 1 charge honors ${scenario.name}`,async()=>{
  const {state,pool}=fixture();
  Object.assign(state.plan,{payment_terms_version:1,ready_amount_cents:scenario.ready,preorder_amount_cents:scenario.preorder,
    initial_payment_bps:scenario.bps,shipping_payment_mode:scenario.mode,shipping_initial_cents:scenario.shippingInitial,
    minimum_initial_cents:buildPaymentTerms(1000,100,{initial_payment_bps:scenario.bps,shipping_payment_mode:scenario.mode}).minimum_initial_cents,
    deposit_amount_cents:scenario.initial-scenario.shippingInitial,
    due_on_confirmation_cents:scenario.initial,due_before_shipping_cents:1100-scenario.initial});
  const input={orderId,customer:{id:'customer',email:'fake@example.invalid'},body:{stage:'initial',idempotency_key:chargeId},collectorId:'456',
    adapter:{async create(row){assert.equal(row.amount_cents,scenario.initial);return {...payment,transaction_amount:row.amount_cents/100,external_reference:`print3d:${row.id}`};}}};
  const result=await createCharge(pool,input);
  assert.equal(result.coverage.confirmed_cents,scenario.initial);
  assert.equal(result.coverage.outstanding_cents,1100-scenario.initial);
  assert.equal(result.coverage.fully_paid,scenario.initial===1100);
  assert.equal(state.order.payment_status,scenario.initial===1100?'paid':'pending');
  if (scenario.name==='100 percent products with freight later') {
    const remaining=await createCharge(pool,{...input,body:{stage:'balance',idempotency_key:'33333333-3333-4333-8333-333333333333'},
      adapter:{async create(row){assert.equal(row.amount_cents,100);return {...payment,id:789,transaction_amount:1,external_reference:`print3d:${row.id}`};}}});
    assert.equal(remaining.coverage.fully_paid,true);
  }
});


test('reference search is read-only and requires a single unambiguous result',async()=>{
  let response={paging:{total:1},results:[payment]};const calls=[];
  const adapter=createMpAdapter({MDV_PRINT3D_MP_ACCESS_TOKEN:'local-fake'},async(url,options)=>{
    calls.push({url,options});return {ok:true,json:async()=>response};
  });
  assert.deepEqual(await adapter.findByReference(chargeId),payment);
  assert.equal(new URL(calls[0].url).pathname,'/v1/payments/search');
  assert.equal(new URL(calls[0].url).searchParams.get('external_reference'),'print3d:'+chargeId);
  assert.equal(calls[0].options.method,undefined);assert.equal(calls[0].options.body,undefined);
  response={paging:{total:0},results:[]};assert.equal(await adapter.findByReference(chargeId),null);
  for (const invalid of [{results:[payment]}, {paging:{total:2},results:[payment]},
    {paging:{total:1},results:[]},{paging:{total:0},results:[payment]}]) {
    response=invalid;await assert.rejects(adapter.findByReference(chargeId));
  }
});

test('unresolved or foreign reference never reaches provider cancellation',async()=>{
  for (const found of [null,{...payment,collector_id:999},{...payment,transaction_amount:6},
    {...payment,external_reference:'other'}]) {
    const pool={query:async sql=>sql.startsWith('SELECT *')?[[{...charge,status:'cancelled'}]]:[{}]};
    const adapter={findByReference:async()=>found,get:async()=>assert.fail('must not fetch'),cancel:async()=>assert.fail('must not cancel')};
    const result=await cancelPrint3dProviderCharges(pool,{orderId,adapter,collectorId:'456'});
    assert.equal(result[0].status,'review_required');
  }
});
