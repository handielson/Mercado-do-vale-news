'use strict';
// Dry-run by default. Credentials are discovered by metadata only, never created.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const {patchWhatsAppWebhookAck,ACK_NAME}=require('./n8n-whatsapp-webhook-ack.cjs');
const {patchWorkflow,NAMES,NORMALIZE,AGGREGATE,BLOCKED}=require('./build-n8n-meta-attendance.cjs');
const WORKFLOW_ID='SkrkB4vyKVDnQ68t';
const MAIN='n8n_n8n',RUNNER='n8n_n8n-runner';
const CREDENTIAL_NAME='Meta Atendimento Interno';
const fingerprint=w=>crypto.createHash('sha256').update(JSON.stringify({nodes:w.nodes,connections:w.connections})).digest('hex');
const sqlLiteral=value=>"'"+String(value).replace(/'/g,"''")+"'";
const jsonSql=value=>`convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('hex')}','hex'),'UTF8')::json`;
function assertAligned(snapshot){
 assert.equal(snapshot.workflow?.id,WORKFLOW_ID,'Unexpected workflow identity');
 assert.equal(snapshot.workflow.active,true,'Workflow must already be active');
 assert.ok(snapshot.workflow.activeVersionId,'Active version missing');
 assert.equal(snapshot.workflow.versionId,snapshot.workflow.activeVersionId,'Unpublished draft exists; preserve it');
 assert.equal(fingerprint(snapshot.entity),fingerprint(snapshot.workflow),'Entity/history drift; preserve draft');
}
function validateGraph(w,credentialId){
 const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length,'Duplicate node names');
 for(const [name,outputs]of Object.entries(w.connections)){assert.ok(names.has(name),'Unknown source node');
  for(const groups of Object.values(outputs))for(const group of groups)for(const e of group){assert.ok(names.has(e.node),'Unknown target node');assert.ok(Number.isInteger(e.index)&&e.index>=0,'Invalid edge index');}}
 const get=name=>{const n=w.nodes.find(n=>n.name===name);assert.ok(n,'Missing Meta boundary');return n;};
 assert.deepEqual(get(NAMES.webhook).parameters,{httpMethod:'POST',path:'meta-attendance',authentication:'headerAuth',responseMode:'responseNode',options:{}},'Webhook schema drift');
 assert.equal(get(NAMES.webhook).credentials?.httpHeaderAuth?.id,credentialId,'Inbound credential binding drift');
 assert.equal(get(NAMES.respond).parameters.respondWith,'firstIncomingItem','Response contract drift');
 assert.equal(get(NAMES.normalize).parameters.jsCode,NORMALIZE,'Normalizer drift');
 assert.equal(get(NAMES.aggregate).parameters.jsCode,AGGREGATE,'Aggregator drift');
 assert.equal(get(NAMES.blocked).parameters.jsCode,BLOCKED,'Blocked contract drift');
 assert.ok(w.nodes.some(n=>n.name===ACK_NAME),'WhatsApp immediate ACK missing');
 assert.deepEqual(patchWhatsAppWebhookAck(w),w,'WhatsApp ACK contract drift');
 for(const n of w.nodes)if(n.parameters?.jsCode)new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',n.parameters.jsCode);
 return true;
}
function createPlan(snapshot){
 assertAligned(snapshot);
 const credentials=snapshot.credentials.filter(c=>c.type==='httpHeaderAuth'&&c.name===CREDENTIAL_NAME);
 assert.equal(credentials.length,1,'Exactly one existing Meta Atendimento Interno Header Auth credential is required');
 const credential=credentials[0];
 assert.ok(credential.id && credential.id!=='meta-attendance-header','Real credential ID required');
 const alreadyApplied=snapshot.workflow.nodes.some(n=>n.name===NAMES.webhook);
 const candidate=alreadyApplied?structuredClone(snapshot.workflow):patchWorkflow(snapshot.workflow,{credentialId:credential.id});
 validateGraph(candidate,credential.id);
 return {candidate,alreadyApplied,credential:{id:credential.id,name:credential.name,type:credential.type},
  beforeSha256:fingerprint(snapshot.workflow),afterSha256:fingerprint(candidate)};
}
function casSql(snapshot,expected,next){
 assertAligned(snapshot);
 const id=sqlLiteral(WORKFLOW_ID),version=sqlLiteral(snapshot.workflow.activeVersionId);
 return `BEGIN;
DO $meta_cas$ DECLARE affected integer; BEGIN
 PERFORM 1 FROM workflow_entity WHERE id=${id} FOR UPDATE;
 PERFORM 1 FROM workflow_history WHERE "workflowId"=${id} AND "versionId"=${version} FOR UPDATE;
 UPDATE workflow_entity SET nodes=${jsonSql(next.nodes)},connections=${jsonSql(next.connections)},"updatedAt"=CURRENT_TIMESTAMP
 WHERE id=${id} AND active=true AND "activeVersionId"=${version} AND "versionId"=${version}
 AND nodes::jsonb=(${jsonSql(expected.nodes)})::jsonb AND connections::jsonb=(${jsonSql(expected.connections)})::jsonb;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Meta entity CAS failed'; END IF;
 UPDATE workflow_history SET nodes=${jsonSql(next.nodes)},connections=${jsonSql(next.connections)},"updatedAt"=CURRENT_TIMESTAMP
 WHERE "workflowId"=${id} AND "versionId"=${version}
 AND nodes::jsonb=(${jsonSql(expected.nodes)})::jsonb AND connections::jsonb=(${jsonSql(expected.connections)})::jsonb;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Meta history CAS failed'; END IF;
END $meta_cas$;
${expected.nodes.some(n=>n.name===NAMES.webhook)&&!next.nodes.some(n=>n.name===NAMES.webhook)?`DELETE FROM webhook_entity WHERE "workflowId"=${id} AND method='POST' AND "webhookPath"='meta-attendance';`:''}
COMMIT;`;
}
// Executed on the VPS via node stdin. It never emits child-process stderr or env.
async function remoteProgram(request){
 const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');
 const execute=(args,input)=>cp.execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000,maxBuffer:16*1024*1024}).trim();
 const db=execute(['ps','--filter','label=com.docker.swarm.service.name=n8n_n8n-db','--format','{{.Names}}']).split('\n').filter(Boolean);
 if(db.length!==1 || !/^n8n_n8n-db[.\w-]*$/.test(db[0]))throw Error('Postgres container unavailable');
 const sql=text=>execute(['exec','-i',db[0],'psql','-U','postgres','-d','n8n','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],text);
 const parse=text=>JSON.parse(sql(text));
 const workflowId='SkrkB4vyKVDnQ68t';
 if(request.mode==='inspect'){
  const row=parse(`SELECT json_build_object('workflow',json_build_object('id',w.id,'name',w.name,'active',w.active,'versionId',w."versionId",'activeVersionId',w."activeVersionId",'settings',w.settings,'nodes',h.nodes,'connections',h.connections),
   'entity',json_build_object('nodes',w.nodes,'connections',w.connections),
   'credentials',(SELECT COALESCE(json_agg(json_build_object('id',id,'name',name,'type',type)),'[]'::json) FROM credentials_entity WHERE name='Meta Atendimento Interno' AND type='httpHeaderAuth'),
   'running',(SELECT COUNT(*) FROM execution_entity WHERE "workflowId"=w.id AND status IN ('new','running')))
   FROM workflow_entity w JOIN workflow_history h ON h."workflowId"=w.id AND h."versionId"=w."activeVersionId" WHERE w.id='${workflowId}';`);
  const services={};for(const name of ['n8n_n8n','n8n_n8n-runner']){const spec=JSON.parse(execute(['service','inspect',name]))[0];services[name]={replicas:spec.Spec.Mode?.Replicated?.Replicas,image:spec.Spec.TaskTemplate.ContainerSpec.Image};}
  return {...row,services};
 }
 if(request.mode==='sql'){sql(request.sql);return {applied:true};}
 if(request.mode==='scale'){
  if(!['n8n_n8n','n8n_n8n-runner'].includes(request.service)||![0,1].includes(request.replicas))throw Error('Invalid service target');
  execute(['service','scale',request.service+'='+request.replicas]);return {scaled:true};
 }
 if(request.mode==='replicas'){
  if(!['n8n_n8n','n8n_n8n-runner'].includes(request.service))throw Error('Invalid service target');
  const s=JSON.parse(execute(['service','inspect',request.service]))[0];
  const tasks=execute(['service','ps',request.service,'--format','{{.CurrentState}}','--filter','desired-state=running']).split('\n').filter(Boolean);
  return {desired:s.Spec.Mode?.Replicated?.Replicas,running:tasks.filter(v=>/^Running\b/.test(v)).length};
 }
 if(request.mode==='backup'){
  const spec=JSON.parse(execute(['service','inspect','n8n_n8n']))[0];
  const encryptionKeys=(spec.Spec.TaskTemplate.ContainerSpec.Env||[]).filter(e=>e.startsWith('N8N_ENCRYPTION_KEY='));
  if(encryptionKeys.length>1)throw Error('Ambiguous backup key');
  let encryptionKey=encryptionKeys[0]?.slice('N8N_ENCRYPTION_KEY='.length);
  if(!encryptionKey){const main=execute(['ps','--filter','name=n8n_n8n.1','--format','{{.Names}}']).split('\n').filter(Boolean);
   if(main.length!==1)throw Error('Backup key config unavailable');
   encryptionKey=JSON.parse(execute(['exec',main[0],'cat','/home/node/.n8n/config'])).encryptionKey;}
  if(typeof encryptionKey!=='string'||encryptionKey.length<16)throw Error('Encrypted backup key unavailable');
  const key=crypto.createHash('sha256').update(encryptionKey).digest();
  const full=parse(`SELECT json_build_object('entity',row_to_json(w),'history',row_to_json(h)) FROM workflow_entity w JOIN workflow_history h ON h."workflowId"=w.id AND h."versionId"=w."activeVersionId" WHERE w.id='${workflowId}';`);
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(full),'utf8'),cipher.final()]);
  const directory='/root/n8n-backups';fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.chmodSync(directory,0o700);
  const target=directory+'/meta-attendance-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex')+'.aes256gcm.json';
  fs.writeFileSync(target,JSON.stringify({schemaVersion:1,keySource:'n8n encryption key SHA256',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}),{mode:0o600,flag:'wx'});
  return {backupPath:target,encrypted:true};
 }
 if(request.mode==='ready'){
  const response=await fetch('https://n8n.mercadodovale.com.br/healthz/readiness',{signal:AbortSignal.timeout(10000)});
  return {status:response.status};
 }
 if(request.mode==='registration'){
  const result=parse(`SELECT json_build_object('registered',COUNT(*)=1) FROM webhook_entity WHERE "workflowId"='${workflowId}' AND method='POST' AND "webhookPath"='meta-attendance';`);
  // Installed n8n 2.38.5 Webhook/utils.js rejects missing or wrong Header Auth
  // with 403. A 500 means missing credentials; it is not successful rejection.
  const response=await fetch('https://n8n.mercadodovale.com.br/webhook/meta-attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  return {...result,unauthenticatedStatus:response.status};
 }
 throw Error('Unknown remote mode');
}
function callRemote(connection,request){
 const program=`(${remoteProgram.toString()})(${JSON.stringify(request)}).then(value=>process.stdout.write(JSON.stringify(value))).catch(()=>{process.stderr.write('remote operation failed; sensitive output omitted');process.exitCode=1;});`;
 return new Promise((resolve,reject)=>connection.exec('node',(error,stream)=>{
  if(error)return reject(Error('SSH command could not start'));
  let output='';stream.on('data',chunk=>{output+=chunk;});stream.stderr.on('data',()=>{});
  stream.on('close',code=>{if(code!==0)return reject(Error('Remote '+request.mode+' failed; sensitive output omitted'));try{resolve(JSON.parse(output));}catch{reject(Error('Invalid sanitized remote response'));}});stream.end(program);
 }));
}
function runValidation(snapshot,plan,{root=path.resolve(__dirname,'..'),spawn=spawnSync}={}){
 const directory=path.join(root,'.local');fs.mkdirSync(directory,{recursive:true});
 const stamp=crypto.randomBytes(8).toString('hex');
 const sourcePath=path.join(directory,'meta-deploy-source-'+stamp+'.private.json');
 const targetPath=path.join(directory,'meta-deploy-candidate-'+stamp+'.private.json');
 fs.writeFileSync(sourcePath,JSON.stringify(snapshot.workflow),{mode:0o600,flag:'wx'});
 fs.writeFileSync(targetPath,JSON.stringify(plan.candidate),{mode:0o600,flag:'wx'});
 // Read the committed gate explicitly: unrelated working-tree changes are not
 // authority to alter this release's commercial regression selection.
 const gate=spawn('git',['show','HEAD:scripts/n8n-sales-regression-gate.cjs'],{cwd:root,encoding:'utf8'});
 assert.equal(gate.status,0,'Committed commercial gate unavailable');
 const gatePath=path.join(directory,'meta-committed-gate-'+stamp+'.cjs');
 fs.writeFileSync(gatePath,gate.stdout,{mode:0o600,flag:'wx'});
 try{
  const commercial=spawn(process.execPath,[gatePath,'--snapshot',targetPath],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(commercial.status,0,'Committed commercial regression gate failed; inspect private candidate locally');
  // Focused tests rebuild the exact candidate from its unpatched baseline,
  // including idempotent repeats, without publishing a placeholder credential.
  let focusedSourcePath=sourcePath;
  if(plan.alreadyApplied){focusedSourcePath=null;
   const possible=fs.readdirSync(directory).filter(name=>/^meta-deploy-source-[a-f0-9]+\.private\.json$/.test(name));
   for(const name of possible){try{const saved=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
    if(saved.nodes.some(n=>n.name===NAMES.webhook))continue;
    if(fingerprint(patchWorkflow(saved,{credentialId:plan.credential.id}))===plan.afterSha256){focusedSourcePath=path.join(directory,name);break;}
   }catch{}}
   assert.ok(focusedSourcePath,'Matching unpatched local baseline required for repeat focused validation');
  }
  const focused=spawn(process.execPath,['--test','tmp-tests/n8n-meta-attendance-patch.test.cjs','tmp-tests/n8n-meta-attendance-deploy.test.cjs'],{
   cwd:root,encoding:'utf8',env:{...process.env,MDV_META_SOURCE_SNAPSHOT:focusedSourcePath},maxBuffer:16*1024*1024});
  assert.equal(focused.status,0,'Focused Meta regression tests failed');
  assert.equal(fingerprint(JSON.parse(fs.readFileSync(targetPath,'utf8'))),plan.afterSha256,'Candidate changed during tests');
  return {validated:true,commercialGate:'HEAD:scripts/n8n-sales-regression-gate.cjs',sourcePath,targetPath};
 }finally{fs.unlinkSync(gatePath);}
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check,label,{attempts=35,delay=2000,sleep=pause}={}){
 for(let i=0;i<attempts;i++){try{if(await check())return;}catch{}if(i+1<attempts)await sleep(delay);}
 throw Error(label+' readiness timeout');
}
async function deploy({apply=false,remote,validate=runValidation,wait=waitFor,report=()=>{}}){
 let snapshot,plan,backupPath,stopped=false,mayHaveChanged=false;
 const scale=async(service,replicas)=>{await remote({mode:'scale',service,replicas});await wait(async()=>{const s=await remote({mode:'replicas',service});return s.desired===replicas&&s.running===replicas;},service);};
 const start=async()=>{await scale(MAIN,1);await wait(async()=>(await remote({mode:'ready'})).status===200,'n8n health');await scale(RUNNER,1);};
 try{
  snapshot=await remote({mode:'inspect'});plan=createPlan(snapshot);
  for(const service of [MAIN,RUNNER])assert.equal(snapshot.services?.[service]?.replicas,1,'Expected one existing service replica');
  validate(snapshot,plan);
  const summary={apply,workflowId:WORKFLOW_ID,credential:plan.credential,beforeSha256:plan.beforeSha256,afterSha256:plan.afterSha256,nodes:plan.candidate.nodes.length,alreadyApplied:plan.alreadyApplied};
  if(!apply){report({...summary,remoteWrites:false});return {...summary,remoteWrites:false};}
  if(plan.alreadyApplied){const registration=await remote({mode:'registration'});assert.equal(registration.registered,true,'Existing webhook not registered');assert.equal(registration.unauthenticatedStatus,403,'Existing webhook authentication failed');return {...summary,restartSkipped:true};}
  await wait(async()=>Number((await remote({mode:'inspect'})).running)===0,'Active workflow executions');
  const backup=await remote({mode:'backup'});assert.equal(backup.encrypted,true,'Encrypted backup required');backupPath=backup.backupPath;
  // Main first prevents new webhooks while the runner finishes current work.
  stopped=true;await scale(MAIN,0);await scale(RUNNER,0);
  const stoppedSnapshot=await remote({mode:'inspect'});assertAligned(stoppedSnapshot);
  assert.equal(fingerprint(stoppedSnapshot.workflow),plan.beforeSha256,'Runtime changed since validation; abort without overwriting');
  assert.equal(Number(stoppedSnapshot.running),0,'Workflow execution still active');
  mayHaveChanged=true;await remote({mode:'sql',sql:casSql(snapshot,snapshot.workflow,plan.candidate)});
  await start();
  const published=await remote({mode:'inspect'});assertAligned(published);
  assert.equal(fingerprint(published.workflow),plan.afterSha256,'Published workflow fingerprint mismatch');
  const registration=await remote({mode:'registration'});
  assert.equal(registration.registered,true,'Meta webhook database registration missing');
  assert.equal(registration.unauthenticatedStatus,403,'Meta webhook must reject unauthenticated input');
  stopped=false;
  const result={...summary,backupPath,entityHistoryAligned:true,activeVersionPreserved:true,registration,servicesHealthy:true};report(result);return result;
 }catch(error){
  const rollbackErrors=[];
  if(stopped){
   for(const service of [MAIN,RUNNER])try{await scale(service,0);}catch{rollbackErrors.push(service+' stop failed');}
   if(mayHaveChanged)try{const current=await remote({mode:'inspect'});const actual=fingerprint(current.workflow);
    if(actual===plan.afterSha256)await remote({mode:'sql',sql:casSql(snapshot,plan.candidate,snapshot.workflow)});
    else if(actual!==plan.beforeSha256)throw Error('Concurrent workflow change');
   }catch{rollbackErrors.push('Workflow rollback CAS failed; encrypted backup requires review');}
   try{await start();}catch{rollbackErrors.push('Service recovery failed');}
  }
  const failure=Error('Meta n8n deployment failed: '+String(error.message).split('\n')[0].slice(0,160));
  failure.report={failed:true,apply,backupPath:backupPath||null,rollbackAttempted:stopped,rollbackErrors};throw failure;
 }
}
module.exports={WORKFLOW_ID,MAIN,RUNNER,CREDENTIAL_NAME,fingerprint,assertAligned,validateGraph,createPlan,casSql,remoteProgram,runValidation,waitFor,deploy};
if(require.main===module)(async()=>{
 const args=process.argv.slice(2);assert.ok(args.every(v=>v==='--apply')&&args.length<=1,'Only --apply is supported');
 const {Client}=require('ssh2'),{getVpsSshConfig}=require('../tmp-tests/vps-ssh-config.cjs');
 const connection=new Client();
 await new Promise((resolve,reject)=>connection.once('ready',resolve).once('error',()=>reject(Error('SSH connection failed'))).connect(getVpsSshConfig()));
 try{const result=await deploy({apply:args.includes('--apply'),remote:request=>callRemote(connection,request)});console.log(JSON.stringify(result,null,2));}finally{connection.end();}
})().catch(error=>{console.error(JSON.stringify({message:String(error.message).split('\n')[0].slice(0,220),...error.report}));process.exitCode=1;});
