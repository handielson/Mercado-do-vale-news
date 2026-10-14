const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { readFileSync } = require('node:fs');
const { buildUnitJournalMigration } = require('../services/unitJournalSchema.cjs');
const { registerUnitJournalRoutes } = require('../services/unitJournalServer.cjs');

const schema = {
  units:['id','product_id','imei_1','imei_2','serial','status','sale_id','order_id','cost_price','created_at','updated_at'],
  products:['id','name','sku','specs','price_retail','stock_quantity','updated_at'],
  sales:['id','payment_status','total','created_at','updated_at'],
  orders:['id','status','created_at','updated_at'],
  sale_items:['id','product_id','sale_id','serialized_unit_id','imei','quantity'],
  product_stock_locations:['id','product_id','quantity','reserved_quantity'],
  stock_location_movements:['id','product_id','quantity','reason','created_by'],
};
test('all write paths have snapshots; immutable records cannot cascade away', () => {
  const plan = buildUnitJournalMigration(schema);
  assert.equal(plan.length,23);
  assert.match(plan.find(x=>x.name==='mdv_unit_journal_no_delete').sql,/SIGNAL SQLSTATE '45000'/);
  assert.match(plan.find(x=>x.name==='mdv_unit_journal_no_update').sql,/SIGNAL SQLSTATE '45000'/);
  assert.doesNotMatch(plan[0].sql,/FOREIGN KEY|CASCADE|UNIQUE.*sku/i);
  assert.match(plan[0].sql,/COLLATE=utf8mb4_unicode_ci/);
  const changes = plan.find(x=>x.name==='mdv_unit_journal_update').sql;
  for (const field of ['imei_1','imei_2','serial','sale_id','cost_price']) assert.ok(changes.includes(`'${field}'`));
  assert.match(changes,/OLD\.`status` <=> NEW\.`status`/);
  assert.match(changes,/p\.id=OLD\.product_id/);
  assert.match(changes,/p\.id=NEW\.product_id/);
  assert.ok(plan.some(x=>x.name==='mdv_uj_sale_items_delete'));
  assert.ok(plan.some(x=>x.name==='mdv_unit_journal_sale_update'));
  assert.ok(plan.some(x=>x.name==='mdv_uj_product_stock_locations_insert'));
  const baseline=plan.find(x=>x.name==='baseline').sql;
  assert.match(baseline,/'baseline'/);
  assert.match(baseline,/WHERE NOT EXISTS/);
  assert.doesNotMatch(baseline,/UPDATE|REPLACE|DELETE|IGNORE/);
  assert.match(plan.at(-1).sql,/existing_sale_reference/);
  assert.doesNotMatch(plan.at(-1).sql,/product_sku=/);
});
test('new columns are included; unsafe or incomplete schema is rejected', () => {
  assert.throws(()=>buildUnitJournalMigration({}),/Missing/);
  const expanded={...schema,units:[...schema.units,'intake_id']};
  assert.match(buildUnitJournalMigration(expanded).find(x=>x.name==='mdv_unit_journal_insert').sql,/'intake_id',NEW\.`intake_id`/);
  assert.throws(()=>buildUnitJournalMigration({...schema,units:[...schema.units,'bad;DROP']}),/Invalid/);
});

