'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createPrint3dCheckout,validateCheckout,projectOrder,listPrint3dOrders} = require('../services/print3dCheckout.cjs');
const {quoteProduct,quotePaymentSchedule} = require('../services/print3dStorefrontQuote.cjs');
const {quoteItemsFingerprint} = require('../services/print3dShippingQuoteToken.cjs');
const {registerPrint3dCheckoutRoutes} = require('../services/print3dCheckoutServer.cjs');
const CUSTOMER='11111111-1111-4111-8111-111111111111',PRODUCT='22222222-2222-4222-8222-222222222222',COMPANY='33333333-3333-4333-8333-333333333333',KEY='44444444-4444-4444-8444-444444444444';
const body = () => ({idempotency_key:KEY,items:[{product_id:PRODUCT,quantity:2}],quote_token:'signed',shipping_option_id:'frenet:1',
  shipping_address:{cep:'56300-000',street:'Rua exemplo',number:'10',neighborhood:'Centro',city:'Petrolina',state:'PE'}});
function quote(stock=2,quantity=2) {
  const items=[quoteProduct({id:PRODUCT,name:'Peça',sku:'3D',price_retail:1001,available_stock:stock,print3d_preorder_enabled:1,production_days:5},quantity)];
  return {items,paymentSchedule:quotePaymentSchedule(items)};
}
function fixture({stock=2,phone=true,company=COMPANY,failProduction=false,authVersion=1}={}) {
  let state={stock,orders:[],requests:[],reservations:0,plans:0,jobs:0};
  const events=[];
  let queue=Promise.resolve();
  const pool={async getConnection() {
    let draft,unlock;
    return {
      async beginTransaction() { const previous=queue; queue=new Promise(resolve=>unlock=resolve); await previous; draft=structuredClone(state); events.push('begin'); },
      async commit(){ state=draft; unlock(); events.push('commit'); },
      async rollback(){ if(unlock)unlock(); events.push('rollback'); },
      release(){events.push('release');},
      async query(sql,args=[]) {
        events.push(sql);
        if(sql.startsWith('SET TRANSACTION')) return [];
        if(sql.startsWith('SELECT auth_version FROM print3d_customer_auth'))return [[{auth_version:authVersion}]];
        if(sql.startsWith('SELECT id,name,email'))return [[{id:CUSTOMER,name:'Teste',email:'test@example.test',phone:'5587000000000',is_active:1,email_verified_at:'date',phone_verified_at:phone?'date':null}]];
        if(sql.startsWith('SELECT * FROM print3d_checkout_requests'))return [draft.requests.filter(row=>row.customer_id===args[0]&&row.idempotency_key===args[1])];
        if(sql.startsWith('SELECT id,company_id FROM products'))return [[{id:PRODUCT,company_id:company}]];
        if(sql.startsWith('SELECT id,company_id FROM product_stock_locations'))return [[{id:KEY,company_id:company}]];
        if(sql.startsWith('SELECT product_id')||sql.startsWith('SELECT id FROM product_stock'))return [[]];
        if(sql.startsWith('INSERT INTO ')){
          const [,table,columns]=sql.match(/^INSERT INTO (\w+) \(([^)]+)\)/);
          const row=Object.fromEntries(columns.split(',').map((key,index)=>[key,args[index]]));
          if(table==='orders')draft.orders.push(row);
          if(table==='print3d_checkout_requests')draft.requests.push(row);
          return [{affectedRows:1}];
        }
        throw new Error('Unimplemented SQL '+sql);
      },
      get draft(){return draft;},
    };
  }};
  const signedQuote=quote(stock);
  const deps={customerId:CUSTOMER,authVersion:1,companyId:COMPANY,body:body(),
    loadQuote:async connection=>quote(connection.draft.stock),
    verifyShipping:()=>({subtotal_cents:signedQuote.paymentSchedule?.subtotal ?? 2002,items_fingerprint:quoteItemsFingerprint(signedQuote.items),
      option:{id:'frenet:1',price_cents:500},production_days:5,handling_business_days:1}),
    reserveStock:async(connection,input)=>{events.push('reserve');if(connection.draft.stock<input.quantity)return {status:400};connection.draft.stock-=input.quantity;connection.draft.reservations++;return {status:200,reservations:[{stock_location_id:KEY,deposit_id:null,location_id:null,quantity_reserved:input.quantity}]};},
    savePlan:async connection=>{connection.draft.plans++;},
    createProduction:async connection=>{if(failProduction)throw Object.assign(new Error('Ficha ausente'),{statusCode:409});connection.draft.jobs++;},
    readOrders:async(connection,{orderId})=>connection.draft.orders.filter(order=>order.id===orderId).map(order=>({id:order.id,total_cents:order.total})),
  };
  return {pool,deps,events,get state(){return state;}};
}
test('normaliza endereço e ignora valores/preços do navegador',()=>{
  const raw=body(); raw.total=1;raw.shipping_cost=0;raw.items[0].unit_price=1;
  const validated=validateCheckout(raw);
  assert.equal(validated.shipping_address.cep,'56300000');
  assert.equal(validated.total,undefined);assert.equal(validated.items[0].unit_price,undefined);
});
test('endereço incompleto/estado inválido/quantidade inválida falham antes da transação',()=>{
  for(const change of [value=>value.shipping_address.state='ZZ',value=>value.shipping_address.number='',value=>value.items[0].quantity=0,value=>value.quote_token='']){
    const input=body();change(input);assert.throws(()=>validateCheckout(input),error=>error.statusCode===400);
  }
});
test('checkout persiste valores canônicos, reserva e plano na mesma transação',async()=>{
  const f=fixture();f.deps.body.total=1;f.deps.body.shipping_cost=0;
  const result=await createPrint3dCheckout(f.pool,f.deps);
  assert.equal(result.replayed,false);assert.equal(result.order.total_cents,2502);
  assert.equal(f.state.stock,0);assert.equal(f.state.reservations,1);assert.equal(f.state.plans,1);
  assert.equal(f.state.orders[0].customer_id,null);assert.equal(f.state.orders[0].storefront,'loja_3d');
  assert.ok(f.events.indexOf('reserve')<f.events.indexOf('commit'));
  assert.ok(f.events.indexOf('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')<f.events.indexOf('begin'));
});
test('retry, inclusive concorrente, cria um pedido e uma reserva',async()=>{
  const f=fixture();const [a,b]=await Promise.all([createPrint3dCheckout(f.pool,f.deps),createPrint3dCheckout(f.pool,f.deps)]);
  assert.equal(a.order.id,b.order.id);assert.deepEqual([a.replayed,b.replayed],[false,true]);
  assert.equal(f.state.orders.length,1);assert.equal(f.state.reservations,1);
});
test('mesma chave com endereço diferente não reusa pedido',async()=>{
  const f=fixture();await createPrint3dCheckout(f.pool,f.deps);const next=structuredClone(f.deps.body);next.shipping_address.number='20';
  await assert.rejects(createPrint3dCheckout(f.pool,{...f.deps,body:next}),error=>error.statusCode===409);
  assert.equal(f.state.orders.length,1);
});
test('falha na criação da produção desfaz pedido e reserva',async()=>{
  const f=fixture({failProduction:true});
  await assert.rejects(createPrint3dCheckout(f.pool,f.deps),/Ficha ausente/);
  assert.equal(f.state.orders.length,0);assert.equal(f.state.stock,2);assert.equal(f.state.reservations,0);
  assert.ok(f.events.includes('rollback'));
});

