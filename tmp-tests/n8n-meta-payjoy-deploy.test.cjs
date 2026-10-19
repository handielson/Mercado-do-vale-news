'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PassThrough}=require('node:stream');
const {callRemote,deploy,fingerprint}=require('../scripts/deploy-n8n-meta-attendance.cjs');
const {createPlan}=require('../scripts/deploy-n8n-meta-payjoy.cjs');
const source=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../.local/meta-payjoy-readonly-source.private.json'),'utf8'));
const snapshot=()=>({workflow:structuredClone(source),entity:{nodes:structuredClone(source.nodes),connections:structuredClone(source.connections)},
 credentials:[{id:source.nodes.find(n=>n.name==='Meta - Webhook Atendimento').credentials.httpHeaderAuth.id,name:'Meta Atendimento Interno',type:'httpHeaderAuth'}]});
test('upgrade plan preserves current graph and version; repeat validates without another patch',()=>{
 const s=snapshot(),p=createPlan(s);assert.equal(p.alreadyApplied,false);assert.equal(p.candidate.activeVersionId,s.workflow.activeVersionId);
 const published={...s,workflow:p.candidate,entity:{nodes:p.candidate.nodes,connections:p.candidate.connections}};
 assert.equal(createPlan(published).alreadyApplied,true);
 assert.throws(()=>createPlan({...s,entity:{...s.entity,connections:{}}}),/drift/);
});
test('SSH decoder preserves embedded Unicode node source split at every UTF-8 byte',async()=>{
 const expected={code:'₀₁₂₃₄₅₆₇₈₉ 😊 aprovação'};
 const connection={exec:(_cmd,callback)=>{const stream=new PassThrough();stream.stderr=new PassThrough();stream.end=()=>{
   queueMicrotask(()=>{for(const byte of Buffer.from(JSON.stringify(expected)))stream.write(Buffer.from([byte]));stream.emit('close',0);});
 };callback(null,stream);}};
 assert.deepEqual(await callRemote(connection,{mode:'inspect'}),expected);
});

test('PayJoy upgrade uses existing encrypted backup/CAS lifecycle and restores original graph if readiness fails',async()=>{
 let current=snapshot(),writes=0,failed=false;const initial=structuredClone(current),candidate=createPlan(current).candidate;
 current.services={n8n_n8n:{replicas:1},'n8n_n8n-runner':{replicas:1}};current.running=0;
 const calls=[];
 const remote=async r=>{calls.push(r.mode);
  if(r.mode==='inspect')return structuredClone(current);
  if(r.mode==='backup')return {encrypted:true,backupPath:'/restricted/synthetic-backup'};
  if(r.mode==='scale'){current.services[r.service].replicas=r.replicas;return {};}
  if(r.mode==='replicas')return {desired:current.services[r.service].replicas,running:current.services[r.service].replicas};
  if(r.mode==='ready'){if(!failed){failed=true;return {status:500};}return {status:200};}
  if(r.mode==='sql'){current.workflow=structuredClone(++writes===1?candidate:initial.workflow);current.entity={nodes:current.workflow.nodes,connections:current.workflow.connections};return {};}
  throw Error('Unexpected request');
 };
 let error;try{await deploy({apply:true,remote,buildPlan:createPlan,validate:()=>{},wait:async check=>{if(!await check())throw Error('readiness');}});}catch(e){error=e;}
 assert.equal(error.report.rollbackAttempted,true);assert.deepEqual(error.report.rollbackErrors,[]);assert.equal(writes,2);
 assert.equal(fingerprint(current.workflow),fingerprint(initial.workflow));assert.ok(calls.indexOf('backup')<calls.indexOf('scale'));
 assert.equal(current.services.n8n_n8n.replicas,1);assert.equal(current.services['n8n_n8n-runner'].replicas,1);
});
