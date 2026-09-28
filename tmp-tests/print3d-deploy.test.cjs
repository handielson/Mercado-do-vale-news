'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { deployPrint3d, schemaPlan, nodeCommand, waitForHealth } = require('../scripts/deploy-print3d.cjs');
const migrations = { '031':'ALTER products', '032':'CREATE product_id CHAR(36) NOT NULL', '039':'ALTER banners' };
test('pacote da API inclui os módulos de solicitação de prazo', () => {
 const source = fs.readFileSync(path.resolve(__dirname, '..', 'deploy-vps-server-only.cjs'), 'utf8');
 assert.match(source, /services\/productDeadlineRequest\.cjs/);
 assert.match(source, /services\/productDeadlineRequestsServer\.cjs/);
});
function state() { return { columns:[{TABLE_NAME:'products',COLUMN_NAME:'id',COLUMN_TYPE:'char(36)',COLLATION_NAME:'utf8mb4_unicode_ci'}],indexes:[],tables:[{TABLE_NAME:'products',ENGINE:'InnoDB'},{TABLE_NAME:'banners',ENGINE:'InnoDB'}],counts:{products:'10',banners:'2'},google:false }; }
test('plans only additive 031/032/039 and matches product collation',()=>{
 const plan=schemaPlan(state(),migrations); assert.equal(plan.length,3); assert.match(plan[1],/CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/);
});
test('partial schema and ambiguous id stop before mutations',()=>{
 const s=state();s.columns.push({TABLE_NAME:'products',COLUMN_NAME:'is_print3d'});
 assert.throws(()=>schemaPlan(s,migrations),/Partial migration/);
 const other=state();other.columns[0].COLUMN_TYPE='varchar(36)';assert.throws(()=>schemaPlan(other,migrations),/Ambiguous/);
});
test('refuses unexpected runtime target without invoking remote commands',async()=>{
 let calls=0;await assert.rejects(deployPrint3d({appDir:'/tmp/api',apiProc:'mdv-api',exec:()=>{calls++;}}),/target/);assert.equal(calls,0);
});
test('readonly preflight never uploads, creates directories, installs packages or changes schema',async()=>{
 const commands=[];let uploads=0;
 const result=await deployPrint3d({appDir:'/var/www/mdv-api',apiProc:'mdv-api',root:path.resolve(__dirname,'..'),checkOnly:true,exec:async c=>{commands.push(c);return JSON.stringify(state());},upload:()=>{uploads++;}});
 assert.equal(result.pendingMigrations,3);assert.equal(uploads,0);assert.equal(commands.length,1);
 assert.match(commands[0],/^cd '\/var\/www\/mdv-api' && node -e /);
 const encoded=/Buffer.from\('\''([^']+)/.exec(commands[0]);
 assert.ok(!commands[0].includes('npm install'));assert.equal(result.googleInstalled,false);
});
test('node wrapper encodes arbitrary source without shell interpolation',()=>{
 const cmd=nodeCommand('/var/www/mdv-api',"console.log('$(touch /tmp/bad)')");assert.ok(!cmd.includes('touch /tmp/bad'));assert.match(cmd,/base64/);
});
function readyState() {
 const s=state();
 for(const name of ['is_print3d','print3d_preorder_enabled'])s.columns.push({TABLE_NAME:'products',COLUMN_NAME:name,COLUMN_TYPE:'tinyint(1)',IS_NULLABLE:'NO',COLUMN_DEFAULT:'0'});
 s.columns.push({TABLE_NAME:'products',COLUMN_NAME:'print3d_preorder_limit',COLUMN_TYPE:'int unsigned',IS_NULLABLE:'YES'});
 s.columns.push({TABLE_NAME:'banners',COLUMN_NAME:'storefront',COLUMN_TYPE:'varchar(32)',IS_NULLABLE:'NO',COLUMN_DEFAULT:'mercado_do_vale'});
 for(const name of ['product_id','storefront','publication_status','title','description','category_label','slug','price_retail','price_reseller','price_wholesale','price_promo','promo_start','promo_end','meta_title','meta_description','updated_at'])s.columns.push({TABLE_NAME:'product_storefront_offers',COLUMN_NAME:name,COLLATION_NAME:'utf8mb4_unicode_ci'});
 for(const [table,index,names] of [['products','idx_products_print3d_catalog',['is_print3d','status']],['banners','idx_banners_storefront_order',['storefront','display_order']],['product_storefront_offers','PRIMARY',['product_id','storefront']],['product_storefront_offers','uq_storefront_slug',['storefront','slug']]])names.forEach((name,i)=>s.indexes.push({TABLE_NAME:table,INDEX_NAME:index,COLUMN_NAME:name,SEQ_IN_INDEX:i+1,NON_UNIQUE:0}));
 s.counts.product_storefront_offers='0';s.google=true;s.script='/var/www/mdv-api/server.js';return s;
}
test('complete schema is idempotent and checks defaults and indexes',()=>{
 const s=readyState();assert.equal(schemaPlan(s,migrations).length,0);
 s.columns.find(c=>c.COLUMN_NAME==='is_print3d').COLUMN_DEFAULT='1';assert.throws(()=>schemaPlan(s,migrations),/flag schema/);
});
function sourceOf(command) {
 const unquoted=command.replace(/'\\''/g,"'");
 const encoded=/Buffer\.from\('([^']+)'/.exec(unquoted);
 return encoded?Buffer.from(encoded[1],'base64').toString():null;
}
test('deployment backs up before upload, validates generated programs, promotes entry last and restarts once',async()=>{
 const events=[];
 const exec=async command=>{
  const source=sourceOf(command);
  if(source)new(require('node:vm').Script)(source);
  events.push(command);
  if(source?.includes('async function remoteCheck'))return JSON.stringify(readyState());
  return '';
 };
 const result=await deployPrint3d({appDir:'/var/www/mdv-api',apiProc:{name:'mdv-api'},root:path.resolve(__dirname,'..'),runtimeFiles:['services/print3dPaymentTerms.cjs'],exec,upload:async(l,r)=>{events.push('UPLOAD '+r);}});
 assert.equal(result.migrationsApplied,0);
 const backupIndex=events.findIndex(c=>sourceOf(c)?.includes('mysqldump'));
 assert.ok(backupIndex>=0 && backupIndex<events.findIndex(c=>c.startsWith('UPLOAD')));
 assert.equal(events.filter(c=>c==='pm2 restart mdv-api').length,1);
 const moves=events.filter(c=>c.includes(' && mv '));assert.match(moves.at(-1),/server\.js/);
 assert.ok(!events.some(c=>c.includes('npm install')));
});
test('failed promotion restores prior files and restarts old runtime',async()=>{
 const events=[];let failed=false;
 await assert.rejects(deployPrint3d({appDir:'/var/www/mdv-api',apiProc:'mdv-api',root:path.resolve(__dirname,'..'),exec:async command=>{
  events.push(command);const source=sourceOf(command);
  if(source?.includes('async function remoteCheck'))return JSON.stringify(readyState());
  if(command.includes(' && mv ') && command.includes('/vps_server.cjs')&&!failed){failed=true;throw Error('simulated');}
  return '';
 },upload:async()=>{}}),/previous runtime restored/);
 assert.ok(events.some(c=>c.startsWith('if test -f')&&c.includes('/files/services/customerPhoneVerificationServer.cjs')));
 assert.equal(events.at(-1),'pm2 restart mdv-api');
});
test('health requires online process and successful API plus MySQL; retries use configured port',async()=>{
 let time=0,attempt=0;const urls=[];
 const health=await waitForHealth({port:4321,now:()=>time,sleep:async ms=>{time+=ms;},getProcesses:()=>[{name:'mdv-api',pm2_env:{status:'online'}}],request:async url=>{urls.push(url);return {ok:true,json:async()=>({ok:true,mysql:{ok:++attempt===3}})};}});
 assert.equal(health.ok,true);assert.equal(attempt,3);assert.equal(time,2000);assert.ok(urls.every(url=>url==='http://127.0.0.1:4321/status'));
});
test('health timeout never accepts offline process or contacts API while offline',async()=>{
 let time=0,requests=0;
 await assert.rejects(waitForHealth({now:()=>time,sleep:async ms=>{time+=ms;},getProcesses:()=>[{name:'mdv-api',pm2_env:{status:'errored'}}],request:async()=>{requests++;}}),/health check failed/);
 assert.equal(time,30000);assert.equal(requests,0);
});
test('health failure after restart rolls runtime back and restarts previous version',async()=>{
 const events=[];
 await assert.rejects(deployPrint3d({appDir:'/var/www/mdv-api',apiProc:'mdv-api',root:path.resolve(__dirname,'..'),exec:async command=>{
  events.push(command);const source=sourceOf(command);
  if(source?.includes('async function remoteCheck'))return JSON.stringify(readyState());
  if(source?.includes('async function waitForHealth'))throw Error('unhealthy');
  return '';
 },upload:async()=>{}}),/previous runtime restored/);
 assert.equal(events.filter(c=>c==='pm2 restart mdv-api').length,2);
 assert.ok(events.some(c=>c.startsWith('if test -f')&&c.includes('/files/server.js')));
});
