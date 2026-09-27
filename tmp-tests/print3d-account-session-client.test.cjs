const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const storage=new Map([['print3d_customer_session_v1','3d-token'],['mdv-session','unchanged']]);let response={ok:true,status:200,json:async()=>({customer:{id:'local'}})},failure;
 const context={exports:{},sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  fetch:async()=>{if(failure)throw failure;return typeof response==='function'?response():response;},
  require:name=>name==='./vpsProxyBase'?{buildVpsUrl:path=>path}:{print3dCaptchaToken:async()=>''}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/print3dAccountClient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 return {client:context.exports.print3dAccountClient,storage,reply:(status)=>{response={ok:status===200,status,json:async()=>({error:'local error'})};},fail:()=>{failure=Error('offline');},defer:fn=>{response=fn;}};
}
test('temporary errors preserve 3D session; only explicit unauthorized clears it',async()=>{
 for(const status of [403,429,500,502,503]){
  const f=fixture();f.reply(status);await assert.rejects(f.client.me());assert.equal(f.storage.get('print3d_customer_session_v1'),'3d-token');
 }
 const network=fixture();network.fail();await assert.rejects(network.client.me(),/offline/);assert.equal(network.storage.get('print3d_customer_session_v1'),'3d-token');
 const expired=fixture();expired.reply(401);assert.equal(await expired.client.me(),null);assert(!expired.storage.has('print3d_customer_session_v1'));assert.equal(expired.storage.get('mdv-session'),'unchanged');
});
test('delayed unauthorized response cannot erase a newer login',async()=>{
 const f=fixture();let resolve;f.defer(()=>new Promise(r=>{resolve=r;}));const pending=f.client.me();
 f.storage.set('print3d_customer_session_v1','new-token');resolve({ok:false,status:401,json:async()=>({})});
 assert.equal(await pending,null);assert.equal(f.storage.get('print3d_customer_session_v1'),'new-token');
});
