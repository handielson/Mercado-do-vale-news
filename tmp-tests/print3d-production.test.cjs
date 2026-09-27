'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validateProgress,projectJob,recordProductionProgress,listProductionJobs,releaseProductionJobsOnConnection,createProductionJobsOnConnection,readPinnedFiles } = require('../services/print3dProduction.cjs');
const { registerPrint3dProductionRoutes } = require('../services/print3dProductionServer.cjs');
const orderId=randomUUID(),jobId=randomUUID();
function fixture(status='queued',recipeSupplies=[]) {
  const state = {job:{id:jobId,order_id:orderId,order_number:'3D-1',order_item_id:randomUUID(),product_id:randomUUID(),product_name:'Peça',sku:'P1',target_quantity:100,approved_quantity:0,rejected_quantity:0,status,recipe_id:'private',primary_file_id:'private'},events:[],outputs:[],movements:[],stock:{ 'filament-pla':1000,'filament-petg':50 },supplyStock:{argola:30,'packaging-per-piece':30},supplyMovements:[],order:{id:orderId,storefront:'loja_3d',print3d_customer_id:'client-a',status:'pending',payment_status:'pending',subtotal:10000,discount:0,total:10000,shipping_cost:0},confirmed:0,queries:[],rollbacks:0};
  state.confirmed=5000;
  let queue=Promise.resolve();
  const query=async(sql,args=[])=>{
    state.queries.push(sql);
    if(sql.startsWith('SELECT order_id')) return [[{order_id:orderId}]];
    if(sql.includes('FROM orders WHERE')) return [[state.order]];
    if(sql.includes('FROM print3d_order_plans')) return [[{due_on_confirmation_cents:5000,subtotal_cents:10000,ready_amount_cents:0,preorder_amount_cents:10000,deposit_amount_cents:5000,due_before_shipping_cents:5000}]];
    if(sql.includes('SUM(amount_cents)')) return [[{confirmed_cents:state.confirmed}]];
    if(sql.startsWith('SELECT id,draft_json FROM print3d_recipe_revisions')) return [[{id:state.job.recipe_id,draft_json:{productId:state.job.product_id,sku:state.job.sku,filaments:[{id:'filament-pla',name:'PLA',color:'Preto',consumedGrams:10},{id:'filament-petg',name:'PETG',color:'Branco',consumedGrams:5}],supplies:recipeSupplies}}]];
    if(sql.startsWith('SELECT quantity_grams FROM print3d_filament_stock')) return [state.stock[args[0]] === undefined ? [] : [{quantity_grams:state.stock[args[0]]}]];
    if(sql.startsWith('UPDATE print3d_filament_stock SET quantity_grams=quantity_grams-')) {if(state.stock[args[1]] < args[2])return [{affectedRows:0}];state.stock[args[1]]-=args[0];return [{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO print3d_filament_movements')) {state.movements.push({filament_id:args[1],production_event_id:args[3],quantity_delta_grams:args[4]});return [{}];}
    if(sql.startsWith('SELECT quantity_units,unit_snapshot FROM print3d_supply_stock')) return [state.supplyStock[args[0]] === undefined ? []:[{quantity_units:state.supplyStock[args[0]],unit_snapshot:'un'}]];
    if(sql.startsWith('UPDATE print3d_supply_stock SET quantity_units=quantity_units-')) {if(state.supplyStock[args[1]] < args[2])return [{affectedRows:0}];state.supplyStock[args[1]]-=args[0];return [{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO print3d_supply_movements')) {state.supplyMovements.push({supply_id:args[1],production_event_id:args[3],quantity_delta_units:args[4]});return [{}];}
    if(sql.includes('WHERE job_id=? AND idempotency_key=?')) return [state.events.filter(e=>e.idempotency_key===args[1])];
    if(sql.startsWith('INSERT INTO print3d_production_events')) {
      const [id,job_id,idempotency_key,payload_hash,approved_quantity,rejected_quantity,material_consumed_grams,note,actor_id]=args;
      state.events.push({id,job_id,idempotency_key,payload_hash,approved_quantity,rejected_quantity,material_consumed_grams,note,actor_id,created_at:'2026-09-27T00:00:00Z'});return [{}];
    }
    if(sql.startsWith('INSERT INTO print3d_production_outputs')) {
      const [id,job_id,production_event_id,order_id,order_item_id,product_id,quantity]=args;
      state.outputs.push({id,job_id,production_event_id,order_id,order_item_id,product_id,quantity,status:'reserved_for_order'});return [{}];
    }
    if(sql.startsWith('UPDATE print3d_production_jobs SET approved')) {
      [state.job.approved_quantity,state.job.rejected_quantity,state.job.status]=args;return [{}];
    }
    if(sql.startsWith("UPDATE print3d_production_jobs SET status='queued'")) {state.job.status='queued';return [{affectedRows:1}];}
    if(sql.includes('FROM print3d_production_events')) return [state.events];
    if(sql.includes('FROM print3d_production_outputs')) return [state.outputs.filter(output=>args.includes(output.job_id))];
    if(sql.includes('FROM print3d_production_jobs j')) {
      const customer=args.find(a=>a==='client-a'||a==='client-b');
      return [customer==='client-b'?[]:[{...state.job}]];
    }
    if(sql.includes('FROM print3d_production_jobs')) return [[{...state.job}]];
    throw new Error('Unexpected query: '+sql);
  };
  const pool={query,getConnection:async()=>{
    let unlock;
    let snapshot;
    return {query,beginTransaction:async()=>{const previous=queue;queue=new Promise(r=>{unlock=r});await previous;snapshot=structuredClone({job:state.job,events:state.events,outputs:state.outputs,movements:state.movements,stock:state.stock,supplyStock:state.supplyStock,supplyMovements:state.supplyMovements});},
      commit:async()=>{},rollback:async()=>{state.rollbacks++;Object.assign(state,snapshot);},release:()=>unlock()};
  }};
  return {pool,state};
}
const body=(approved,rejected=0)=>({idempotency_key:randomUUID(),approved_quantity:approved,rejected_quantity:rejected,material_consumed_grams:10,filaments:[{filament_id:'filament-pla',consumed_grams:10}]});
test('validates integer deltas, empty events, note limit and UUID',()=>{
  for(const b of [body(-1),body(0),body(1.5),body('1'),{...body(1),material_consumed_grams:-0.001},{...body(1),material_consumed_grams:1.0001},{...body(1),filaments:[]},{...body(1),filaments:[{filament_id:'filament-pla',consumed_grams:9}]},{...body(1),note:'x'.repeat(2001)},{...body(1),idempotency_key:'x'}]) assert.throws(()=>validateProgress(b));
  assert.equal(validateProgress(body(0,2)).rejected_quantity,2);
});
test('20 of 100 plus rejects: partial progress is approved units only',async()=>{
  const {pool,state}=fixture();
  const result=await recordProductionProgress(pool,{jobId,actorId:'admin',body:{...body(20,3),note:'internal'}});
  assert.equal(result.job.approved_quantity,20);assert.equal(result.job.target_quantity,100);
  assert.equal(result.job.status,'in_progress');assert.equal(result.job.rejected_quantity,3);
  assert.equal(result.job.material_consumed_grams,10);assert.equal(result.job.history[0].material_consumed_grams,10);
  assert.equal(result.job.reserved_for_order_quantity,20);
  assert.equal(state.outputs.length,1);assert.equal(state.outputs[0].quantity,20);
  assert.equal(state.stock['filament-pla'],990);assert.equal(state.movements.length,1);
  const customer=projectJob(state.job,state.events);
  assert.equal(customer.history[0].approved_quantity,20);
  assert.equal(JSON.stringify(customer).includes('internal'),false);
  for(const key of ['rejected_quantity','material_consumed_grams','recipe_id','primary_file_id','actor_id','note','supplies']) assert.equal(key in customer,false);
});
test('same idempotency key replays, conflicting payload fails',async()=>{
  const {pool,state}=fixture();const input={jobId,actorId:'admin',body:body(20)};
  await recordProductionProgress(pool,input);
  assert.equal((await recordProductionProgress(pool,input)).replayed,true);
  await assert.rejects(recordProductionProgress(pool,{...input,body:{...input.body,approved_quantity:21}}),{statusCode:409});
  assert.equal(state.job.approved_quantity,20);assert.equal(state.events.length,1);assert.equal(state.outputs.length,1);assert.equal(state.stock['filament-pla'],990);
});
test('sem saldo em um filamento, desfaz consumo, apontamento e peça reservada',async()=>{
  const {pool,state}=fixture();state.stock['filament-petg']=2;
  const input={...body(5),material_consumed_grams:15,filaments:[{filament_id:'filament-pla',consumed_grams:10},{filament_id:'filament-petg',consumed_grams:5}]};
  await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:input}),{statusCode:409});
  assert.equal(state.stock['filament-pla'],1000);assert.equal(state.stock['filament-petg'],2);
  assert.equal(state.events.length,0);assert.equal(state.movements.length,0);assert.equal(state.outputs.length,0);
});
test('dois filamentos baixam uma vez e só quando constam na ficha da ordem',async()=>{
  const {pool,state}=fixture();
  const input={...body(5),material_consumed_grams:15,filaments:[{filament_id:'filament-petg',consumed_grams:5},{filament_id:'filament-pla',consumed_grams:10}]};
  await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:{...input,filaments:[{filament_id:'filament-unknown',consumed_grams:15}]}}),{statusCode:409});
  const first=await recordProductionProgress(pool,{jobId,actorId:'admin',body:input});
  assert.equal(first.job.approved_quantity,5);assert.equal(first.job.material_consumed_grams,15);
  assert.equal(state.stock['filament-pla'],990);assert.equal(state.stock['filament-petg'],45);
  assert.equal(state.movements.length,2);
  assert.equal((await recordProductionProgress(pool,{jobId,actorId:'admin',body:input})).replayed,true);
  assert.equal(state.movements.length,2);
});
test('argolas e embalagem da ficha baixam quantidades reais uma única vez',async()=>{
  const recipe=[{id:'argola',name:'Argola',unitLabel:'un',quantity:2},{id:'packaging-per-piece',name:'Embalagem por peça',unitLabel:'un',quantity:2}];
  const {pool,state}=fixture('queued',recipe);
  const input={...body(2),supplies:[{supply_id:'argola',consumed_quantity:2},{supply_id:'packaging-per-piece',consumed_quantity:2}]};
  await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:body(2)}),/todos os insumos/);
  const saved=await recordProductionProgress(pool,{jobId,actorId:'admin',body:input});
  assert.equal(saved.job.supplies.length,2);assert.equal(state.supplyStock.argola,28);
  assert.equal(state.supplyStock['packaging-per-piece'],28);assert.equal(state.supplyMovements.length,2);
  assert.equal((await recordProductionProgress(pool,{jobId,actorId:'admin',body:input})).replayed,true);
  assert.equal(state.supplyMovements.length,2);
  const zero={...body(1),supplies:[{supply_id:'argola',consumed_quantity:0},{supply_id:'packaging-per-piece',consumed_quantity:0}]};
  await recordProductionProgress(pool,{jobId,actorId:'admin',body:zero});
  assert.equal(state.supplyStock.argola,28);
});
test('falta de um insumo reverte também filamento, evento e peça produzida',async()=>{
  const {pool,state}=fixture('queued',[{id:'argola',name:'Argola',unitLabel:'un',quantity:2}]);
  state.supplyStock.argola=1;
  const input={...body(2),supplies:[{supply_id:'argola',consumed_quantity:2}]};
  await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:input}),/Saldo físico insuficiente/);
  assert.equal(state.supplyStock.argola,1);assert.equal(state.stock['filament-pla'],1000);
  assert.equal(state.events.length,0);assert.equal(state.outputs.length,0);assert.equal(state.movements.length,0);
});
test('concurrent batches cannot exceed requested quantity',async()=>{
  const {pool,state}=fixture();
  const results=await Promise.allSettled([60,60].map(n=>recordProductionProgress(pool,{jobId,actorId:'admin',body:body(n)})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(state.job.approved_quantity,60);assert.equal(state.events.length,1);
});
test('completion and replay survive final state, extra batches rejected',async()=>{
  const {pool,state}=fixture();const input={jobId,actorId:'admin',body:body(100)};
  await recordProductionProgress(pool,input);
  assert.equal(state.job.status,'completed');
  assert.equal((await recordProductionProgress(pool,input)).replayed,true);
  await assert.rejects(recordProductionProgress(pool,{...input,body:body(1)}),{statusCode:409});
});
for(const status of ['awaiting_payment','cancelled','completed']) test('blocks progress in '+status,async()=>{
  const {pool,state}=fixture(status);
  await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:body(20)}),{statusCode:409});
  assert.equal(state.events.length,0);
});
test('customer listing scopes orders and hides rejection-only history',async()=>{
  const {pool,state}=fixture();
  await recordProductionProgress(pool,{jobId,actorId:'admin',body:body(0,2)});
  assert.deepEqual(await listProductionJobs(pool,{customerId:'client-b'}),[]);
  assert.deepEqual((await listProductionJobs(pool,{customerId:'client-a'}))[0].history,[]);
  await assert.rejects(listProductionJobs(pool,{}),{statusCode:401});
});
test('paid legacy flag cannot release without verified ledger; enough ledger releases',async()=>{
  const {pool,state}=fixture('awaiting_payment');state.order.payment_status='paid';state.confirmed=0;
  await assert.rejects(releaseProductionJobsOnConnection(pool,{orderId}),{statusCode:409});
  state.confirmed=5000;
  assert.equal((await releaseProductionJobsOnConnection(pool,{orderId})).released,1);
});
test('cancelled or refunded order blocks progress and release',async()=>{
  for(const change of [{status:'cancelled'},{payment_status:'refunded'}]){
    const {pool,state}=fixture();Object.assign(state.order,change);
    await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:body(1)}),{statusCode:409});
    await assert.rejects(releaseProductionJobsOnConnection(pool,{orderId}),{statusCode:409});
  }
});
test('queued status alone cannot bypass unpaid or partial initial payment',async()=>{
  for(const confirmed of [0,4999]) {
    const {pool,state}=fixture();state.confirmed=confirmed;
    await assert.rejects(recordProductionProgress(pool,{jobId,actorId:'admin',body:body(20)}),{statusCode:409});
    assert.equal(state.events.length,0);
  }
});
test('routes require correct principal and expose no create/release endpoint',async()=>{
  const routes=[];const app={get:(url,opts,handler)=>routes.push({url,opts,handler}),post:(url,opts,handler)=>routes.push({url,opts,handler})};
  registerPrint3dProductionRoutes(app,{pool:{},getBearerAuthContext:async()=>({isAdmin:false}),getCustomer:async()=>null,enabled:true});
  assert.equal(routes.length,8);
  for(const route of routes){const reply={header(){return this},code(n){this.status=n;return this},send(){return this}};
    await route.opts.preHandler({},reply);assert.equal(reply.status,401);}
});
test('arquivo da OP só é mostrado se revisão, SKU, produto e arquivo principal coincidirem',async()=>{
  const job={id:jobId,product_id:'product-1',sku:'SKU-1',recipe_id:'recipe-1',primary_file_id:'file-1'};
  const row={job_id:jobId,recipe_id:'recipe-1',primary_file_id:'file-1',recipe_product_id:'product-1',sku_snapshot:'SKU-1',
    revision:'r1',file_id:'file-1',file_recipe_id:'recipe-1',kind:'gcode',original_name:'SKU-1.gcode',printer_profile:'Bambu PLA',sha256:'a'.repeat(64),byte_size:123};
  const connection={query:async()=>[[row]]};
  assert.equal((await readPinnedFiles(connection,[job])).get(jobId).original_name,'SKU-1.gcode');
  for(const change of [{file_recipe_id:'outro'},{recipe_product_id:'outro'},{sku_snapshot:'outro'},{printer_profile:null}]) {
    connection.query=async()=>[[{...row,...change}]];
    assert.equal((await readPinnedFiles(connection,[job])).get(jobId),null);
  }
});
test('creation snapshots planned preorder quantity and selected recipe only once',async()=>{
  const inserts=[];
  const connection={query:async(sql,args)=>{
    if(sql.includes('FROM orders')) return [[{id:orderId,storefront:'loja_3d',print3d_customer_id:'client-a',status:'pending'}]];
    if(sql.includes('FROM print3d_order_plans')) return [[{public_number:42}]];
    if(sql.includes('FROM print3d_order_item_plans')) return [[{order_item_id:'item',product_id:'product',product_name:'Peça',product_sku:'P1',preorder_quantity:80,recipe_id:'revision-1',primary_file_id:'file-1',recipe_sku:'P1',primary_file_kind:'gcode',primary_printer_profile:'PLA'}]];
    if(sql.startsWith('SELECT id FROM print3d_production_jobs')) return [inserts.length?[{id:'job'}]:[]];
    if(sql.startsWith('INSERT INTO print3d_production_jobs')) {inserts.push({sql,args});return [{}];}
    throw new Error(sql);
  }};
  await createProductionJobsOnConnection(connection,{orderId});
  await createProductionJobsOnConnection(connection,{orderId});
  assert.equal(inserts.length,1);assert.equal(inserts[0].args[7],80);
  assert.equal(inserts[0].args[2],'3D-42');assert.equal(inserts[0].args[8],'revision-1');
  assert.match(inserts[0].sql,/awaiting_payment/);
});
test('creation refuses a selected revision or print file that no longer matches the SKU',async()=>{
  const valid={order_item_id:'item',product_id:'product',product_name:'Peça',product_sku:'P1',preorder_quantity:1,
    recipe_id:'revision-1',primary_file_id:'file-1',recipe_sku:'P1',primary_file_kind:'gcode',primary_printer_profile:'PLA'};
  for(const change of [{recipe_sku:'P2'},{primary_file_kind:null},{primary_printer_profile:null}]) {
    let inserted=false;
    const connection={query:async(sql)=>{
      if(sql.includes('FROM orders')) return [[{id:orderId,storefront:'loja_3d',print3d_customer_id:'client-a',status:'pending'}]];
      if(sql.includes('FROM print3d_order_plans')) return [[{public_number:42}]];
      if(sql.includes('FROM print3d_order_item_plans')) return [[{...valid,...change}]];
      if(sql.startsWith('SELECT id FROM print3d_production_jobs')) return [[]];
      if(sql.startsWith('INSERT INTO print3d_production_jobs')) {inserted=true;return [{}];}
      throw new Error(sql);
    }};
    await assert.rejects(createProductionJobsOnConnection(connection,{orderId}),{statusCode:409});
    assert.equal(inserted,false);
  }
});
test('production routes default disabled even for authorized admin',async()=>{
  const routes=[];const app={get:(url,opts,handler)=>routes.push({url,opts,handler}),post:()=>{}};
  registerPrint3dProductionRoutes(app,{pool:{query:()=>{throw Error('must not query')}},getBearerAuthContext:async()=>({isAdmin:true,userId:'admin'}),getCustomer:async()=>({id:'client-a'})});
  const reply={header(){return this},code(n){this.status=n;return this},send(){return this}};
  await routes[0].opts.preHandler({},reply);
  assert.deepEqual(await routes[0].handler({},reply),{enabled:false,jobs:[]});
  await routes[1].opts.preHandler({},reply);await routes[1].handler({},reply);
  assert.equal(reply.status,503);
});
