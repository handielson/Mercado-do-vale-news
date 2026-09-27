'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { expiryWorkerConfig, createPrint3dExpiryWorker } = require('../services/print3dExpiryWorker.cjs');
test('trabalhador de expiração fica fechado até haver habilitação explícita da loja e do próprio trabalhador', async () => {
  assert.equal(expiryWorkerConfig({}),null);
  assert.equal(expiryWorkerConfig({MDV_PRINT3D_EXPIRY_ENABLED:'1'}),null);
  assert.equal(expiryWorkerConfig({MDV_PRINT3D_CHECKOUT_ENABLED:'1'}),null);
  assert.deepEqual(expiryWorkerConfig({MDV_PRINT3D_CHECKOUT_ENABLED:'1',MDV_PRINT3D_EXPIRY_ENABLED:'1'}),{intervalMs:300000});
  assert.equal(expiryWorkerConfig({MDV_PRINT3D_CHECKOUT_ENABLED:'1',MDV_PRINT3D_EXPIRY_ENABLED:'1',MDV_PRINT3D_EXPIRY_INTERVAL_MS:'1'}),null);
  let calls=0; const worker=createPrint3dExpiryWorker({pool:{},checkoutEnabled:false,env:{},expire:async()=>{calls++;}});
  assert.equal(worker.start(),false); assert.deepEqual(await worker.runOnce(),{enabled:false,skipped:'disabled'}); assert.equal(calls,0);
});
test('uma execução por vez evita concorrência no varredor e erros não expõem dados', async () => {
  let resolve; let calls=0; const logs=[];
  const worker=createPrint3dExpiryWorker({pool:{},checkoutEnabled:true,env:{MDV_PRINT3D_CHECKOUT_ENABLED:'1',MDV_PRINT3D_EXPIRY_ENABLED:'1',MDV_PRINT3D_EXPIRY_INTERVAL_MS:'60000'},logger:{error:value=>logs.push(value)},expire:async()=>{
    calls++; await new Promise(done=>{resolve=done;}); return {scanned:1,expired:1,skipped:0,order_ids:[]};
  }});
  const first=worker.runOnce(); assert.deepEqual(await worker.runOnce(),{enabled:true,skipped:'running'}); resolve();
  assert.deepEqual(await first,{enabled:true,scanned:1,expired:1,skipped:0,order_ids:[]}); assert.equal(calls,1); assert.deepEqual(logs,[]); worker.stop();
});
test('os dois pontos de entrada VPS só iniciam o trabalhador configurado', () => {
  for(const file of ['vps_server.cjs','vps_server.js']) {
    const source=fs.readFileSync(file,'utf8');
    assert.match(source,/createPrint3dExpiryWorker\(\{ pool, checkoutEnabled:print3dCheckoutEnabled, cancelProviderCharges:cancelPrint3dProviderChargesForOrder \}\)\.start\(\)/);
  }
});
