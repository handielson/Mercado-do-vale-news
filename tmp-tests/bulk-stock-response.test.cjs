const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const source=fs.readFileSync('services/vpsApiService.ts','utf8');
const method=source.slice(source.indexOf('  async bulkSyncPricesStock('),source.indexOf('  async bulkUpdateCategory'));
function client(result) {
 const context={fetch:async()=>({ok:true,json:async()=>result}),proxyUrl:()=>'/test',AbortSignal,WRITE_TIMEOUT_MS:1000,console:{warn(){}}};
 vm.createContext(context);
 const code=ts.transpileModule(`globalThis.client = new (class { invalidateProductCache() {} async authHeaders(v: any) { return v; } ${method} })();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInContext(code,context);return context.client;
}
test('bulk sync detects stock conflicts despite HTTP 200',async()=>{
 for(const result of [{ok:false},{errors:[{error:'external_stock_below_reserved'}]},{locationSync:[{ok:false}]},{skipped:1}]) {
  const response=await client(result).bulkSyncPricesStock([{id:'a'}]);
  assert.equal(response.ok,false);assert.equal(response.sent,0);
 }
});
test('bulk sync accepts successful current and legacy responses',async()=>{
 for(const result of [{ok:true,errors:[],locationSync:[{ok:true}]},{updated:1,errors:[]}]) {
  const response=await client(result).bulkSyncPricesStock([{id:'a'}]);
  assert.equal(response.ok,true);assert.equal(response.sent,1);
 }
});

test('batch import HTTP 200 with item errors is not success',async()=>{
 const method=source.slice(source.indexOf('  private async writeSafe('),source.indexOf('  invalidateProductCache()'));
 for(const [result,expected] of [[{upserted:1,errors:[]},true],[{upserted:0,errors:[{error:'external_stock_below_reserved'}]},false]]) {
  const context={fetch:async()=>({ok:true,json:async()=>result}),proxyUrl:()=>'/test',AbortController,setTimeout,clearTimeout,WRITE_TIMEOUT_MS:1000,console:{error(){}}};
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`globalThis.client = new (class { async authHeaders(v: any) { return v; } ${method} })();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  assert.equal(await context.client.writeSafe('POST','/products/batch',[{id:'a'}]),expected);
 }
});
