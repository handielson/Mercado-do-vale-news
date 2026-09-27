'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildPaymentTerms} = require('../services/print3dPaymentTerms.cjs');
test('cada modalidade de frete aplica mínimo coerente',()=>{
  assert.deepEqual(buildPaymentTerms(101,21),{initial_payment_bps:5000,shipping_payment_mode:'later',products_initial_cents:51,
    shipping_initial_cents:0,initial_cents:51,balance_cents:71,minimum_initial_cents:51,total_cents:122});
  assert.equal(buildPaymentTerms(101,21,{shipping_payment_mode:'full_now'}).initial_cents,72);
  assert.equal(buildPaymentTerms(101,21,{shipping_payment_mode:'full_now'}).minimum_initial_cents,72);
  assert.equal(buildPaymentTerms(101,21,{shipping_payment_mode:'split'}).initial_cents,61);
  assert.equal(buildPaymentTerms(101,21,{shipping_payment_mode:'split'}).shipping_initial_cents,10);
});
test('70% e 100% respeitam produtos e escolha do frete',()=>{
  assert.equal(buildPaymentTerms(10000,1000,{initial_payment_bps:7000}).initial_cents,7000);
  assert.equal(buildPaymentTerms(10000,1000,{initial_payment_bps:7000,shipping_payment_mode:'split'}).initial_cents,7700);
  assert.equal(buildPaymentTerms(10000,1000,{initial_payment_bps:10000}).balance_cents,1000);
  assert.equal(buildPaymentTerms(10000,1000,{initial_payment_bps:10000,shipping_payment_mode:'full_now'}).balance_cents,0);
  assert.equal(buildPaymentTerms(10000,1000,{initial_payment_bps:10000,shipping_payment_mode:'split'}).balance_cents,0);
});
test('valores inválidos, entrada menor que metade e total inseguro falham',()=>{
  for(const value of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>buildPaymentTerms(value,0));
  for(const bps of [4999,10001,5000.5,'7000'])assert.throws(()=>buildPaymentTerms(100,0,{initial_payment_bps:bps}));
  assert.throws(()=>buildPaymentTerms(0,0));assert.throws(()=>buildPaymentTerms(100,-1));
  assert.throws(()=>buildPaymentTerms(Number.MAX_SAFE_INTEGER,1));assert.throws(()=>buildPaymentTerms(100,0,{shipping_payment_mode:'invalid'}));
});
test('BigInt evita perda de precisão ao multiplicar centavos por percentual',()=>{
  const value=Number.MAX_SAFE_INTEGER;
  const terms=buildPaymentTerms(value,0,{initial_payment_bps:9999});
  const expected=Number((BigInt(value)*9999n+9999n)/10000n);
  assert.equal(terms.initial_cents,expected);assert.equal(terms.initial_cents+terms.balance_cents,value);
});