test('recalcular token após resposta perdida recupera o mesmo pedido e reserva',async()=>{
  const f=fixture();
  const first=await createPrint3dCheckout(f.pool,f.deps);
  f.deps.verifyShipping=()=>assert.fail('replay não deve consumir nova cotação');
  const retry=await createPrint3dCheckout(f.pool,{...f.deps,body:{...f.deps.body,quote_token:'new-signed-quote'}});
  assert.equal(retry.replayed,true);assert.equal(retry.order.id,first.order.id);
  assert.equal(f.state.orders.length,1);assert.equal(f.state.reservations,1);
});
test('mudança de estoque entre cotação e checkout impede assumir encomenda silenciosamente',async()=>{
  const f=fixture();await createPrint3dCheckout(f.pool,f.deps);
  await assert.rejects(createPrint3dCheckout(f.pool,{...f.deps,body:{...body(),idempotency_key:'55555555-5555-4555-8555-555555555555'}}),error=>error.statusCode===409);
  assert.equal(f.state.orders.length,1);
});
test('quantidade sob encomenda exige consulta e não entra no checkout',async()=>{
  const f=fixture({stock:1,phone:false});
  await assert.rejects(createPrint3dCheckout(f.pool,f.deps),error=>error.statusCode===409);
  assert.equal(f.state.orders.length,0);
  const ready=fixture({phone:false});assert.equal((await createPrint3dCheckout(ready.pool,ready.deps)).replayed,false);
});
test('empresa diferente é bloqueada antes de reservar',async()=>{
  const f=fixture({company:CUSTOMER});
  await assert.rejects(createPrint3dCheckout(f.pool,f.deps),error=>error.statusCode===409);
  assert.equal(f.state.reservations,0);
});
test('cotação adulterada ou expirada falha sem gravar',async()=>{
  const f=fixture();f.deps.verifyShipping=()=>{throw Object.assign(new Error('Cotação expirada'),{statusCode:409});};
  await assert.rejects(createPrint3dCheckout(f.pool,f.deps),/expirada/);assert.equal(f.state.orders.length,0);
});
test('sessão revogada depois da autenticação falha sob lock antes de reservar',async()=>{
  const f=fixture({authVersion:2});
  await assert.rejects(createPrint3dCheckout(f.pool,f.deps),error=>error.statusCode===401);
  assert.equal(f.state.orders.length,0);assert.equal(f.state.reservations,0);
  assert.ok(f.events.includes('SELECT auth_version FROM print3d_customer_auth WHERE customer_id=? FOR UPDATE'));
});
test('checkout não permite sessão sem versão',async()=>{
  const f=fixture();
  await assert.rejects(createPrint3dCheckout(f.pool,{...f.deps,authVersion:undefined}),error=>error.statusCode===401);
  assert.equal(f.events.length,0);
});
test('checkout configura no máximo dez solicitações por minuto',()=>{
  let options;
  const app={get(){},post(path,value){if(path==='/print3d/checkout')options=value;}};
  registerPrint3dCheckoutRoutes(app,{});
  assert.deepEqual(options.config.rateLimit,{max:10,timeWindow:'1 minute'});
});
test('DTO v1 preserva condição escolhida para produtos prontos e encomendados',()=>{
  const row={id:PRODUCT,public_number:1,subtotal:2002,shipping_cost:500,total:2502,preorder_amount_cents:2002,due_on_confirmation_cents:1001,due_before_shipping_cents:1501,confirmed_cents:1001,shipping_address:'{}',option_snapshot:'{}',payment_terms_version:1,initial_payment_bps:5000,shipping_payment_mode:'later',shipping_initial_cents:0,minimum_initial_cents:1001};
  assert.deepEqual(projectOrder(row,[]).payment_schedule,{due_on_confirmation_cents:1001,due_before_shipping_cents:1501,shipping_cents:500,initial_cents:1001,balance_cents:1501,payment_terms_version:1,initial_payment_bps:5000,shipping_payment_mode:'later',shipping_initial_cents:0,minimum_initial_cents:1001});
  const ready=projectOrder({...row,preorder_amount_cents:0},[]);
  assert.equal(ready.payment_schedule.initial_cents,1001);assert.equal(ready.payment_schedule.balance_cents,1501);
  assert.equal(projectOrder(row,[]).confirmed_cents,1001);assert.equal(projectOrder(row,[]).outstanding_cents,1501);
});

