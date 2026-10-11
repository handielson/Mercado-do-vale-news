const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function fixture(response={ok:true,json:async()=>({url:'https://example.test/photo.webp'})}) {
  const requests=[],compressed=[];
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('services/productImageUpload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,FormData,fetch:async(url,options)=>{requests.push({url,...options});return response;},require:name=>{
    if(name.includes('image-compression'))return {compressImage:async file=>{compressed.push(file);return new Blob(['compressed'],{type:'image/webp'});}};
    if(name.includes('authSession'))return {getAuthSessionToken:async()=> 'fixture-token'};
    if(name.includes('vpsProxyBase'))return {buildVpsUrl:path=>'https://api.example.test'+path,getVpsSyncHeaders:()=>({'X-Fixture':'yes'})};
    throw Error(name);
  }});
  return {...module.exports,requests,compressed};
}
test('upload das fotos usa compressão, autenticação e endpoint canônico do filho',async()=>{
  const f=fixture(); const result=await f.uploadProductImages('child-id',[{name:'photo.png',type:'image/png'}]);
  assert.equal(result[0],'https://example.test/photo.webp');assert.equal(f.compressed.length,1);
  const req=f.requests[0]; assert.equal(req.url,'https://api.example.test/products/child-id/upload-image');
  assert.equal(req.method,'POST'); assert.equal(req.headers.Authorization,'Bearer fixture-token');
  assert.equal(req.body.get('file').name,'photo.png'); assert.equal(req.body.get('file').type,'image/webp');
});
test('falha ou resposta sem URL não vira foto salva',async()=>{
  const files=[{name:'photo.png',type:'image/png'}];
  await assert.rejects(fixture({ok:false}).uploadProductImages('child',files),/enviar a foto/);
  await assert.rejects(fixture({ok:true,json:async()=>({})}).uploadProductImages('child',files),/não confirmou/);
});
test('arquivo que não é imagem não faz upload',async()=>{
  const f=fixture();await assert.rejects(f.uploadProductImages('child',[{name:'video.mp4',type:'video/mp4'}]),/apenas arquivos de imagem/);
  assert.equal(f.requests.length,0);
});