function fixture(t,{admin=true,error,rows=[]}={}) {
  const app=Fastify(); const queries=[];
  registerUnitJournalRoutes(app,{pool:{query:async(sql,params)=>{queries.push({sql,params});if(error)throw error;return [rows];}},getBearerAuthContext:async()=>admin?{isAdmin:true,userId:'operator'}:{isAdmin:false}});
  app.get('/table-data/:name',async()=>({shouldNotReach:true}));
  app.post('/table-data/:name',async()=>({shouldNotReach:true}));
  app.delete('/table-data/:name/:id',async()=>({shouldNotReach:true}));
  t.after(()=>app.close()); return {app,queries};
}
const id='63020f20-ba86-4669-a848-fae020137f89';
test('selective deployment preserves unrelated API code, supports CRLF and rejects anchor drift',()=>{
  const {patch}=require('../scripts/deploy-unit-journal.cjs');
  const source="async function getVpsBearerAuthContext(req) {}\r\n// ─── Units (inventory de unidades serializadas: 1 linha por aparelho) ──────\r\nconst unrelated=true;";
  const next=patch(source);
  assert.match(next,/registerUnitJournalRoutes/);
  assert.ok(next.endsWith('const unrelated=true;'));
  assert.equal(patch(next),next);
  assert.throws(()=>patch('drift'),/anchor drift/);
});
test('requires admin bearer authentication, no sync-key shortcut',async t=>{
  const {app,queries}=fixture(t,{admin:false});
  const response=await app.inject({url:`/admin/units/${id}/journal`,headers:{'x-sync-key':'test'}});
  assert.equal(response.statusCode,401); assert.equal(queries.length,0);
});
test('generic table readers and writers cannot bypass the journal',async t=>{
  const {app}=fixture(t);
  for(const [method,url] of [['GET','/table-data/unit_journal_events'],['GET','/table-data/UNIT_JOURNAL_EVENTS'],['POST','/table-data/unit_journal_events'],['DELETE','/table-data/unit_journal_events/1']]) {
    assert.equal((await app.inject({method,url})).statusCode,403);
  }
});
test('paginated full snapshots have stable IDs and no-store',async t=>{
  const rows=Array.from({length:101},(_,index)=>({id:String(200-index),unit_id:id,before_data:null,after_data:'{"unit":{"status":"sold"}}'}));
  const {app,queries}=fixture(t,{rows});
  const response=await app.inject({url:`/admin/units/${id}/journal?before=9007199254740999`});
  assert.equal(response.statusCode,200); assert.equal(response.headers['cache-control'],'no-store');
  assert.equal(response.json().events.length,100); assert.equal(response.json().next,'101');
  assert.equal(response.json().events[0].after_data.unit.status,'sold');
  assert.deepEqual(queries[0].params,[id,'9007199254740999']);
});
test('search finds past identifiers using snapshots, without requiring a live unit',async t=>{
  const {app,queries}=fixture(t);
  assert.equal((await app.inject({url:'/admin/units/journal?identifier=serial-test'})).statusCode,200);
  assert.deepEqual(queries[0].params,Array(6).fill('serial-test'));
  assert.match(queries[0].sql,/matched\.imei_1_before/); assert.match(queries[0].sql,/matched\.imei_1_after/);
  assert.doesNotMatch(queries[0].sql,/JOIN units/);
});
test('product card reads its IDs, children and preserved family snapshots, never shared SKU',async t=>{
  const {app,queries}=fixture(t);
  const other='1273a975-3e72-4986-9a5a-222573d5b928';
  const response=await app.inject({url:`/admin/products/${id}/journal?include=${other},${id}&before=99`});
  assert.equal(response.statusCode,200);
  assert.deepEqual(queries[0].params,[id,other,id,other,id,other,id,other,id,other,'99']);
  assert.match(queries[0].sql,/SELECT id FROM products WHERE parent_id IN/);
  assert.match(queries[0].sql,/\$\.product.parent_id/);
  assert.doesNotMatch(queries[0].sql,/sku/);
  assert.equal((await app.inject({url:`/admin/products/${id}/journal?include=invalid`})).statusCode,400);
  assert.equal(queries.length,1);
});
test('product history also requires an administrator',async t=>{
  const {app,queries}=fixture(t,{admin:false});
  assert.equal((await app.inject({url:`/admin/products/${id}/journal`})).statusCode,401);
  assert.equal(queries.length,0);
});
test('missing installation is explicit; malformed requests never query DB',async t=>{
  const {app,queries}=fixture(t,{error:{code:'ER_NO_SUCH_TABLE'}});
  assert.equal((await app.inject({url:`/admin/units/${id}/journal`})).statusCode,503);
  assert.equal((await app.inject({url:'/admin/units/nope/journal'})).statusCode,400);
  assert.equal((await app.inject({url:`/admin/units/${id}/journal?before=1%20OR%201`})).statusCode,400);
  assert.equal(queries.length,1);
});
test('both server entrypoints, deploy manifest and UI retain the diary',()=>{
  for(const path of ['vps_server.js','vps_server.cjs']) assert.match(readFileSync(path,'utf8'),/registerUnitJournalRoutes/);
  assert.match(readFileSync('deploy-vps-server-only.cjs','utf8'),/'services\/unitJournalServer\.cjs'/);
  const page=readFileSync('pages/admin/inventory/SerializedUnitsPage.tsx','utf8');
  assert.match(page,/onJournal=\{unit => setJournalTarget\(unit\.id\)\}/);
  assert.match(page,/Consultar diário por IMEI ou serial/);
});
