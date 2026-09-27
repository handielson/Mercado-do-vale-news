const test=require('node:test');
const assert=require('node:assert/strict');
const Fastify=require('fastify');
const fs=require('node:fs');
const vm=require('node:vm');
const {registerPrint3dCustomerAccountRoutes}=require('../services/print3dCustomerAccountsServer.cjs');
const {registerPrint3dProductionRoutes}=require('../services/print3dProductionServer.cjs');
const {signPrint3dCustomerSession}=require('../services/print3dCustomerSession.cjs');
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
 for(const table of ['print3d_production_jobs','print3d_production_events','print3d_order_plans','print3d_order_item_plans','print3d_order_payment_receipts','print3d_checkout_requests','print3d_order_shipping','print3d_order_stock_reservations','print3d_payment_charges']) {
   assert.equal(context.check(table),false);
   assert.equal(context.check(table.toUpperCase()),false);
 }
});
