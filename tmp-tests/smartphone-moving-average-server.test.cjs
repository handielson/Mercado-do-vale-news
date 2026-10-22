'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const costs=require('../services/smartphoneMovingAverageServer.cjs');
const core=require('../services/smartphoneMovingAverageCore.cjs');
const Fastify=require('fastify');
const model={id:'model',name:'Phone',company_id:'company',category_name:'Smartphones'};
const product={id:'product',model_id:model.id,specs:{ram:'4GB',storage:'256GB',version:'Global'},price_retail:97200};
function fixture() {
  let data={saved:null,done:[],basis:[],events:[],units:[{id:'a',product_id:product.id,status:'available',cost_price:92500}],sales:[],items:[]};
  let snapshot; const queries=[];
  const db={
    beginTransaction:async()=>{snapshot=structuredClone(data);},
    commit:async()=>{},rollback:async()=>{data=snapshot;},release:()=>{},
    query:async(raw,args)=>{
      const sql=raw.replace(/\s+/g,' ').trim();queries.push(sql);
      if(sql.includes('SELECT DISTINCT m.id')||sql.includes('FROM models WHERE')) return [[model]];
      if(sql.includes('FROM smartphone_inventory_cost_state')) return [[structuredClone(data.saved)].filter(Boolean)];
      if(sql.includes('FROM unit_journal_events')) return [structuredClone(data.events.filter(e=>!data.done.includes(e.id)).sort((a,b)=>Number(a.id)-Number(b.id)))];
      if(sql.includes('FROM units u')) return [structuredClone(data.units)];
      if(sql.startsWith('SELECT * FROM products')) return [[product]];
      if(sql.startsWith('INSERT INTO smartphone_inventory_cost_state')) {data.saved={state:args[1],initialized_at:'2026-10-22 00:00:00'};return [{}];}
      if(sql.startsWith('INSERT IGNORE INTO smartphone_inventory_cost_events')) {data.done.push(args[1]);return [{}];}
      if(sql.startsWith('INSERT IGNORE INTO smartphone_sale_cost_basis')) {
        const [sale_id,unit_id,configuration_id,unit_cost,purchase_cost]=args;
        if(!data.basis.some(b=>b.sale_id===sale_id&&b.unit_id===unit_id)) data.basis.push({sale_id,unit_id,configuration_id,unit_cost,purchase_cost});return [{}];
      }
      if(sql.startsWith('SELECT id FROM sales')) return [data.sales.filter(s=>s.id===args[0]&&s.created_at<args[1])];
      if(sql.startsWith('SELECT * FROM sales')) return [data.sales.filter(s=>s.id===args[0]&&s.created_at>=args[1])];
      if(sql.includes('FROM smartphone_sale_cost_basis')) return [data.basis.filter(b=>b.sale_id===args[0]&&(!args[1]||b.unit_id===args[1]))];
      if(sql.startsWith('UPDATE sale_items SET unit_cost')) {data.items.filter(i=>i.sale_id===args[1]&&i.serialized_unit_id===args[2]).forEach(i=>i.unit_cost=args[0]);return [{}];}
      if(sql.includes('SUM(unit_cost*quantity)')) return [[{total:data.items.filter(i=>i.sale_id===args[0]).reduce((sum,i)=>sum+i.unit_cost*i.quantity,0)}]];
      if(sql.startsWith('UPDATE sales SET cost_total')) {Object.assign(data.sales.find(s=>s.id===args[2]),{cost_total:args[0],profit:args[1]});return [{}];}
      throw Error('Unexpected query: '+sql);
    },
  };
  const pool={getConnection:async()=>db};
  const receipt=(id,cost,eventId)=>{
    const unit={id,product_id:product.id,status:'available',cost_price:cost};data.units.push(unit);
    data.events.push({id:String(eventId),event_type:'unit_insert',before_data:null,after_data:JSON.stringify({product,unit})});
  };
  const persist=async()=>costs.save(db,await costs.load(db,model,{lock:true}));
  return {db,pool,receipt,persist,queries,data:()=>data};
}
test('preview projects current receipts without writing a baseline, journal acknowledgements or prices',async()=>{
  const f=fixture();
  const result=await costs.preview(f.pool,model);
  assert.equal(Object.values(result)[0].moving_average_cost,92500);
  assert.equal(Object.values(result)[0].moving_average_initialized,false);
  assert.equal(f.data().saved,null);
  assert.ok(f.queries.every(q=>q.startsWith('SELECT')));
});
test('journal acknowledgements handle late committed lower IDs and never count receipts twice',async()=>{
  const f=fixture();await f.persist();
  f.receipt('b',99900,100);await f.persist();
  f.receipt('c',117000,99);await f.persist();
  await f.persist();
  const state=JSON.parse(f.data().saved.state),g=Object.values(state.groups)[0];
  assert.equal(g.quantity,3);assert.equal(core.average(g),103133);
  assert.deepEqual(f.data().done,['100','99']);
  assert.equal(product.price_retail,97200);
  assert.ok(!f.queries.some(q=>/^(UPDATE|INSERT INTO) (products|units)\b/.test(q)));
});
test('other unit writers freeze a new sale cost and its totals; pre-activation sales remain unchanged',async()=>{
  const f=fixture();f.receipt('b',117500,1);await f.persist();
  f.data().sales.push({id:'sale',created_at:'2026-10-22 10:00:00',total:120000,delivery_total:200,payment_methods:'[{"operator_fee_amount":100}]'});
  f.data().items.push({sale_id:'sale',serialized_unit_id:'a',quantity:1,unit_cost:92500});
  const original={...f.data().units[0]};
  const sold={...original,status:'sold',sale_id:'sale'};f.data().units[0]=sold;
  f.data().events.push({id:'2',before_data:{product,unit:original},after_data:{product,unit:sold}});
  await f.persist();
  assert.equal(f.data().basis[0].unit_cost,105000);
  assert.equal(f.data().basis[0].purchase_cost,92500);
  assert.equal(f.data().items[0].unit_cost,105000);
  assert.equal(f.data().sales[0].profit,14700);
  assert.equal(f.data().units[0].cost_price,92500);
  const old={id:'old-sale',created_at:'2026-01-01',total:100000,cost_total:90000,profit:10000};
  const expectedOld=structuredClone(old);
  f.data().sales.push(old);
  const before={...f.data().units[1]},after={...before,status:'sold',sale_id:'old-sale'};f.data().units[1]=after;
  f.data().events.push({id:'3',before_data:{product,unit:before},after_data:{product,unit:after}});
  await f.persist();
  assert.equal(f.data().basis.length,1);
  assert.deepEqual(f.data().sales[1],expectedOld);
});
test('protected tables and saved cost basis cannot be overwritten through generic API',async t=>{
  const app=Fastify();t.after(()=>app.close());
  const {registerSmartphonePriceGroupRoutes}=require('../services/smartphonePriceGroupsServer.cjs');
  registerSmartphonePriceGroupRoutes(app,{pool:{query:async()=>[[{unit_cost:103133}]]},inventoryCosts:async()=>({}),
    requireSyncKey:async(req,reply)=>{if(req.headers['x-sync-key']!=='test')return reply.code(401).send({error:'unauthorized'});}});
  app.patch('/table-data/sale_items/:id',async()=>({ok:true}));
  assert.equal((await app.inject({url:'/sales/sale/cost-basis'})).statusCode,401);
  for(const table of ['smartphone_inventory_cost_state','smartphone_inventory_cost_events','smartphone_sale_cost_basis']) {
    assert.equal((await app.inject({method:'POST',url:'/table-data/'+table,payload:{}})).statusCode,403);
  }
  assert.equal((await app.inject({method:'PATCH',url:'/table-data/sale_items/item',payload:{unit_cost:92500}})).statusCode,409);
  assert.equal((await app.inject({method:'PATCH',url:'/table-data/sale_items/item',payload:{unit_cost:103133}})).statusCode,200);
});
test('pre-activation sale costs/profit are immutable while cancellation remains available',async t=>{
  const app=Fastify();t.after(()=>app.close());
  require('../services/smartphonePriceGroupsServer.cjs').registerSmartphonePriceGroupRoutes(app,{pool:{query:async()=>[[{historical:1,unit_cost:77200,cost_total:77200,profit:20000}]]},inventoryCosts:async()=>({}),requireSyncKey:async()=>{}});
  app.patch('/table-data/sale_items/:id',async()=>({ok:true}));app.patch('/table-data/sales/:id',async()=>({ok:true}));
  assert.equal((await app.inject({method:'PATCH',url:'/table-data/sale_items/old',payload:{unit_cost:103133}})).statusCode,409);
  assert.equal((await app.inject({method:'PATCH',url:'/table-data/sales/old',payload:{cost_total:103133,profit:-5933}})).statusCode,409);
  assert.equal((await app.inject({method:'PATCH',url:'/table-data/sales/old',payload:{payment_status:'cancelled'}})).statusCode,200);
});
