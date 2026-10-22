'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {API_ENTRIES,inspectApiRuntime,patchStateKey,deployPayjoyState}=require('../scripts/deploy-n8n-payjoy-state.cjs');
const {protectedProof}=require('../scripts/deploy-n8n-whatsapp-payjoy.cjs');
const root='/var/www/mdv-api';
const old="const N8N_BOT_CONVERSATION_STATE_KEYS = new Set([\n  'salesPostList',\n  'pendingDeviceClarification',\n  'optionalCustomerName',\n]);";
const fixed=patchStateKey(old);
const processFor=file=>({name:'mdv-api',pm2_env:{pm_exec_path:`${root}/${file}`}});

test('runtime proof checks the actual entry, never a corrected inactive sibling',()=>{
 const reads=[];
 const result=inspectApiRuntime([processFor('server.js')],file=>{reads.push(file);return file.endsWith('/server.js')?old:fixed;});
 assert.deepEqual(reads,[`${root}/server.js`]);
 assert.deepEqual(result,{sourceFile:`${root}/server.js`,apiSupportsPayjoy:false});
 for(const file of API_ENTRIES)assert.equal(inspectApiRuntime([processFor(file)],()=>fixed).apiSupportsPayjoy,true);
 assert.throws(()=>inspectApiRuntime([],()=>fixed),/exactly one/);
 assert.throws(()=>inspectApiRuntime([processFor('server.js'),processFor('vps_server.cjs')],()=>fixed),/exactly one/);
 assert.throws(()=>inspectApiRuntime([processFor('../other.js')],()=>fixed),/Unexpected/);
});

test('selective publisher includes all three approved entries and rejects another runtime',async()=>{
 const reads=[];
 const result=await deployPayjoyState({appDir:root,apiProc:processFor('server.js'),checkOnly:true,
  read:async file=>{reads.push(file);return old;},
  write:async()=>assert.fail('check-only cannot write'),exec:async()=>assert.fail('check-only cannot execute')});
 assert.equal(result,undefined);
 assert.deepEqual(reads,API_ENTRIES.map(file=>`${root}/${file}`));
 await assert.rejects(()=>deployPayjoyState({appDir:root,apiProc:processFor('unapproved.js')}),/Unexpected/);
});

function fakeConnection(entrySource){
 return {exec(command,callback){
  assert.equal(command,'node --input-type=commonjs -');
  const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.setEncoding=()=>{};
  stream.end=script=>{
   const fakeProcess={env:{},chdir:dir=>assert.equal(dir,root),stderr:{write:()=>{}},exitCode:0};
   const db={query:async sql=>sql.includes('COUNT(*)')?[[{paused:1}]]:[[{blocked:1,human_handoff_until:null,human_handoff_by:'manual'}]],end:async()=>{}};
   const fakeRequire=name=>{
    if(name==='fs')return {readFileSync:file=>{assert.equal(file,`${root}/server.js`);return entrySource;}};
    if(name==='crypto')return require('node:crypto');
    if(name==='child_process')return {execFileSync:(cmd,args)=>{assert.equal(cmd,'pm2');assert.deepEqual(Array.from(args),['jlist']);return JSON.stringify([processFor('server.js')]);}};
    if(name.endsWith('/dotenv'))return {config:()=>({})};
    if(name.endsWith('/mysql2/promise'))return {createConnection:async()=>db};
    assert.fail(`Unexpected require ${name}`);
   };
   Promise.resolve(vm.runInNewContext(script,{require:fakeRequire,process:fakeProcess,
    console:{log:value=>stream.emit('data',value)}})).then(()=>stream.emit('close',fakeProcess.exitCode));
  };
  callback(null,stream);
 }};
}
test('protectedProof resolves PM2 runtime server.js and reports its missing key',async()=>{
 const missing=await protectedProof(fakeConnection(old),'5587000000000');
 assert.equal(missing.sourceFile,`${root}/server.js`);assert.equal(missing.apiSupportsPayjoy,false);
 assert.equal(missing.paused,true);assert.equal(missing.count,1);
 const ready=await protectedProof(fakeConnection(fixed),'5587000000000');
 assert.equal(ready.apiSupportsPayjoy,true);assert.equal(ready.sha256,missing.sha256);
});
