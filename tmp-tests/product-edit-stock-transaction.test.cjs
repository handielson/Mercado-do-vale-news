const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
for(const filename of ['vps_server.cjs','vps_server.js']) {
 test(`${filename}: product edit reconciles stock in the write transaction`,async()=>{
  const source=readFileSync(filename,'utf8');
  const route=source.slice(source.indexOf("fastify.put('/products/:id'"),source.indexOf('// Delete product, its variations'));
  let handler;let reconciled=0;let writes=0;let conflict=false;
  const connection={query:async(sql,params)=>{
   assert.doesNotMatch(sql,/stock_quantity\s*=/);
   assert.equal((sql.match(/\?/g)||[]).length,params.length);
   writes++;return [{affectedRows:1}];
  }};
  const context={fastify:{put:(path,options,fn)=>{handler=fn;}},requireSyncKey(){},pool:{},
   normalizePrint3dProductOffer(){},collectProductSerializedIdentifiers:()=>[],findProductSerializedIdentifierConflict:async()=>null,
   withSmartphonePriceWrite:async(pool,input,write,options)=>{assert.equal(options.transactional,true);return write(connection,input);},
   require:()=>({reconcileExternalStock:async(pool,options)=>{assert.equal(options.connection,connection);reconciled++;return conflict?{ok:false,error:'external_stock_below_reserved'}:{ok:true};}}),
   ensureIncomingStockLocation(){},getDefaultStockCompanyId(){},jsonStr:()=>null,sanitizeDescription:()=>null,
   normalizeProductSpecsRam:()=>null,optionalBool:()=>null,
  };
  vm.runInNewContext(route,context);
  const request=body=>handler({body,params:{id:'test'}},{});
  assert.equal((await request({name:'x',stock_quantity:3})).ok,true);
  assert.equal(reconciled,1);assert.equal(writes,1);
  await request({name:'x'});assert.equal(reconciled,1);assert.equal(writes,2);
  conflict=true;
  await assert.rejects(request({stock_quantity:0}),e=>e.statusCode===409);
  assert.equal(writes,2);
 });
}
