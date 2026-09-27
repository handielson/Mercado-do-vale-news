const test=require('node:test');
const assert=require('node:assert/strict');
const Fastify=require('fastify');
const fs=require('node:fs');
const vm=require('node:vm');
const {registerPrint3dCustomerAccountRoutes}=require('../services/print3dCustomerAccountsServer.cjs');
const {registerPrint3dProductionRoutes}=require('../services/print3dProductionServer.cjs');
const {signPrint3dCustomerSession}=require('../services/print3dCustomerSession.cjs');

test('produção desligada informa disponibilidade sem consultar banco, preservando autenticação e bloqueio de escrita',async t=>{
 const app=Fastify();t.after(()=>app.close());
 registerPrint3dProductionRoutes(app,{enabled:false,pool:{query:async()=>{throw Error('Banco não deve ser consultado');}},getCustomer:async()=>null,
   getBearerAuthContext:async req=>req.headers.authorization==='Bearer admin-test'?{isAdmin:true,userId:'admin-test'}:null});
 assert.equal((await app.inject('/admin/print3d/production')).statusCode,401);
 const headers={authorization:'Bearer admin-test'};
 const result=await app.inject({url:'/admin/print3d/production',headers});
 assert.equal(result.statusCode,200);assert.deepEqual(result.json(),{enabled:false,jobs:[]});
 assert.equal(result.headers['cache-control'],'no-store');
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/production/job/progress',headers,payload:{approved_quantity:20}})).statusCode,503);
 assert.equal((await app.inject('/admin/print3d/materials')).statusCode,401);
 assert.equal((await app.inject({url:'/admin/print3d/materials',headers})).statusCode,503);
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/materials/receipts',payload:{quantity_grams:100}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/materials/receipts',headers,payload:{quantity_grams:100}})).statusCode,503);
 assert.equal((await app.inject('/admin/print3d/supplies')).statusCode,401);
 assert.equal((await app.inject({url:'/admin/print3d/supplies',headers})).statusCode,503);
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/supplies/receipts',payload:{quantity_units:1}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/supplies/receipts',headers,payload:{quantity_units:1}})).statusCode,503);
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/orders/order/dispatch',payload:{tracking_code:'ABC123'}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/admin/print3d/orders/order/dispatch',headers,payload:{tracking_code:'ABC123'}})).statusCode,503);
});

test('produção habilitada mantém erros reais de banco visíveis',async t=>{
 const app=Fastify();t.after(()=>app.close());
 registerPrint3dProductionRoutes(app,{enabled:true,pool:{query:async()=>{throw Error('offline');}},getCustomer:async()=>null,getBearerAuthContext:async()=>({isAdmin:true,userId:'admin-test'})});
 assert.equal((await app.inject('/admin/print3d/production')).statusCode,500);
});
test('expedição exige flag própria e sessão administrativa mesmo com produção habilitada',async t=>{
 const app=Fastify();t.after(()=>app.close());
 registerPrint3dProductionRoutes(app,{enabled:true,dispatchEnabled:false,pool:{getConnection:async()=>{throw Error('Banco não deve ser consultado');}},
   getCustomer:async()=>null,getBearerAuthContext:async req=>req.headers.authorization==='Bearer admin-test'?{isAdmin:true,userId:'admin-test'}:null});
 const url='/admin/print3d/orders/11111111-1111-4111-8111-111111111111/dispatch';
 assert.equal((await app.inject({method:'POST',url,payload:{tracking_code:'ABC123'}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url,headers:{authorization:'Bearer admin-test'},payload:{tracking_code:'ABC123'}})).statusCode,503);
});
test('expedição habilitada valida rastreio antes de acessar o banco',async t=>{
 const app=Fastify();t.after(()=>app.close());
 registerPrint3dProductionRoutes(app,{enabled:true,dispatchEnabled:true,pool:{getConnection:async()=>{throw Error('Banco não deve ser consultado');}},
   getCustomer:async()=>null,getBearerAuthContext:async()=>({isAdmin:true,userId:'admin-test'})});
 const response=await app.inject({method:'POST',url:'/admin/print3d/orders/11111111-1111-4111-8111-111111111111/dispatch',
   payload:{tracking_code:'código inválido'}});
 assert.equal(response.statusCode,400);assert.match(response.json().error,/rastreio inválido/);
});
test('rota de produção usa autenticação real da conta 3D e revoga sessão antiga',async t=>{
 const app=Fastify();t.after(()=>app.close());
 const secret='local-fixture-secret-longer-than-32-characters',customerId='11111111-1111-4111-8111-111111111111';
 let version=1,scopes=[];
 const pool={query:async(sql,params)=>{
   if(sql.includes('FROM print3d_customers c')) return [[{id:customerId,is_active:1,email_verified_at:'2026-01-01',auth_version:version}]];
   if(sql.includes('FROM print3d_production_jobs')) {scopes.push(params);return [[]];}
   throw new Error('unexpected SQL');
 }};
 const accounts=registerPrint3dCustomerAccountRoutes(app,{pool,authSecret:secret,enabled:true,publicUrl:'https://3d.example.test',fromEmail:'teste@3d.example.test',brandName:'3D',
   sendEmail:async()=>{throw new Error('no sending');},security:{verifyCaptcha:async()=>{},login:async()=>{},clearAccount:async()=>{}}});
 registerPrint3dProductionRoutes(app,{pool,getCustomer:accounts.getCustomer,getBearerAuthContext:async()=>null,enabled:true});
 const get=token=>app.inject({method:'GET',url:'/print3d/production?customer_id=another',headers:token?{authorization:'Bearer '+token}:{}});
 assert.equal((await get()).statusCode,401);
 assert.equal((await get('mdv-token')).statusCode,401);
 const token=signPrint3dCustomerSession(customerId,secret);
 assert.equal((await get(token)).statusCode,200);
 assert.deepEqual(scopes,[[customerId]]);
 version=2;
 assert.equal((await get(token)).statusCode,401);
 assert.equal(scopes.length,1);
});
for(const file of ['vps_server.cjs','vps_server.js']) test(file+': CRUD genérico não contorna validação financeira ou de produção',()=>{
 const source=fs.readFileSync(file,'utf8');
 const section=source.slice(source.indexOf('const TABLE_DATA_BLOCKED_TABLES'),source.indexOf('function normalizeTableDataValue'));
 const context={};vm.runInNewContext(section+';this.check=isValidTable;',context);
 for(const table of ['print3d_production_jobs','print3d_production_events','print3d_production_outputs','print3d_filament_stock','print3d_filament_movements','print3d_supply_stock','print3d_supply_movements','print3d_order_plans','print3d_order_item_plans','print3d_order_payment_receipts','print3d_checkout_requests','print3d_order_shipping','print3d_order_stock_reservations','print3d_payment_charges','print3d_order_cancellation_events','print3d_order_dispatches']) {
   assert.equal(context.check(table),false);
   assert.equal(context.check(table.toUpperCase()),false);
 }
 assert.match(source,/require\('\.\/services\/orderStockReservation\.cjs'\)\.processOrderReservation/);
 const reservationSource=fs.readFileSync('services/orderStockReservation.cjs','utf8');
 assert.match(reservationSource,/canUseMercadoDoValeOrderAutomation/);
 assert.match(source,/if \(existingOrders\[0\]\?\.storefront === 'loja_3d'\) return reply\.code\(403\)/);
});
