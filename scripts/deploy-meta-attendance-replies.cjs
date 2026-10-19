'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {Client}=require('ssh2');
const {getVpsSshConfig}=require('../tmp-tests/vps-ssh-config.cjs');
const FILES=['services/metaAttendanceServer.cjs','services/metaAttendanceReplies.cjs','services/metaAttendanceTransport.cjs','services/metaAttendanceMedia.cjs'];
const BASELINE_COMMIT='3a2d4db371fa51a0c647c4541bb53e91cced70f0';
function validateProof(attestation,modules,now=Date.now()){
 const digest=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
 const age=now-Date.parse(attestation?.at);
 return attestation?.ok===true&&attestation.metaSends===0&&age>=0&&age<3600000
   && ['instagram','messenger'].every(channel=>[1,2,3].every(turn=>attestation.turns?.some(t=>t.channel===channel&&t.turn===turn&&(turn===3?t.humanPauseRespected===true:t.statePersisted===true))))
   && FILES.every(file=>typeof modules[file]==='string'&&attestation.moduleHashes?.[file]===digest(modules[file]));
}
function patchEnvironment(source,values){
 let result=source;
 for(const [key,value] of Object.entries(values)){
  if(!['META_ATTENDANCE_REPLIES_ENABLED','META_ATTENDANCE_N8N_URL','META_ATTENDANCE_N8N_KEY'].includes(key)||/[\r\n"']/.test(value))throw Error('Invalid environment patch');
  const expression=new RegExp('^'+key+'=.*$','gm'),matches=[...result.matchAll(expression)];
  if(matches.length>1)throw Error('Duplicate environment key');
  result=matches.length?result.replace(expression,key+'='+value):result.replace(/\s*$/,'')+'\n'+key+'='+value+'\n';
 }
 return result;
}
async function remote(bundle){
 const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
 const root='/var/www/mdv-api';process.chdir(root);require('dotenv').config({quiet:true});
 const processes=JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'})).filter(p=>p.name==='mdv-api');
 if(processes.length!==1||processes[0].pm2_env.pm_cwd!==root||processes[0].pm2_env.pm_exec_path!==root+'/server.js')throw Error('Unexpected runtime');
 const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
 const clean=s=>s===null?null:s.replace(/\r\n/g,'\n');
 const oldEnv=fs.readFileSync(root+'/.env','utf8');
 const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
 async function restart(values){
  cp.execFileSync('pm2',['restart','mdv-api','--update-env'],{stdio:'pipe',env:{...process.env,...values}});
  for(let i=0;i<30;i++){
   try{const r=await fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/status',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).mysql?.ok===true)return;}catch{}
   await new Promise(r=>setTimeout(r,1000));
  }throw Error('API readiness failed');
 }
 try{
  require('./services/autoresponderCatalogPreferences.cjs');
  if(bundle.activate){
   const [[runtime]]=await db.query('SELECT * FROM meta_attendance_runtime WHERE id=1');
   if(runtime?.enabled&&process.env.META_ATTENDANCE_REPLIES_ENABLED==='true'){console.log(JSON.stringify({activated:true,changed:false}));return;}
   if(!runtime||process.env.META_ATTENDANCE_N8N_KEY!==bundle.key)throw Error('Prepared configuration mismatch');
   if(!bundle.validated)throw Error('Engine validation required before activation');
   for(const [relative,content] of Object.entries(bundle.modules)){
    if(!bundle.allowed.includes(relative)||digest(fs.readFileSync(root+'/'+relative,'utf8'))!==digest(content))throw Error('Validated runtime module drift');
   }
   const nextEnv=patchEnvironment(oldEnv,{META_ATTENDANCE_REPLIES_ENABLED:'true'});
   const [[cursor]]=await db.query('SELECT COALESCE(MAX(id),0) AS id FROM meta_attendance_events');
   // The cursor is written before enabling the worker. Old captured messages stay history.
   await db.query('UPDATE meta_attendance_runtime SET enabled=1,activation_event_id=?,activation_at=CURRENT_TIMESTAMP(3) WHERE id=1',[cursor.id]);
   try{fs.writeFileSync(root+'/.env',nextEnv,{mode:0o600});await restart({META_ATTENDANCE_REPLIES_ENABLED:'true'});}
   catch(error){await db.query('UPDATE meta_attendance_runtime SET enabled=0 WHERE id=1');fs.writeFileSync(root+'/.env',oldEnv,{mode:0o600});await restart({META_ATTENDANCE_REPLIES_ENABLED:'false'});throw error;}
   console.log(JSON.stringify({activated:true,changed:true,historyExcludedThroughId:cursor.id,outboundEnabled:true}));return;
  }
  const staged=[];
  for(const [relative,content] of Object.entries(bundle.modules)){
   if(!bundle.allowed.includes(relative))throw Error('Unexpected module path');
   const file=root+'/'+relative,before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
   if(clean(before)!==clean(content)&&clean(before)!==clean(bundle.before[relative]))throw Error('Remote module drift');
   staged.push({relative,before,after:content});
  }
  const [tables]=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('meta_attendance_runtime','meta_attendance_conversations','meta_attendance_jobs','meta_attendance_outbox')");
  const values={META_ATTENDANCE_REPLIES_ENABLED:process.env.META_ATTENDANCE_REPLIES_ENABLED==='true'?'true':'false',META_ATTENDANCE_N8N_URL:'https://n8n.mercadodovale.com.br/webhook/meta-attendance',META_ATTENDANCE_N8N_KEY:bundle.key};
  const nextEnv=patchEnvironment(oldEnv,values);
  const report={apply:bundle.apply,files:staged.map(s=>({file:s.relative,changed:clean(s.before)!==clean(s.after),hash:digest(s.after)})),existingTables:tables.length,outboundEnabled:values.META_ATTENDANCE_REPLIES_ENABLED==='true'};
  if(!bundle.apply){console.log(JSON.stringify(report));return;}
  if(staged.every(s=>clean(s.before)===clean(s.after))&&tables.length===4&&oldEnv===nextEnv){console.log(JSON.stringify({...report,changed:false}));return;}
  const [[runtimeBeforeUpgrade]]=await db.query('SELECT enabled FROM meta_attendance_runtime WHERE id=1');
  if(values.META_ATTENDANCE_REPLIES_ENABLED==='true'&&runtimeBeforeUpgrade?.enabled)throw Error('Pause durable runtime before upgrading; preserve activation cursor');
  const backup=root+'/backups/meta-replies-'+Date.now();fs.mkdirSync(backup+'/services',{recursive:true,mode:0o700});fs.chmodSync(backup,0o700);
  fs.writeFileSync(backup+'/env.before',oldEnv,{mode:0o600});
  for(const s of staged)if(s.before!==null)fs.writeFileSync(backup+'/'+s.relative,s.before,{mode:0o600});
  let mutated=false;
  try{
   for(const s of staged){fs.writeFileSync(root+'/'+s.relative+'.next.cjs',s.after,{mode:0o600});cp.execFileSync(process.execPath,['--check',root+'/'+s.relative+'.next.cjs'],{stdio:'pipe'});}
   for(const s of staged){const actual=fs.existsSync(root+'/'+s.relative)?fs.readFileSync(root+'/'+s.relative,'utf8'):null;if(actual!==s.before)throw Error('Module changed during staging');}
   if(fs.readFileSync(root+'/.env','utf8')!==oldEnv)throw Error('Environment changed during staging');
   for(const statement of bundle.migration.split(';').filter(s=>s.trim()))await db.query(statement);
   mutated=true;
   for(const s of staged)fs.renameSync(root+'/'+s.relative+'.next.cjs',root+'/'+s.relative);
   fs.writeFileSync(root+'/.env',nextEnv,{mode:0o600});
   await restart(values);
   for(const s of staged)if(fs.readFileSync(root+'/'+s.relative,'utf8')!==s.after)throw Error('Module readback failed');
   console.log(JSON.stringify({...report,changed:true,backup,restarted:true}));
  }catch(error){
   if(mutated){for(const s of staged){if(s.before===null){if(fs.existsSync(root+'/'+s.relative))fs.unlinkSync(root+'/'+s.relative);}else fs.writeFileSync(root+'/'+s.relative,s.before,{mode:0o600});}fs.writeFileSync(root+'/.env',oldEnv,{mode:0o600});await restart({META_ATTENDANCE_REPLIES_ENABLED:'false',META_ATTENDANCE_N8N_KEY:process.env.META_ATTENDANCE_N8N_KEY||'',META_ATTENDANCE_N8N_URL:process.env.META_ATTENDANCE_N8N_URL||''});}
   throw error;
  }finally{for(const s of staged)if(fs.existsSync(root+'/'+s.relative+'.next.cjs'))fs.unlinkSync(root+'/'+s.relative+'.next.cjs');}
 }finally{await db.end();}
}
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>!['--apply','--activate'].includes(a))||args.length>1)throw Error('Use no arguments, --apply or --activate');
 const root=path.resolve(__dirname,'..');
 const key=fs.readFileSync(path.join(root,'.local/meta-n8n-header-secret.txt'),'utf8').trim();if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid private key file');
 const before={};
 for(const f of FILES){
  const previous=cp.spawnSync('git',['show',BASELINE_COMMIT+':'+f],{cwd:root,encoding:'utf8'});
  if(previous.status!==0&&f!=='services/metaAttendanceMedia.cjs')throw Error('Required deployment baseline missing');
  before[f]=previous.status===0?previous.stdout:null;
 }
 let validated=false;
 if(args.includes('--activate')){
  const attestation=JSON.parse(fs.readFileSync(path.join(root,'.local/meta-engine-validation.json'),'utf8'));
  validated=validateProof(attestation,Object.fromEntries(FILES.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')])));
 }
 const bundle={allowed:FILES,modules:Object.fromEntries(FILES.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')])),before,key,apply:args.includes('--apply'),activate:args.includes('--activate'),validated,migration:fs.readFileSync(path.join(root,'migrations/056_meta_attendance_replies.sql'),'utf8')};
 const input=`const patchEnvironment=${patchEnvironment.toString()};(${remote.toString()})(${JSON.stringify(bundle)}).catch(()=>{console.error('Meta replies operation failed; sensitive diagnostics withheld');process.exitCode=1;});`;
 const client=new Client();try{
  await new Promise((r,j)=>client.on('ready',r).on('error',j).connect(getVpsSshConfig()));
  const output=await new Promise((r,j)=>client.exec('cd /var/www/mdv-api && node',(e,s)=>{if(e)return j(Error('SSH unavailable'));let out='';s.on('data',x=>out+=x);s.stderr.on('data',()=>{});s.on('close',code=>code?j(Error('Remote operation failed; sensitive diagnostics withheld')):r(out));s.end(input);}));
  console.log(output.trim());
 }finally{client.end();}
}
module.exports={patchEnvironment,FILES,validateProof};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
