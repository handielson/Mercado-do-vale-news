import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveProductSceneContext, selectBackgroundForProduct, scoreBackground } from '../services/marketingSceneCore.mjs';
import { runSceneBatch } from '../services/marketingSceneBatch.mjs';
const require=createRequire(import.meta.url);
const {createSceneService,registerMarketingSceneRoutes,safePexelsUrl}=require('../services/marketingScenesServer.cjs');
const sharp=require('sharp');
const sample={id:'scale',name:'Balança Digital de Cozinha 10kg ON-BL700A',category_id:'kitchen'};
function memory() {const records=new Map(),cache=new Map(),selections=new Map();return {records,cache,async list(){return [...records.values()]},async get(id){return records.get(id)},async put(b){records.set(b.id,b);return b},async cacheGet(id){const c=cache.get(id);return c?.until>Date.now()?c.value:null},async cachePut(id,value,ttl){cache.set(id,{value,until:Date.now()+ttl})},async selection(id){return selections.get(id)},async select(id,value){selections.set(id,value)}};}
const photo=(id=1)=>({id,width:2500,height:4000,src:{original:`https://images.pexels.com/photos/${id}/test.jpg`,medium:`https://images.pexels.com/photos/${id}/small.jpg`},url:`https://www.pexels.com/photo/${id}/`,photographer:'Fixture author',photographer_url:'https://www.pexels.com/@fixture/',alt:'Kitchen countertop'});
const reply=(photos=[photo()])=>new Response(JSON.stringify({photos,next_page:'next'}),{status:200,headers:{'X-Ratelimit-Limit':'200','X-Ratelimit-Remaining':'180','X-Ratelimit-Reset':String(Math.floor(Date.now()/1000)+3600)}});
const service=(repository,fetchImpl,extra={})=>createSceneService({repository,fetchImpl,apiKey:()=> 'test-key-not-real',uploadsDir:tmpdir(),...extra});
test('context mappings and fallback use product evidence',()=>{
 const examples={'Balança Digital de Cozinha 10kg':'kitchen','Patch Panel 24 portas':'patch-panel','Organizador de cabos rack':'cable-organizer','Keystone CAT6':'network','Carregador USB':'charging','Controle gamer':'gaming','Fone bluetooth':'audio','Alicate de crimpagem':'tools','Câmera CFTV':'security','Acessório automotivo':'automotive','Smartphone Redmi':'phone','Teclado computador':'computing','Produto desconhecido':'neutral'};
 for(const [name,key] of Object.entries(examples)) assert.equal(resolveProductSceneContext({name}).key,key,name);
 assert.equal(resolveProductSceneContext({name:'Item',category_name:'Ferramentas'}).key,'tools');
});
test('deterministic variation, metadata never approves, original object untouched',()=>{
 const scene=resolveProductSceneContext(sample), before=JSON.stringify(sample);
 const pool=[1,2,3].map(id=>({id:String(id),contextKey:scene.key,categoryId:'kitchen',tags:scene.tags,active:true,approved:true,width:2000,height:3000}));
 const first=selectBackgroundForProduct(sample,pool); assert.equal(first.background.id,selectBackgroundForProduct({...sample,price_retail:4000},pool).background.id);
 const next=selectBackgroundForProduct(sample,pool,{preferredId:first.background.id,variation:1});assert.notEqual(next.background.id,first.background.id);
 assert.equal(selectBackgroundForProduct(sample,pool,{preferredId:next.background.id}).background.id,next.background.id);
 assert.notEqual(scoreBackground({...pool[0],approved:false},sample,scene).status,'ready');
 assert.equal(scoreBackground({...pool[0],width:300,height:600},sample,scene).status,'review_required');
 assert.equal(scoreBackground({...pool[0],alt:'person holding kitchen scale'},sample,scene).status,'review_required');
 assert.equal(JSON.stringify(sample),before);
});
test('key absent, invalid, forbidden, 404, 429, timeout, no results and invalid response',async()=>{
 await assert.rejects(service(memory(),()=>{throw Error('should not call')},{apiKey:()=>''}).search(sample),/não configurado/);
 for(const [status,pattern] of [[401,/inválida/],[403,/recusado/],[404,/indisponível/],[429,/Limite/]]) await assert.rejects(service(memory(),async()=>new Response('',{status})).search(sample),pattern);
 await assert.rejects(service(memory(),async()=>{throw Error('token never echo')}).search(sample),/Tempo esgotado/);
 assert.equal((await service(memory(),async()=>reply([])).search(sample)).items.length,0);
 await assert.rejects(service(memory(),async()=>new Response('invalid')).search(sample),/Resposta inválida/);
});
test('cache includes locale and page, coalesces searches and hides authorization from output',async()=>{
 let calls=0;const repo=memory(); const api=service(repo,async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'test-key-not-real');assert.equal(url.searchParams.get('orientation'),'portrait');assert.equal(url.searchParams.get('per_page'),'12');return reply()});
 const results=await Promise.all([api.search(sample),api.search(sample)]);assert.equal(calls,1);assert.equal(results.reduce((n,r)=>n+r.queries,0),1);
 assert.equal((await api.search(sample)).cached,true);await api.search(sample,{page:2});await api.search(sample,{locale:'pt-BR'});assert.equal(calls,3);
 assert.equal(JSON.stringify(results).includes('test-key'),false);assert.equal(results[0].items[0].approved,false);
});
test('quota suspension persists and approved library works with no key',async()=>{
 const repo=memory();let calls=0;const api=service(repo,async()=>{calls++;return new Response('',{status:429})});
 await assert.rejects(api.search(sample),/Limite/);await assert.rejects(api.search(sample,{page:2}),/Limite/);assert.equal(calls,1);
 const scene=resolveProductSceneContext(sample);await repo.put({id:'saved',contextKey:scene.key,categoryId:'kitchen',tags:scene.tags,approved:true,active:true,width:2000,height:3000});
 const plan=await service(repo,()=>{throw Error('network forbidden')},{apiKey:()=>''}).prepare([sample]);assert.equal(plan.items[0].status,'pending');assert.equal(plan.queries,0);
});
test('100 products / 8 contexts search once per context and reuse approved library',async()=>{
 const names=['Balança de cozinha','Patch panel CAT6','Organizador de cabos','Carregador USB','Fone bluetooth','Controle gamer','Alicate','Smartphone'];
 const products=Array.from({length:100},(_,i)=>({id:`p${i}`,name:names[i%8],category_id:`c${i%8}`}));
 const repo=memory();let calls=0,active=0,peak=0;const start=Date.now();
 const api=service(repo,async()=>{const id=++calls;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return reply([photo(id*10),photo(id*10+1),photo(id*10+2)])});
 const initial=await api.prepare(products);assert.equal(calls,8);assert.equal(initial.queries,8);assert.equal(initial.newBackgrounds,24);assert.ok(peak<=3);assert.ok(initial.items.every(i=>i.status==='review_required'));
 for(const b of await repo.list()) await repo.put({...b,approved:true,alt:'Reviewed room'});
 const reused=await api.prepare(products);assert.equal(calls,8);assert.equal(reused.queries,0);assert.equal(reused.reused,100);
 const again=await api.prepare(products);assert.deepEqual(reused.items.map(i=>i.background.id),again.items.map(i=>i.background.id));
 await writeFile(new URL('./marketing-scenes-bulk-report.json',import.meta.url),JSON.stringify({test:'mocked API + in-memory repository; no production writes',products:100,contexts:8,firstQueries:8,secondQueries:0,newPhotos:24,reusedProducts:100,maxConcurrentSearches:peak,elapsedMs:Date.now()-start,items:reused.items},null,2));
});
test('manual selection survives repricing and text edits',async()=>{
 const repo=memory(), api=service(repo,()=>{throw Error('no lookup expected')});
 await repo.put({id:'manual',active:true,approved:true,contextKey:'kitchen',width:2000,height:3000,tags:[]});await repo.select('scale',{backgroundId:'manual',manual:true});
 assert.equal((await api.prepare([{...sample,price_retail:9900,description:'Edited'}])).items[0].background.id,'manual');
});
test('image host validation, inaccessible image, local upload/import',async()=>{
 for(const url of ['http://images.pexels.com/a','https://images.pexels.com.evil.test/a','https://user:pass@images.pexels.com/a','https://127.0.0.1/a']) assert.equal(safePexelsUrl(url,true),'');
 const dir=await mkdtemp(path.join(tmpdir(),'mdv-scene-test-'));const repo=memory();
 try {const api=service(repo,async()=>new Response('',{status:404}),{uploadsDir:dir});await repo.put({id:'bad',url:'https://images.pexels.com/bad',active:true});await assert.rejects(api.image('bad'),/inacessível/);
 const bytes=await sharp({create:{width:1100,height:2000,channels:3,background:'#345678'}}).png().toBuffer();
 const uploaded=await api.upload(sample,'data:image/png;base64,'+bytes.toString('base64'));assert.equal(uploaded.origin,'upload');assert.equal(uploaded.approved,true);assert.ok((await api.image(uploaded.id)).length>0);
 assert.equal((await api.importBackground(uploaded.id,true)).id,uploaded.id);
 } finally {await rm(dir,{recursive:true,force:true})}
});
test('batch isolates failures, retries only preparation, resumes and cancels',async()=>{
 let job={id:'job',items:[{productId:'done',status:'completed'},{productId:'bad',status:'pending'},{productId:'ok',status:'pending'}]};let calls=0,composed=[];
 const progress=async(id,change)=>{job=structuredClone(job);if('cancelled' in change)job.cancelled=change.cancelled;const i=job.items.find(i=>i.productId===change.productId);if(i)Object.assign(i,change);return job};
 const options={progress,validate:i=>{if(i.productId==='bad')throw Error('missing photo')},prepare:async()=>{if(++calls<3)throw Error('temporary network');return 'image'},compose:async i=>{composed.push(i.productId);return{}},delay:async()=>{}};
 await runSceneBatch(job,options);assert.deepEqual(composed,['ok']);assert.equal(job.items[1].status,'failed');assert.equal(calls,3);
 await runSceneBatch(job,{...options,validate:()=>{},prepare:async()=> 'image'});assert.deepEqual(composed,['ok','bad']);
 job={id:'cancel',items:[{productId:'pending',status:'pending'}]};await runSceneBatch(job,{...options,cancelled:()=>true});assert.equal(job.cancelled,true);assert.equal(job.items[0].status,'pending');
});
test('all scene routes require admin; no migration on registration',async()=>{
 const app=require('fastify')();let queries=0;
 registerMarketingSceneRoutes(app,{pool:{query:async()=>{queries++;throw Object.assign(Error('missing'),{code:'ER_NO_SUCH_TABLE'})}},uploadsDir:tmpdir(),requireAdminBearerToken:async(req,reply)=>{if(req.headers.authorization!=='Bearer test-admin')return reply.code(401).send({error:'unauthorized'})},getBearerAuthContext:async()=>({userId:'admin'})});
 assert.equal(queries,0);assert.equal((await app.inject({url:'/admin/marketing/scenes/library'})).statusCode,401);assert.equal(queries,0);
 const response=await app.inject({url:'/admin/marketing/scenes/library',headers:{authorization:'Bearer test-admin'}});assert.equal(response.statusCode,503);assert.match(response.json().error,/migração/);await app.close();
});
test('job routes preserve ownership, creation identity, lease, progress and resume plan',async()=>{
 const jobs=new Map(),records=new Map(),selections=new Map(); const scene=resolveProductSceneContext(sample);
 records.set('approved',{id:'approved',active:true,approved:true,categoryId:'kitchen',contextKey:scene.key,tags:scene.tags,width:2000,height:3000,uses:0});
 const pool={async query(sql,args=[]){
  if(sql.startsWith('SELECT p.*')) return [[{...sample,leaf_category_name:'Cozinha'}]];
  if(sql.startsWith('SELECT data FROM marketing_scene_backgrounds ORDER'))return [[...records.values()].map(data=>({data}))];
  if(sql.startsWith('SELECT data FROM marketing_scene_backgrounds WHERE'))return [[records.has(args[0])?{data:records.get(args[0])}:undefined].filter(Boolean)];
  if(sql.startsWith('INSERT INTO marketing_scene_backgrounds')){records.set(args[0],JSON.parse(args[1]));return[{}]}
  if(sql.startsWith('SELECT data FROM marketing_scene_selections'))return [[selections.has(args[0])?{data:selections.get(args[0])}:undefined].filter(Boolean)];
  if(sql.startsWith('INSERT INTO marketing_scene_selections')){selections.set(args[0],JSON.parse(args[1]));return[{}]}
  if(sql.startsWith('SELECT data FROM marketing_scene_jobs WHERE owner_id=? AND idempotency'))return [[...jobs.values()].filter(j=>j.owner===args[0]&&j.key===args[1]).map(j=>({data:j.data}))];
  if(sql.startsWith('INSERT INTO marketing_scene_jobs')){jobs.set(args[0],{owner:args[1],key:args[2],data:JSON.parse(args[3]),lease_token:null,lease_expires_at:0});return[{}]}
  if(sql.startsWith('SELECT data FROM marketing_scene_jobs WHERE owner_id'))return [[...jobs.values()].filter(j=>j.owner===args[0]).map(j=>({data:j.data}))];
  if(sql.startsWith('SELECT data,lease_token')){const j=jobs.get(args[0]);return [[j?.owner===args[1]?structuredClone(j):undefined].filter(Boolean)]}
  if(sql.startsWith('UPDATE marketing_scene_jobs SET lease_token=?')){const j=jobs.get(args[2]);if(!j||j.owner!==args[3]||j.lease_expires_at>=args[4]&&j.lease_token!==args[5])return[{affectedRows:0}];j.lease_token=args[0];j.lease_expires_at=args[1];return[{affectedRows:1}]}
  if(sql.startsWith('UPDATE marketing_scene_jobs SET lease_token=NULL')){const j=jobs.get(args[0]);if(j?.owner===args[1]&&j.lease_token===args[2]){j.lease_token=null;j.lease_expires_at=0}return[{}]}
  if(sql.startsWith('UPDATE marketing_scene_jobs SET data=')){const j=jobs.get(args[2]);assert.equal(j.owner,args[3]);assert.equal(j.lease_token,args[4]);j.data=JSON.parse(args[0]);j.lease_expires_at=args[1];return[{affectedRows:1}]}
  throw Error('Unexpected SQL: '+sql);
 }};
 const app=require('fastify')();registerMarketingSceneRoutes(app,{pool,uploadsDir:tmpdir(),requireAdminBearerToken:async()=>{},getBearerAuthContext:async req=>({userId:req.headers['x-test-owner']||'admin'})});
 const call=async(method,url,payload,headers={})=>app.inject({method,url:'/admin/marketing/scenes'+url,payload,headers});
 try {
  const body={productIds:['scale'],idempotencyKey:'same-request',format:'status',showPrice:true};
  const created=await call('POST','/jobs',body);assert.equal(created.statusCode,200,created.body);const job=created.json();
  assert.equal((await call('POST','/jobs',body)).json().id,job.id);assert.equal(jobs.size,1);
  assert.equal((await call('POST',`/jobs/${job.id}/claim`,{runToken:'run1'})).statusCode,200);
  assert.equal((await call('POST',`/jobs/${job.id}/claim`,{runToken:'run2'})).statusCode,409);
  assert.equal((await call('PATCH',`/jobs/${job.id}`,{runToken:'wrong',productId:'scale',status:'composing'})).statusCode,409);
  assert.equal((await call('PATCH',`/jobs/${job.id}`,{runToken:'run1',productId:'scale',status:'composing'},{'x-test-owner':'other'})).statusCode,404);
  let r=await call('PATCH',`/jobs/${job.id}`,{runToken:'run1',productId:'scale',status:'composing',completedSlide:1});assert.deepEqual(r.json().items[0].completedSlides,[1]);
  r=await call('POST',`/jobs/${job.id}/replan`,{runToken:'run1'});assert.equal(r.statusCode,200);assert.deepEqual(r.json().items[0].completedSlides,[1]);
  r=await call('PATCH',`/jobs/${job.id}`,{runToken:'run1',productId:'scale',status:'completed',outputUrl:'https://example.test/result.png',copy:{title:'Teste'}});assert.equal(r.statusCode,200);assert.equal(records.get('approved').uses,1);
  await call('PATCH',`/jobs/${job.id}`,{runToken:'run1',productId:'scale',status:'completed'});assert.equal(records.get('approved').uses,1);
  await call('POST',`/jobs/${job.id}/release`,{runToken:'run1'});assert.equal((await call('POST',`/jobs/${job.id}/claim`,{runToken:'run2'})).statusCode,200);
  assert.equal((await call('GET','/jobs',undefined,{'x-test-owner':'other'})).json().items.length,0);
 } finally {await app.close()}
});
