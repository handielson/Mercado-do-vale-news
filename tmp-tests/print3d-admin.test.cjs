'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {registerPrint3dAdminRoutes} = require('../services/print3dAdminServer.cjs');
function fixture(options={}) {
  const routes=new Map(),queries=[];
  const pool={query:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.startsWith('SELECT COUNT')) return [[{total:1}]];
    return [[{id:'3d-only',name:'Cliente 3D',email:'sample@example.test',phone:null,is_active:1,
      email_verified_at:null,phone_verified_at:null,created_at:'2026-09-27',password_hash:'NEVER',
      cpf_cnpj:'NEVER',salt:'NEVER',public_number:42,total:11000,subtotal:10000,shipping_cost:1000,
      pending_cancellations:'2',late_payments:'1',late_amount_cents:'5000',confirmed_cents:5000,print3d_customer_id:'3d-only',customer_name:'Cliente 3D',
      status:'pending',payment_status:'pending',due_on_confirmation_cents:5000,due_before_shipping_cents:6000,
      initial_payment_bps:5000,shipping_payment_mode:'later'}]];
  }};
  registerPrint3dAdminRoutes({get:(url,config,handler)=>routes.set(url,{config,handler})},{
    pool,getBearerAuthContext:async()=>options.auth === undefined ? {isAdmin:true,userId:'admin'} : options.auth,
    customersEnabled:options.enabled===true,ordersEnabled:options.enabled===true});
  async function get(kind,query={}) {
    const route=routes.get('/admin/print3d/'+kind);
    const reply={status:200,headers:{},header(k,v){this.headers[k]=v;return this;},code(n){this.status=n;return this;},
      send(body){this.sent=true;this.body=body;return this;}};
    const request={query};
    await route.config.preHandler(request,reply);
    if(!reply.sent) reply.body=await route.handler(request,reply);
    return reply;
  }
  return {get,queries};
}
for(const kind of ['customers','orders']) {
  test(kind+': disabled lists are authenticated and never touch SQL',async()=>{
    for(const auth of [null,{isAdmin:false,userId:'customer'},{isAdmin:true}]) {
      const f=fixture({auth});
      const response=await f.get(kind);
      assert.equal(response.status,401);assert.equal(f.queries.length,0);
    }
    const f=fixture(),response=await f.get(kind);
    assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'no-store');
    assert.deepEqual(response.body,{enabled:false,dispatch_enabled:false,storefront:'loja_3d',items:[],total:0,page:1,page_size:25});
    assert.equal(f.queries.length,0);
  });
  test(kind+': bounded pagination and parameterized search',async()=>{
    const f=fixture({enabled:true});
    for(const query of [{page:0},{page:1.5},{page:10001},{page_size:101},{search:[]},{search:'x'.repeat(121)}]) {
      assert.equal((await f.get(kind,query)).status,400);
    }
    assert.equal(f.queries.length,0);
    const attack="' OR 1=1 --";
    const response=await f.get(kind,{page:'2',page_size:'10',search:attack});
    assert.equal(response.body.page,2);assert.equal(response.body.total,1);
    assert.deepEqual(f.queries[1].args.slice(-2),[10,10]);
    for(const query of f.queries) {assert.ok(!query.sql.includes(attack));assert.ok(query.args.includes(attack));}
    assert.ok(!JSON.stringify(response.body).includes('NEVER'));
  });
}
test('3D customer list never queries MDV customers or authentication tables',async()=>{
  const f=fixture({enabled:true});
  await f.get('customers');
  for(const {sql} of f.queries) {
    assert.match(sql,/FROM print3d_customers c/);
    assert.doesNotMatch(sql,/\b(?:FROM|JOIN) customers\b|customer_auth|password_hash|cpf_cnpj|SELECT \*/);
  }
});
test('3D order count and data always enforce the same storefront and isolated customer relation',async()=>{
  const f=fixture({enabled:true});
  const response=await f.get('orders');
  for(const {sql} of f.queries) {
    assert.match(sql,/o.storefront='loja_3d' AND o.customer_id IS NULL/);
    assert.match(sql,/JOIN print3d_customers c ON c.id=o.print3d_customer_id/);
    assert.doesNotMatch(sql,/\bJOIN customers\b|SELECT o\.\*/);
  }
  assert.match(f.queries[1].sql,/print3d_order_payment_receipts r WHERE r.order_id=o.id AND r.status='confirmed'/);
  const order=response.body.items[0];
  assert.equal(order.order_number,'3D-42');
  assert.equal(order.total_cents,11000);assert.equal(order.confirmed_cents,5000);
  assert.equal(order.outstanding_cents,6000);
  assert.deepEqual(order.payment_review,{pending_cancellations:2,refunded_payments:0,late_payments:1,late_amount_cents:5000});
  assert.equal(order.customer.id,'3d-only');
  assert.equal(order.payment_schedule.shipping_payment_mode,'later');
});
test('both runtime entries register the isolated admin module with the existing checkout gate',()=>{
  for(const file of ['vps_server.cjs','vps_server.js']) {
    const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    assert.match(source,/require\('\.\/services\/print3dAdminServer.cjs'\).registerPrint3dAdminRoutes/);
    assert.match(source,/ordersEnabled: print3dCheckoutEnabled/);
    assert.match(source,/enabled: print3dCheckoutEnabled/);
  }
  assert.ok(fs.readFileSync(path.join(__dirname,'..','deploy-vps-server-only.cjs'),'utf8').includes("'services/print3dAdminServer.cjs'"));
});
