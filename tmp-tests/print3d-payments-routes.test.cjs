'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fastify=require('fastify');
const {registerPrint3dPaymentRoutes}=require('../services/print3dPaymentsServer.cjs');
const env={MDV_PRINT3D_PAYMENTS_ENABLED:'1',MDV_PRINT3D_MP_ACCESS_TOKEN:'test-only',MDV_PRINT3D_MP_COLLECTOR_ID:'456',
  MDV_PRINT3D_MP_WEBHOOK_SECRET:'unit-test-only',MDV_PRINT3D_MP_NOTIFICATION_URL:'https://example.invalid/print3d/payments/webhook'};
test('unauthenticated customer cannot create, read or refresh charge',async()=>{
  const app=fastify();let calls=0;
  registerPrint3dPaymentRoutes(app,{env,pool:{},getCustomer:async()=>null,adapter:{get(){calls++},create(){calls++}}});
  for(const [method,url] of [['POST','/print3d/orders/a/payment'],['GET','/print3d/orders/a/payment'],['POST','/print3d/orders/a/payment/refresh']]) {
    const result=await app.inject({method,url});assert.equal(result.statusCode,401);
  }
  assert.equal(calls,0);await app.close();
});
test('payment service disabled by default even with a valid customer',async()=>{
  const app=fastify();registerPrint3dPaymentRoutes(app,{env:{},pool:{},getCustomer:async()=>({id:'customer'}),adapter:{get(){assert.fail()},create(){assert.fail()}}});
  assert.equal((await app.inject({method:'POST',url:'/print3d/orders/a/payment',payload:{}})).statusCode,503);
  await app.close();
});
test('forged webhook cannot trigger a provider or database request',async()=>{
  const app=fastify();let calls=0;
  registerPrint3dPaymentRoutes(app,{env,pool:{getConnection(){calls++}},getCustomer:async()=>null,adapter:{get(){calls++}}});
  const result=await app.inject({method:'POST',url:'/print3d/payments/webhook?data.id=123',payload:{type:'payment',data:{id:123}}});
  assert.equal(result.statusCode,401);assert.equal(calls,0);await app.close();
});