test('checkout valida entrada mínima e vincula condição financeira à idempotência',async()=>{
  const base=validateCheckout(body());
  assert.deepEqual(base.payment_terms,{initial_payment_bps:5000,shipping_payment_mode:'later'});
  for(const initial_payment_bps of [4999,10001,NaN,'5000',5050.5]) {
    assert.throws(()=>validateCheckout({...body(),payment_terms:{initial_payment_bps}}),/Entrada/);
  }
  assert.throws(()=>validateCheckout({...body(),payment_terms:{shipping_payment_mode:'invalid'}}),/frete/);
  const f=fixture();
  let selected;
  f.deps.body.payment_terms={initial_payment_bps:7000,shipping_payment_mode:'split'};
  const save=f.deps.savePlan;
  f.deps.savePlan=async(c,args)=>{selected=args.paymentTerms;return save(c,args);};
  await createPrint3dCheckout(f.pool,f.deps);
  assert.deepEqual(selected,{initial_payment_bps:7000,shipping_payment_mode:'split'});
  await assert.rejects(createPrint3dCheckout(f.pool,{...f.deps,body:{...f.deps.body,payment_terms:{initial_payment_bps:5000,shipping_payment_mode:'later'}}}),error=>error.statusCode===409);
  assert.equal(f.state.orders.length,1);
});
test('leitura de pedidos filtra dono, canal e exclui conta MDV',async()=>{
  let captured;
  const db={query:async(sql,args)=>{captured={sql,args};return [[]];}};
  await listPrint3dOrders(db,{customerId:CUSTOMER});
  assert.match(captured.sql,/o.storefront='loja_3d'/);assert.match(captured.sql,/o.customer_id IS NULL/);
  assert.match(captured.sql,/o.print3d_customer_id=\?/);assert.deepEqual(captured.args,[CUSTOMER]);
  await assert.rejects(listPrint3dOrders(db,{customerId:CUSTOMER,orderId:PRODUCT}),error=>error.statusCode===404);
});
test('rotas desligadas não acessam banco e sessão errada recebe 401',async()=>{
  const app=require('fastify')();
  registerPrint3dCheckoutRoutes(app,{pool:{query(){throw new Error('unexpected db');}},getCustomer:async()=>null});
  assert.equal((await app.inject({method:'GET',url:'/print3d/checkout'})).json().enabled,false);
  assert.equal((await app.inject({method:'GET',url:'/print3d/orders'})).statusCode,401);
  await app.close();
});
