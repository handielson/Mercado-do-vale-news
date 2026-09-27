const test=require('node:test');
const assert=require('node:assert/strict');
const { signShippingQuote,verifyShippingQuote,quoteItemsFingerprint }=require('../services/print3dShippingQuoteToken.cjs');
const {quoteProduct,quotePaymentSchedule}=require('../services/print3dStorefrontQuote.cjs');
const secret='local-only-shipping-signing-secret-32-chars';
const items=[{product_id:'p1',quantity:2}];
const quoted=[quoteProduct({id:'p1',price_retail:2500,available_stock:1,print3d_preorder_enabled:1,production_days:3},2)];
const payload={items,quote:{items:quoted,paymentSchedule:quotePaymentSchedule(quoted)},cep:'01001000',options:[{id:'frenet:1',price_cents:1990}],origin_cep:'56300001',parcel:{weight_g:400,height_cm:10,width_cm:10,length_cm:20},production_days:3,handling_business_days:1};
const input=token=>({token,items,cep:'01001-000',shippingOptionId:'frenet:1'});
test('cotação assinada preserva valor/origem/embalagem e não aceita preço externo',()=>{
 const token=signShippingQuote(payload,secret,1000);
 const result=verifyShippingQuote({...input(token),price_cents:1},secret,1001);
 assert.equal(result.option.price_cents,1990);assert.equal(result.origin_cep,'56300001');
 assert.equal(result.items_fingerprint,quoteItemsFingerprint(quoted));
 assert.deepEqual(result.parcel,payload.parcel);
});
test('token rejeita adulteração, loja/chave errada, destino/quantidade/modalidade diferente e expiração',()=>{
 const token=signShippingQuote(payload,secret,1000);
 for(const value of [
   {...input(token),token:token+'x'},
   {...input(token),cep:'01002000'},
   {...input(token),items:[{product_id:'p1',quantity:3}]},
   {...input(token),shippingOptionId:'free'},
 ]) assert.throws(()=>verifyShippingQuote(value,secret,1001));
 assert.throws(()=>verifyShippingQuote(input(token),'other-local-signing-secret-at-least-32',1001));
 assert.throws(()=>verifyShippingQuote(input(token),secret,1600));
 assert.throws(()=>verifyShippingQuote(input(token),secret,999));
});
test('fingerprint detecta alteração de preço, prazo ou divisão pronta/encomenda',()=>{
 const original=quoteItemsFingerprint(quoted);
 for(const [field,value] of [['unit_price',2501],['ready_quantity',2],['preorder_quantity',0],['production_days',5]])
  assert.notEqual(quoteItemsFingerprint([{...quoted[0],[field]:value}]),original);
});
test('assinatura não funciona sem segredo configurado',()=>{
 assert.throws(()=>signShippingQuote(payload,'short'),/indisponível/);
});
