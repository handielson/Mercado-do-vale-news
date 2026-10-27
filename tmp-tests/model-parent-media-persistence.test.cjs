const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('media uses partial production PATCH and isolated local draft PUT',async()=>{
  for(const local of [false,true]){
    const requests=[],exports={};
    const source=fs.readFileSync('services/vpsApiService.ts','utf8').replaceAll('import.meta','({env:{DEV:true}})');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{exports,console,setTimeout,clearTimeout,AbortController,URL,URLSearchParams,Map,Date,fetch:async(url,options)=>{requests.push({url,options});return{ok:true};},require:name=>{
      if(name.includes('authSession'))return{buildAuthHeaders:async extra=>extra};
      if(name.includes('localCatalogPreview'))return{isLocalCatalogPreviewRuntime:()=>local};
      if(name.includes('vpsProxyBase'))return{buildVpsUrl:p=>'https://fixture.test'+p,getVpsSyncHeaders:()=>({})};
      return{};
    }});
    assert.equal(await exports.vpsApiService.updateProductMedia('p',{images:['new.jpg'],video_url:null}),true);
    assert.equal(requests[0].options.method,local?'PUT':'PATCH');
    assert.equal(new URL(requests[0].url).pathname,local?'/products/p':'/table-data/products/p');
    assert.deepEqual(JSON.parse(requests[0].options.body),{images:['new.jpg'],video_url:null,image_url:'new.jpg'});
  }
});
test('removing/replacing parent images survives preview server restart without central writes',async t=>{
  const fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
  const {createLocalCatalogPreviewServer}=require('../services/localCatalogPreviewServer.cjs');
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'mdv-parent-media-persist-'));
  const id='00b23279-2d23-49c0-8b45-0133e9ae6d84',draftFile=path.join(dir,'drafts.json');
  const original={id,name:'Fixture parent',images:['old1.jpg','old2.jpg'],image_url:'old1.jpg',video_url:'https://video.test/original.mp4'};
  const start=async()=>{const app=createLocalCatalogPreviewServer({port:0,draftFile,fetchImpl:async(url,options)=>{assert.ok(!options.method||options.method==='GET');return new Response(JSON.stringify(original),{headers:{'content-type':'application/json'}});}});await app.start();return app;};
  let app=await start();t.after(async()=>{await app.close();await fsp.rm(dir,{recursive:true,force:true});});
  const base=()=>`http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await fetch(base()+'/products/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({images:['new.jpg'],image_url:'new.jpg',video_url:original.video_url})})).status,200);
  await app.close();app=await start();
  const reloaded=await(await fetch(base()+'/products/'+id)).json();
  assert.deepEqual(reloaded.images,['new.jpg']);assert.equal(reloaded.image_url,'new.jpg');assert.equal(reloaded.video_url,original.video_url);
  assert.deepEqual(original.images,['old1.jpg','old2.jpg']);
});
test('model media has only the canonical link and never issues independent media writes',()=>{
  const source=fs.readFileSync('components/settings/ModelParentImages.tsx','utf8');
  assert.match(source,/familyWorkspacePath\(modelId\)/);
  assert.doesNotMatch(source,/saveParentMedia|uploadProductImages|setImages|type="file"/);
});
