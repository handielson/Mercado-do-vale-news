const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {reconcileExternalStock}=require('../services/externalStockReconciliation.cjs');

for(const file of ['vps_server.js','vps_server.cjs']) {
  test(`${file}: repeated distribution reads preserve balances and history`,async()=>{
    const source=readFileSync(file,'utf8');
    const start=source.indexOf("fastify.get('/stock-locations/products/:productId/distribution'");
    const end=source.indexOf("fastify.get('/stock-locations/locations/:locationId/contents'",start);
    let handler;
    let reads=0;
    const rows=[{id:'balance',quantity:1,reserved_quantity:0}];
    const context={requireSyncKeyOrAdmin(){},mapProductStockLocation:row=>({...row}),
      fastify:{get(_route,_options,callback){handler=callback;}},
      pool:{async query(sql,params){
        assert.match(sql.trim(),/^SELECT\b/i);
        assert.deepEqual(Array.from(params),['product']);
        reads++;return [rows];
      }}};
    vm.runInNewContext(source.slice(start,end),context);
    assert.deepEqual(await handler({params:{productId:'product'}}),rows);
    assert.deepEqual(await handler({params:{productId:'product'}}),rows);
    assert.equal(reads,2);
    assert.equal(rows[0].quantity,1);
  });
}

function harness({aggregate=2,units=[{status:'available'}],quantity=1,missingUnits=false}={}) {
  const writes=[];
  let incomingCalls=0;
  const balances=quantity===null?[]:[{id:'balance',company_id:'company',product_id:'product',
    deposit_id:'deposit',location_id:'location',quantity,reserved_quantity:0}];
  const connection={async beginTransaction(){},async commit(){},async rollback(){},release(){},
    async query(sql,params){
      if(sql.startsWith('SET TRANSACTION'))return [];
      if(sql.startsWith('SELECT id,company_id,stock_quantity'))return [[{id:'product',company_id:'company',stock_quantity:aggregate}]];
      if(sql.startsWith('SELECT status FROM units')){
        if(missingUnits)throw Object.assign(new Error('missing units'),{code:'ER_NO_SUCH_TABLE'});
        return [units];
      }
      if(sql.startsWith('SELECT * FROM product_stock_locations'))return [balances];
      if(sql.startsWith('SELECT psl.id'))return [[{id:'balance',deposit_default:1,location_default:1}]];
      if(sql.startsWith('SELECT id FROM stock_location_movements'))return [[]];
      assert.match(sql,/^(INSERT|UPDATE)\b/);writes.push({sql,params});return [{affectedRows:1}];
    }};
  return {writes,run:options=>reconcileExternalStock({getConnection:async()=>connection},{
    productId:'product',materializeUndistributed:true,reason:'explicit_migration',
    getIncoming:async()=>{incomingCalls++;return {depositId:'deposit',locationId:'incoming'};},...options}),
    getIncomingCalls:()=>incomingCalls};
}

test('aggregate 2 with one available unit and one distributed does not materialize a phantom unit',async()=>{
  const h=harness();
  assert.equal((await h.run()).materialized,0);
  assert.equal(h.writes.length,0);
  assert.equal(h.getIncomingCalls(),0);
});

test('explicit materialization uses available units and preserves sold units',async()=>{
  const h=harness({aggregate:8,units:[{status:'available'},{status:'sold'}],quantity:null});
  const result=await h.run();
  assert.equal(result.materialized,1);
  assert.equal(result.syncedTotal,1);
  assert.equal(h.writes.find(write=>write.sql.startsWith('INSERT INTO product_stock_locations')).params[5],1);
  assert.equal(h.writes.find(write=>write.sql.startsWith('UPDATE products')).params[0],1);
  assert.ok(h.writes.every(write=>!/(INSERT INTO|UPDATE|DELETE FROM) units\b/.test(write.sql)));
});

test('sold serialized units never materialize stale aggregate stock',async()=>{
  const h=harness({units:[{status:'sold'}],quantity:null});
  assert.equal((await h.run()).materialized,0);
  assert.equal(h.writes.length,0);
});

test('nonserialized explicit initialization retains aggregate stock',async()=>{
  const h=harness({aggregate:5,units:[],quantity:null});
  assert.equal((await h.run({initialMigration:true})).materialized,5);
});

test('missing units schema fails closed outside initial bootstrap',async()=>{
  const h=harness({missingUnits:true});
  await assert.rejects(h.run(),{code:'ER_NO_SUCH_TABLE'});
  assert.equal(h.writes.length,0);
});

test('first schema bootstrap can initialize locations before units exists',async()=>{
  const h=harness({missingUnits:true,quantity:null});
  assert.equal((await h.run({initialMigration:true})).materialized,2);
});
