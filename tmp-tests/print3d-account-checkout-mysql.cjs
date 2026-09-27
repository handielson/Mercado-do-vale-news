'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {quoteProduct,quotePaymentSchedule}=require('../services/print3dStorefrontQuote.cjs');
const {quoteItemsFingerprint}=require('../services/print3dShippingQuoteToken.cjs');
module.exports=async function installAccountCheckout({pool,app,getCustomer}){
 const productId=randomUUID(),companyId=randomUUID(),recipeId=randomUUID(),fileId=randomUUID(),sku='ACCOUNT-'+randomUUID().slice(0,8);
 const [[deposit]]=await pool.query('SELECT id FROM stock_deposits LIMIT 1');const [[location]]=await pool.query('SELECT id FROM stock_locations LIMIT 1');
 await pool.query('INSERT INTO products (id,company_id,sku,stock_quantity) VALUES (?,?,?,1)',[productId,companyId,sku]);
 await pool.query('INSERT INTO product_storefront_offers (product_id,storefront,publication_status,title,price_retail) VALUES (?,\'loja_3d\',\'published\',\'Peça conta local\',1000)',[productId]);
 await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',[randomUUID(),companyId,productId,deposit.id,location.id]);
 await pool.query('INSERT INTO print3d_recipe_revisions (id,product_id,sku_snapshot,revision,draft_json,draft_sha256,created_by) VALUES (?,?,?,\'local-v1\',?, ?,\'local-test\')',[recipeId,productId,sku,JSON.stringify({productId,sku,piecesPerBatch:1,printSummary:{material_gramas:10,tempo_impressao_minutos:30},filaments:[{id:'pla',name:'PLA',color:'Preto',consumedGrams:10}],supplies:[]}),'d'.repeat(64)]);
 await pool.query('INSERT INTO print3d_recipe_files (id,recipe_id,kind,original_name,storage_name,synology_path,byte_size,sha256,created_by) VALUES (?,?,\'model\',\'local.stl\',\'local.stl\',\'/local-fixture-only\',10,?,\'local-test\')',[fileId,recipeId,'e'.repeat(64)]);
 await pool.query('INSERT INTO print3d_active_recipes (product_id,recipe_id,primary_file_id,selected_by) VALUES (?,?,?,\'local-test\')',[productId,recipeId,fileId]);
 const originalVariant={material:'PLA',color:'Preto',size:'Grande',finish:'Fosco'};
 await pool.query('UPDATE products SET specs=? WHERE id=?',[JSON.stringify({...originalVariant,internal_note:'private-test',imei1:'not-for-3d'}),productId]);
 const loadQuote=async(connection,items)=>{
  assert.equal(items.length,1);assert.equal(items[0].product_id,productId);
  const [[stock]]=await connection.query('SELECT SUM(quantity-reserved_quantity) available FROM product_stock_locations WHERE product_id=?',[productId]);
  const [[catalog]]=await connection.query('SELECT specs FROM products WHERE id=?',[productId]);
  const item=quoteProduct({id:productId,name:'Peça conta local',sku,specs:catalog.specs,price_retail:1000,available_stock:Number(stock.available),print3d_preorder_enabled:1,production_days:3},items[0].quantity);
  return {items:[item],paymentSchedule:quotePaymentSchedule([item])};
 };
 // Local freight fixture; all account/order/reservation/production SQL is real.
 const freight=new Map();
 require('../services/print3dProductionServer.cjs').registerPrint3dProductionRoutes(app,{pool,getCustomer,enabled:true,dispatchEnabled:true,
  getBearerAuthContext:async req=>req.headers.authorization==='Bearer local-production-admin'?{isAdmin:true,userId:'local-test-admin'}:null});
 app.post('/storefronts/loja_3d/quote',async req=>{
  const quote=await loadQuote(pool,req.body.items);
  return {storefront:'loja_3d',items:quote.items,subtotal:quote.paymentSchedule.subtotal,payment_schedule:quote.paymentSchedule,can_checkout:false};
 });
 app.post('/storefronts/loja_3d/shipping/quote',async req=>{
  const quote=await loadQuote(pool,req.body.items),token=randomUUID();
  const option={id:'local-freight',price_cents:500,name:'Entrega local',carrier:'Transportadora teste',transport_business_days:2};
  freight.set(token,{option,subtotal_cents:quote.paymentSchedule.subtotal,items_fingerprint:quoteItemsFingerprint(quote.items),production_days:3,handling_business_days:1});
  return {quote_token:token,subtotal_cents:quote.paymentSchedule.subtotal,options:[option],production_days:3,handling_business_days:1};
 });
 const simulatedPayments=new Map();
 require('../services/print3dPaymentsServer.cjs').registerPrint3dPaymentRoutes(app,{pool,getCustomer,
  env:{MDV_PRINT3D_PAYMENTS_ENABLED:'1',MDV_PRINT3D_MP_ACCESS_TOKEN:'local-only',MDV_PRINT3D_MP_COLLECTOR_ID:'123',
   MDV_PRINT3D_MP_WEBHOOK_SECRET:'local-only',MDV_PRINT3D_MP_NOTIFICATION_URL:'https://example.test/print3d/payments/webhook'},
  adapter:{get:async id=>{assert(simulatedPayments.has(String(id)));return simulatedPayments.get(String(id));},create:async charge=>{
   assert.equal(charge.stage,'balance');
   const payment={id:String(992000+simulatedPayments.size),collector_id:'123',currency_id:'BRL',payment_method_id:'pix',
    external_reference:`print3d:${charge.id}`,transaction_amount:Number(charge.amount_cents)/100,status:'pending',
    point_of_interaction:{transaction_data:{qr_code:'LOCAL-TEST-NOT-A-PAYABLE-PIX'}}};
   simulatedPayments.set(payment.id,payment);return payment;
  }}});
 require('../services/print3dCheckoutServer.cjs').registerPrint3dCheckoutRoutes(app,{pool,getCustomer,companyId,enabled:true,dispatchEnabled:true,loadQuote,
  verifyShipping:async({token})=>freight.get(token)});
 const order=async(token,quantity=2)=>{
  const quote=await loadQuote(pool,[{product_id:productId,quantity}]);const quoteToken=randomUUID();
  freight.set(quoteToken,{option:{id:'local-freight',price_cents:500},subtotal_cents:quote.paymentSchedule.subtotal,items_fingerprint:quoteItemsFingerprint(quote.items),production_days:3,handling_business_days:1});
  return app.inject({method:'POST',url:'/print3d/checkout',headers:{authorization:'Bearer '+token},payload:{idempotency_key:randomUUID(),items:[{product_id:productId,quantity}],
   quote_token:quoteToken,shipping_option_id:'local-freight',payment_terms:{initial_payment_bps:7000,shipping_payment_mode:'split'},
   phone_verified_at:'forged-client-value',shipping_address:{cep:'56300000',street:'Rua Teste',number:'1',neighborhood:'Centro',city:'Petrolina',state:'PE'}}});
 };
 const verify=async({emailToken,phoneToken,phoneCustomerId})=>{
  assert.equal((await order('legacy-mdv-token')).statusCode,401);
  const denied=await order(emailToken);assert.equal(denied.statusCode,403,denied.body);assert.match(denied.json().error,/WhatsApp/);
  const [[untouched]]=await pool.query('SELECT SUM(reserved_quantity) reserved FROM product_stock_locations WHERE product_id=?',[productId]);assert.equal(Number(untouched.reserved),0);
  const ready=await order(emailToken,1);assert.equal(ready.statusCode,200,ready.body);assert.equal(ready.json().order.items[0].preorder_quantity,0);
  const accepted=await order(phoneToken);assert.equal(accepted.statusCode,200,accepted.body);
  const created=accepted.json().order;
  assert.equal(created.items[0].preorder_quantity,2);assert.equal(created.total_cents,2500);
  assert.equal(created.payment_schedule.initial_cents,1750);
  assert.deepEqual(created.items[0].variant_snapshot,originalVariant);
  await pool.query('UPDATE products SET specs=? WHERE id=?',[JSON.stringify({material:'PETG',color:'Azul',size:'P',finish:'Brilhante'}),productId]);
  const historical=await app.inject({url:'/print3d/orders/'+created.id,headers:{authorization:'Bearer '+phoneToken}});
  assert.equal(historical.statusCode,200,historical.body);
  assert.deepEqual(historical.json().order.items[0].variant_snapshot,originalVariant);
  for (const [url,token] of [['/print3d/production',phoneToken],['/admin/print3d/production','local-production-admin']]) {
   const response=await app.inject({url,headers:{authorization:'Bearer '+token}});
   assert.equal(response.statusCode,200,response.body);
   const production=response.json().jobs.find(value=>value.order_id===created.id);
   assert(production);assert.deepEqual(production.variant_snapshot,originalVariant);
  }
  await pool.query('UPDATE products SET specs=? WHERE id=?',[JSON.stringify(originalVariant),productId]);
  const [[persisted]]=await pool.query('SELECT storefront,customer_id,print3d_customer_id FROM orders WHERE id=?',[created.id]);
  assert.equal(persisted.storefront,'loja_3d');assert.equal(persisted.customer_id,null);assert.equal(persisted.print3d_customer_id,phoneCustomerId);
  const [[job]]=await pool.query('SELECT target_quantity,status,recipe_id,primary_file_id FROM print3d_production_jobs WHERE order_id=?',[created.id]);
  assert.equal(job.target_quantity,2);assert.equal(job.status,'awaiting_payment');assert.equal(job.recipe_id,recipeId);assert.equal(job.primary_file_id,fileId);
  const otherCustomer=await app.inject({url:'/print3d/orders/'+created.id,headers:{authorization:'Bearer '+emailToken}});
  assert.equal(otherCustomer.statusCode,404,'another 3D account cannot read this order');
 };
 verify.productId=productId;
 verify.approvePayment=chargeId=>{
  const payment=[...simulatedPayments.values()].find(value=>value.external_reference===`print3d:${chargeId}`);assert(payment);
  payment.status='approved';payment.date_approved=new Date().toISOString();
 };
 return verify;
};
