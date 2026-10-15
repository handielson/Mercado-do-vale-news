'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
sharp.cache(false);
function cleanup(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('mdv-social-'));fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
const {resolveSocialPreviewImage}=require('../services/socialPreviewImage.cjs');
const vm=require('node:vm'),fastify=require('fastify');
const {block}=require('../scripts/assert-catalog-media-contract.cjs');
test('Open Graph has a real bounded JPEG, cache/versioning and immutable source',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mdv-social-'));
 try{
  const source=path.join(root,'foto.webp');await sharp({create:{width:1600,height:1000,channels:4,background:'#fa000055'}}).webp().toFile(source);
  const original=fs.readFileSync(source),input='https://api.xiaomipetrolina.com.br/images/foto.webp?v=old';
  const urls=await Promise.all(Array.from({length:5},()=>resolveSocialPreviewImage(input,{uploadsDir:root})));
  assert.equal(new Set(urls).size,1);assert.match(urls[0],/-social-[a-f0-9]{16}\.jpg$/);
  const target=path.join(root,decodeURIComponent(new URL(urls[0]).pathname.slice('/images/'.length)));
  const bytes=fs.readFileSync(target),meta=await sharp(bytes).metadata();
  assert.equal(bytes.readUInt16BE(),0xffd8);assert.equal(meta.format,'jpeg');assert.equal(meta.width,1200);assert.equal(meta.hasAlpha,false);
  assert.deepEqual(fs.readFileSync(source),original);const at=fs.statSync(target).mtimeMs;
  assert.equal(await resolveSocialPreviewImage(input,{uploadsDir:root}),urls[0]);assert.equal(fs.statSync(target).mtimeMs,at);
  await sharp({create:{width:100,height:100,channels:3,background:'#ffffff'}}).webp().toFile(source);
  assert.notEqual(await resolveSocialPreviewImage(input,{uploadsDir:root}),urls[0]);
  assert.ok(!fs.readdirSync(root).some(name=>name.endsWith('.tmp')));
 }finally{cleanup(root);}
});
test('external hosts, traversal, nonexistent and unsupported media are not read or fetched',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mdv-social-'));
 try{for(const input of ['https://other.test/images/foto.webp','http://api.xiaomipetrolina.com.br/images/foto.webp','https://api.xiaomipetrolina.com.br/images/%2e%2e%2fprivate.webp','https://api.xiaomipetrolina.com.br/images/missing.webp','data:image/png;base64,a'])assert.equal(await resolveSocialPreviewImage(input,{uploadsDir:root}),input);assert.deepEqual(fs.readdirSync(root),[]);}finally{cleanup(root);}
});
for(const entry of ['server.js','vps_server.js','vps_server.cjs'])test(entry+': real SEO HTTP response exposes a downloadable JPEG and preserves canonical/product schema',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mdv-social-')),app=fastify();
 try{
  await sharp({create:{width:1000,height:1000,channels:3,background:'#ffffff'}}).webp().toFile(path.join(root,'support.webp'));
  const source=fs.readFileSync(entry,'utf8'),context={fastify:app,require:id=>id==='./services/socialPreviewImage.cjs'?{resolveSocialPreviewImage}:require(id),UPLOADS_DIR:root,
   readSeoIndexHtml:()=>'<html><head></head><body>App</body></html>',loadSeoProductBySlug:async()=>({images:['https://api.xiaomipetrolina.com.br/images/support.webp'],name:'Suporte Carona',slug:'suporte-carona',sku:'SUPORTE',price_retail:1500,stock_quantity:1}),
   buildSeoBaseUrl:()=> 'https://www.mercadodovale.com.br',loadSeoProductImages:async()=>['https://api.xiaomipetrolina.com.br/images/support.webp'],normalizeSeoImages:value=>value||[],normalizeSeoPublicImages:value=>value,normalizeSeoKeywords:()=>[],stripSeoHtml:value=>String(value||''),
   formatSeoPrice:()=> '15.00',escapeSeoHtml:value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),removeExistingSeoHeadTags:value=>value,
   loadSeoImageMetadata:async url=>{const meta=await sharp(path.join(root,decodeURIComponent(new URL(url).pathname.slice('/images/'.length)))).metadata();return {type:'image/'+meta.format,width:meta.width,height:meta.height};},buildCopyableDebug:(_,detail)=>detail.rawMessage};
  vm.runInNewContext(block(source,"fastify.get('/api/seo-produto',"),context);
  const response=await app.inject({url:'/api/seo-produto?slug=suporte-carona',headers:{'user-agent':'WhatsApp/2.23.20.0'}});
  assert.equal(response.statusCode,200,response.body);
  const image=response.body.match(/property="og:image" content="([^"]+)"/)[1];
  assert.match(image,/-social-[a-f0-9]{16}\.jpg$/);
  if(source.includes('async function loadSeoImageMetadata(')){assert.match(response.body,/property="og:image:type" content="image\/jpeg"/);assert.match(response.body,/property="og:image:width" content="1000"/);}
  assert.match(response.body,/rel="canonical" href="https:\/\/www.mercadodovale.com.br\/produto\/suporte-carona"/);
  assert.match(response.body,/"image":\["https:\/\/api.xiaomipetrolina.com.br\/images\/support.webp"\]/);
  const bytes=fs.readFileSync(path.join(root,new URL(image).pathname.slice('/images/'.length)));assert.equal(bytes.readUInt16BE(),0xffd8);
 }finally{await app.close();cleanup(root);}
});
