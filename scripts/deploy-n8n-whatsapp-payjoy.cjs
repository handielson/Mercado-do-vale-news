'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const base=require('./deploy-n8n-meta-attendance.cjs');
const {patchWhatsAppPayjoyWorkflow,validate}=require('./n8n-whatsapp-payjoy-images.cjs');
const {validateMetaPayjoyWorkflow,patchMetaNormalizerCode}=require('./n8n-meta-payjoy-images.cjs');
const {NORMALIZE}=require('./build-n8n-meta-attendance.cjs');
function createPlan(snapshot){
 base.assertAligned(snapshot);
 const credential=snapshot.credentials.find(c=>c.name===base.CREDENTIAL_NAME&&c.type==='httpHeaderAuth');assert.ok(credential);
 const candidate=patchWhatsAppPayjoyWorkflow(snapshot.workflow);validate(candidate);validateMetaPayjoyWorkflow(candidate);
 base.validateGraph(candidate,credential.id,{normalizeCode:patchMetaNormalizerCode(NORMALIZE)});
 return {candidate,credential,beforeSha256:base.fingerprint(snapshot.workflow),afterSha256:base.fingerprint(candidate),alreadyApplied:base.fingerprint(snapshot.workflow)===base.fingerprint(candidate)};
}
function runValidation(snapshot,plan){
 const root=path.resolve(__dirname,'..'),sourcePath=path.join(root,'.local/whatsapp-payjoy-source.private.json'),targetPath=path.join(root,'.local/whatsapp-payjoy-candidate.private.json');
 fs.writeFileSync(sourcePath,JSON.stringify(snapshot.workflow),{mode:0o600});fs.writeFileSync(targetPath,JSON.stringify(plan.candidate),{mode:0o600});
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'.local/whatsapp-payjoy-native-evidence.private.json'),'utf8'));
 assert.equal(evidence.sha256,plan.afterSha256,'Native model evidence must match exact candidate');assert.equal(evidence.passed,true);
 assert.ok(evidence.cases.length>=8);assert.ok(Date.now()-Date.parse(evidence.testedAt)<3600000,'Native evidence expired');
 for(const id of ['selected-photo','selected-Quanto fica a entrada desse aparelho?','selected-Vou retirar na loja','selected-Qual o valor da entrada?','selected-Quanto eu preciso pagar de entrada?'])
  assert.ok(evidence.cases.some(c=>c.case===id&&c.passed),'Missing cold-execution selected-device evidence: '+id);
 for(const args of [['scripts/n8n-sales-regression-gate.cjs','--snapshot',targetPath],['--test','tmp-tests/n8n-whatsapp-payjoy-images.test.cjs','tmp-tests/n8n-conversation-state-api-static.test.mjs']]){
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:16e6,env:{...process.env,MDV_WA_PAYJOY_SOURCE:sourcePath,MDV_WA_PAYJOY_CANDIDATE:targetPath}});
  fs.writeFileSync(path.join(root,'.local/whatsapp-payjoy-'+(args[0]==='--test'?'focused':'commercial')+'.log'),r.stdout+r.stderr,{mode:0o600});
  assert.equal(r.status,0,'Candidate validation failed; inspect private log');
 }
 return {validated:true};
}
async function protectedProof(connection,phone){
 assert.ok(/^\d{10,15}$/.test(phone),'Protected phone required');
 const script=`(async()=>{const fs=require('fs'),crypto=require('crypto');process.chdir('/var/www/mdv-api');require('/var/www/mdv-api/node_modules/dotenv').config({quiet:true});const db=await require('/var/www/mdv-api/node_modules/mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});try{const [rows]=await db.query('SELECT blocked,human_handoff_until,human_handoff_by FROM n8n_bot_client_controls WHERE phone=? OR remote_jid=? ORDER BY remote_jid',[${JSON.stringify(phone)},${JSON.stringify(phone+'@s.whatsapp.net')}]);const [[check]]=await db.query('SELECT COUNT(*) AS paused FROM n8n_bot_client_controls WHERE (phone=? OR remote_jid=?) AND (blocked=1 OR human_handoff_until>CURRENT_TIMESTAMP)',[${JSON.stringify(phone)},${JSON.stringify(phone+'@s.whatsapp.net')}]);const entry=fs.readFileSync('/var/www/mdv-api/vps_server.cjs','utf8');const block=entry.slice(entry.indexOf('const N8N_BOT_CONVERSATION_STATE_KEYS'),entry.indexOf('const N8N_BOT_CONVERSATION_STATE_MAX_BYTES'));console.log(JSON.stringify({count:rows.length,paused:check.paused>0,sha256:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),apiSupportsPayjoy:block.includes("'payjoyByJid'")}));}finally{await db.end();}})().catch(()=>{process.stderr.write('proof failed');process.exitCode=1});`;
 return new Promise((resolve,reject)=>connection.exec('node --input-type=commonjs -',(e,s)=>{if(e)return reject(e);let out='';s.setEncoding('utf8');s.on('data',b=>out+=b);s.stderr.on('data',()=>{});s.on('close',code=>{if(code)return reject(Error('Protected pause verification failed'));try{resolve(JSON.parse(out));}catch{reject(Error('Invalid proof'));}});s.end(script);}));
}
async function main(){
 const args=process.argv.slice(2),apply=args.includes('--apply'),i=args.indexOf('--protected-phone');
 assert.ok(i>=0&&args[i+1],'--protected-phone is required');const phone=args[i+1];
 const {Client}=require('ssh2'),{getVpsSshConfig}=require('../tmp-tests/vps-ssh-config.cjs');const c=new Client();
 await new Promise((a,b)=>c.on('ready',a).on('error',b).connect(getVpsSshConfig()));
 try{
  const before=await protectedProof(c,phone);assert.equal(before.count,1,'Protected conversation identity ambiguous');assert.equal(before.paused,true,'Manual pause must already be active');
  if(apply)assert.equal(before.apiSupportsPayjoy,true,'Publish API state allowlist first');
  const result=await base.deploy({apply,remote:r=>base.callRemote(c,r),buildPlan:createPlan,validate:runValidation});
  const after=await protectedProof(c,phone);assert.equal(after.paused,true,'Protected manual pause changed');assert.equal(after.sha256,before.sha256,'Protected pause fields were changed');
  console.log(JSON.stringify({...result,manualPausePreserved:true,realMessagesSent:0},null,2));
 }finally{c.end();}
}
module.exports={createPlan,runValidation,protectedProof};
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({message:e.message,...e.report}));process.exitCode=1;});
