'use strict';
// Reuses the guarded backup/CAS/rollback lifecycle; changes only the Meta image adapter.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const base=require('./deploy-n8n-meta-attendance.cjs');
const {NORMALIZE}=require('./build-n8n-meta-attendance.cjs');
const {patchMetaPayjoyWorkflow,patchMetaNormalizerCode,validateMetaPayjoyWorkflow}=require('./n8n-meta-payjoy-images.cjs');
function createPlan(snapshot){
 base.assertAligned(snapshot);
 const credentials=snapshot.credentials.filter(c=>c.name===base.CREDENTIAL_NAME&&c.type==='httpHeaderAuth');
 assert.equal(credentials.length,1,'Existing Meta credential required');
 const credential=credentials[0];
 const candidate=patchMetaPayjoyWorkflow(snapshot.workflow);
 validateMetaPayjoyWorkflow(candidate);
 base.validateGraph(candidate,credential.id,{normalizeCode:patchMetaNormalizerCode(NORMALIZE)});
 return {candidate,credential:{id:credential.id,name:credential.name,type:credential.type},
  beforeSha256:base.fingerprint(snapshot.workflow),afterSha256:base.fingerprint(candidate),
  alreadyApplied:base.fingerprint(snapshot.workflow)===base.fingerprint(candidate)};
}
function runValidation(snapshot,plan){
 const root=path.resolve(__dirname,'..'),directory=path.join(root,'.local');fs.mkdirSync(directory,{recursive:true});
 const sourcePath=path.join(directory,'meta-payjoy-source.private.json'),targetPath=path.join(directory,'meta-payjoy-candidate.private.json');
 fs.writeFileSync(sourcePath,JSON.stringify(snapshot.workflow),{mode:0o600});
 fs.writeFileSync(targetPath,JSON.stringify(plan.candidate),{mode:0o600});
 const baselinePath=path.join(directory,'meta-payjoy-readonly-source.private.json');
 if(!plan.alreadyApplied)fs.writeFileSync(baselinePath,JSON.stringify(snapshot.workflow),{mode:0o600});
 for(const args of [['scripts/n8n-sales-regression-gate.cjs','--snapshot',targetPath],
  ['--test','tmp-tests/n8n-meta-payjoy-images.test.cjs','tmp-tests/meta-attendance-replies.test.cjs','tmp-tests/meta-attendance-media.test.cjs']]){
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,
   env:{...process.env,MDV_META_PAYJOY_SNAPSHOT:baselinePath,MDV_META_PAYJOY_CANDIDATE:targetPath}});
  // Only local files contain diagnostics. Upstream node code may contain inherited secrets.
  fs.writeFileSync(path.join(directory,args[0]==='--test'?'meta-payjoy-focused.log':'meta-payjoy-commercial.log'),result.stdout+result.stderr,{mode:0o600});
  assert.equal(result.status,0,'Meta PayJoy validation failed; inspect local test log');
 }
 assert.equal(base.fingerprint(JSON.parse(fs.readFileSync(targetPath,'utf8'))),plan.afterSha256,'Validated candidate changed');
 return {validated:true,targetPath,sourcePath};
}
async function main(){
 const args=process.argv.slice(2);assert.ok(args.length<=1&&args.every(v=>v==='--apply'),'Only --apply supported');
 const {Client}=require('ssh2'),{getVpsSshConfig}=require('../tmp-tests/vps-ssh-config.cjs');
 const connection=new Client();
 await new Promise((resolve,reject)=>connection.once('ready',resolve).once('error',()=>reject(Error('SSH unavailable'))).connect(getVpsSshConfig()));
 try{console.log(JSON.stringify(await base.deploy({apply:args.includes('--apply'),remote:r=>base.callRemote(connection,r),buildPlan:createPlan,validate:runValidation}),null,2));}
 finally{connection.end();}
}
module.exports={createPlan,runValidation};
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({message:e.message,...e.report}));process.exitCode=1;});
