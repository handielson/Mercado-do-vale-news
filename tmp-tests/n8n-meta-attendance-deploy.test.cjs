'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {WORKFLOW_ID,MAIN,RUNNER,CREDENTIAL_NAME,fingerprint,createPlan,casSql,validateGraph,deploy,waitFor,runValidation}=require('../scripts/deploy-n8n-meta-attendance.cjs');
const sourceFile=process.env.MDV_META_SOURCE_SNAPSHOT || path.resolve(__dirname,'../.local/meta-current-workflow.private.json');
const original=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
function snapshot(){return {workflow:structuredClone(original),entity:{nodes:structuredClone(original.nodes),connections:structuredClone(original.connections)},
 credentials:[{id:'credential-meta-real-test',name:CREDENTIAL_NAME,type:'httpHeaderAuth'}],running:0,
 services:{[MAIN]:{replicas:1},[RUNNER]:{replicas:1}}};}
function harness(options={}){
 let current=snapshot(),sqlCount=0,readyFailed=false;const initial=structuredClone(current);const candidate=createPlan(current).candidate;const calls=[];
 const remote=async request=>{calls.push(request);
  if(request.mode==='inspect')return structuredClone(current);
  if(request.mode==='backup')return {backupPath:'/root/n8n-backups/test.aes256gcm.json',encrypted:true};
  if(request.mode==='scale'){current.services[request.service].replicas=request.replicas;return {scaled:true};}
  if(request.mode==='replicas'){const n=current.services[request.service].replicas;return {desired:n,running:n};}
  if(request.mode==='ready'){if(options.failReady&&!readyFailed){readyFailed=true;return {status:500};}return {status:200};}
  if(request.mode==='registration')return {registered:options.registration!==false,unauthenticatedStatus:options.unauthenticatedStatus ?? 403};
  if(request.mode==='sql'){sqlCount++;current.workflow=structuredClone(sqlCount===1?candidate:initial.workflow);current.entity={nodes:structuredClone(current.workflow.nodes),connections:structuredClone(current.workflow.connections)};return {applied:true};}
  throw Error('Unexpected request '+request.mode);
 };
 const wait=async(check,label)=>{if(!await check())throw Error(label+' failed');};
 return {calls,remote,wait,initial,get current(){return current;},mutate:callback=>callback(current)};
}
test('plan requires one exact existing header credential and aligned active history',()=>{
 const s=snapshot();assert.equal(createPlan(s).credential.id,'credential-meta-real-test');
 for(const credentials of [[],[...s.credentials,...s.credentials],[{...s.credentials[0],type:'httpBasicAuth'}]])assert.throws(()=>createPlan({...s,credentials}),/existing/);
 assert.throws(()=>createPlan({...s,workflow:{...s.workflow,active:false}}),/active/);
 assert.throws(()=>createPlan({...s,workflow:{...s.workflow,versionId:'draft'}}),/draft/);
 assert.throws(()=>createPlan({...s,entity:{...s.entity,connections:{}}}),/drift/);
});
test('graph validator catches dangling targets, drifted auth and credentials',()=>{
 const p=createPlan(snapshot()),w=structuredClone(p.candidate);
 assert.equal(validateGraph(w,p.credential.id),true);
 w.connections['Meta - Webhook Atendimento'].main[0][0].node='missing';assert.throws(()=>validateGraph(w,p.credential.id),/target/);
 const auth=structuredClone(p.candidate);auth.nodes.find(n=>n.name==='Meta - Webhook Atendimento').parameters.authentication='none';
 assert.throws(()=>validateGraph(auth,p.credential.id),/schema/);
 assert.throws(()=>validateGraph(p.candidate,'other'),/binding/);
 const missingAck=structuredClone(p.candidate);missingAck.nodes=missingAck.nodes.filter(n=>n.name!=='WhatsApp - Confirmar recebimento webhook');
 missingAck.connections.Webhook=structuredClone(original.connections.Webhook);delete missingAck.connections['WhatsApp - Confirmar recebimento webhook'];
 assert.throws(()=>validateGraph(missingAck,p.credential.id),/ACK missing/);
 const lateAck=structuredClone(p.candidate);delete lateAck.nodes.find(n=>n.name==='Webhook').parameters.responseMode;
 assert.throws(()=>validateGraph(lateAck,p.credential.id));
 const wrongBody=structuredClone(p.candidate);wrongBody.nodes.find(n=>n.name==='WhatsApp - Confirmar recebimento webhook').parameters.responseBody='{}';
 assert.throws(()=>validateGraph(wrongBody,p.credential.id));
});
test('CAS updates entity and active history atomically without changing settings, credentials or staticData',()=>{
 const s=snapshot(),p=createPlan(s),sql=casSql(s,s.workflow,p.candidate);
 assert.match(sql,/^BEGIN;/);assert.match(sql,/COMMIT;$/);assert.match(sql,/workflow_entity.*FOR UPDATE/);assert.match(sql,/workflow_history.*FOR UPDATE/);
 assert.match(sql,/Meta entity CAS failed/);assert.match(sql,/Meta history CAS failed/);assert.equal((sql.match(/GET DIAGNOSTICS/g)||[]).length,2);
 assert.doesNotMatch(sql,/SET[\s\S]*(?:staticData\s*=|settings\s*=|credentials_entity)/);
 assert.match(sql,/active=true/);assert.match(sql,/"activeVersionId"=/);assert.match(sql,/connections::jsonb=/);
 assert.equal((sql.match(/UPDATE workflow_/g)||[]).length,2);
 assert.doesNotMatch(sql,/DELETE FROM webhook_entity/);
 assert.match(casSql(s,p.candidate,s.workflow),/DELETE FROM webhook_entity WHERE "workflowId"=.*"webhookPath"='meta-attendance'/);
});
test('dry run performs remote reads only and validates before returning',async()=>{
 const h=harness();let validated=0;
 const result=await deploy({remote:h.remote,wait:h.wait,validate:()=>validated++});
 assert.equal(validated,1);assert.equal(result.remoteWrites,false);assert.deepEqual(h.calls.map(c=>c.mode),['inspect']);
 assert.equal(fingerprint(h.current.workflow),fingerprint(h.initial.workflow));
});
test('apply backs up encrypted snapshot, stops main then runner, CAS publishes and verifies registered authenticated trigger',async()=>{
 const h=harness();const result=await deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}});
 assert.equal(result.entityHistoryAligned,true);assert.equal(result.servicesHealthy,true);
 assert.equal(result.registration.registered,true);assert.equal(result.activeVersionPreserved,true);
 assert.equal(result.registration.unauthenticatedStatus,403);
 const scale=h.calls.filter(c=>c.mode==='scale').map(c=>[c.service,c.replicas]);
 assert.deepEqual(scale,[[MAIN,0],[RUNNER,0],[MAIN,1],[RUNNER,1]]);
 assert.ok(h.calls.findIndex(c=>c.mode==='backup')<h.calls.findIndex(c=>c.mode==='scale'));
 assert.equal(h.calls.filter(c=>c.mode==='sql').length,1);
 assert.equal(h.current.workflow.activeVersionId,h.initial.workflow.activeVersionId);
});
test('idempotent repeat verifies registration and skips remote writes/restart',async()=>{
 const h=harness();await deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}});h.calls.length=0;
 const result=await deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}});
 assert.equal(result.alreadyApplied,true);assert.equal(result.restartSkipped,true);
 assert.deepEqual(h.calls.map(c=>c.mode),['inspect','registration']);
});
test('Header Auth rejects 200, Basic Auth 401 and broken credential 500 during publication',async()=>{
 for(const status of [200,401,500]){
  const h=harness({unauthenticatedStatus:status});
  await assert.rejects(deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}}),/reject unauthenticated/);
  assert.equal(fingerprint(h.current.workflow),fingerprint(h.initial.workflow),'Rollback for HTTP '+status);
 }
});
test('idempotent verification also requires actual Header Auth rejection 403',async()=>{
 for(const status of [200,401,500]){
  const h=harness();await deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}});h.calls.length=0;
  const remote=request=>request.mode==='registration'?Promise.resolve({registered:true,unauthenticatedStatus:status}):h.remote(request);
  await assert.rejects(deploy({apply:true,remote,wait:h.wait,validate:()=>{}}),/authentication failed/);
  assert.equal(h.calls.some(c=>c.mode==='scale'||c.mode==='sql'),false);
 }
});
test('validation failure and active execution refuse publication before stopping services',async()=>{
 const h=harness();await assert.rejects(deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{throw Error('regression');}}),/regression/);
 assert.deepEqual(h.calls.map(c=>c.mode),['inspect']);h.calls.length=0;h.mutate(s=>s.running=1);
 await assert.rejects(deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}}),/executions/);
 assert.deepEqual(h.calls.map(c=>c.mode),['inspect','inspect']);
});
test('post-restart readiness failure rolls both graphs back with CAS and recovers services',async()=>{
 const h=harness({failReady:true});let failure;
 try{await deploy({apply:true,remote:h.remote,wait:h.wait,validate:()=>{}});}catch(error){failure=error;}
 assert.ok(failure);assert.equal(failure.report.rollbackAttempted,true);assert.deepEqual(failure.report.rollbackErrors,[]);
 assert.equal(h.calls.filter(c=>c.mode==='sql').length,2);
 assert.equal(fingerprint(h.current.workflow),fingerprint(h.initial.workflow));
 assert.equal(h.current.services[MAIN].replicas,1);assert.equal(h.current.services[RUNNER].replicas,1);
});
test('runtime drift after validation aborts without replacing concurrent edits',async()=>{
 const h=harness();let inspectCount=0;
 const remote=async request=>{if(request.mode==='inspect'&&++inspectCount===2)h.mutate(s=>{s.workflow.nodes[0].notes='new concurrent edit';s.entity.nodes=structuredClone(s.workflow.nodes);});return h.remote(request);};
 await assert.rejects(deploy({apply:true,remote,wait:h.wait,validate:()=>{}}),/changed since validation/);
 assert.equal(h.calls.filter(c=>c.mode==='sql').length,0);assert.equal(h.current.workflow.nodes[0].notes,'new concurrent edit');
 assert.equal(h.current.services[MAIN].replicas,1);
});
test('waits are bounded and stop immediately on readiness',async()=>{
 let attempts=0,sleeps=0;
 await waitFor(async()=>++attempts===2,'test',{attempts:3,delay:1,sleep:async()=>sleeps++});assert.equal(attempts,2);assert.equal(sleeps,1);
 await assert.rejects(waitFor(async()=>false,'test',{attempts:2,sleep:async()=>{}}),/timeout/);
});
test('local validator loads committed gate and redacts failures instead of exposing inherited workflow data',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mdv-meta-deploy-test-'));
 const s=snapshot(),plan=createPlan(s),calls=[];
 try{const result=runValidation(s,plan,{root:directory,spawn:(cmd,args)=>{calls.push([cmd,args]);
  return {status:0,stdout:cmd==='git'?'module.exports = {};':''};}});
  assert.equal(result.validated,true);assert.deepEqual(calls[0][1],['show','HEAD:scripts/n8n-sales-regression-gate.cjs']);
  assert.equal(calls.length,3);assert.ok(fs.existsSync(result.targetPath));
  const privateRoot=path.resolve(directory,'.local');for(const f of fs.readdirSync(privateRoot))fs.unlinkSync(path.join(privateRoot,f));fs.rmdirSync(privateRoot);
 }finally{fs.rmdirSync(directory);}
});
