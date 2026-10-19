'use strict';
// Executes the real shared n8n core against isolated synthetic conversations.
// It never calls the Meta transport, never enables the worker and removes its own fixtures.
const fs=require('node:fs'),path=require('node:path');
const {Client}=require('ssh2');
const {getVpsSshConfig}=require('../tmp-tests/vps-ssh-config.cjs');
async function validate(options={}){
 const crypto=require('node:crypto');require('dotenv').config({quiet:true});
 if(!options.payjoy&&process.env.META_ATTENDANCE_REPLIES_ENABLED==='true')throw Error('Disable worker before validation');
 const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
 const runId=crypto.randomBytes(16).toString('hex'),eventKeys=[],conversations=[];
 const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
 const summary=[];
 try{
  const [[runtime]]=await db.query('SELECT enabled FROM meta_attendance_runtime WHERE id=1');
  if(runtime?.enabled)throw Error('Runtime must remain disabled for validation');
  const [[assets]]=await db.query('SELECT selected_page_id,selected_instagram_account_id FROM meta_marketing_connections WHERE id=1');
  for(const channel of ['instagram','messenger']){
   const accountId=channel==='instagram'?assets.selected_instagram_account_id:assets.selected_page_id;
   const participantId='mdv-validation-'+runId;
   const conversationKey=[channel,accountId,participantId,'dm'].map(encodeURIComponent).join(':');
   conversations.push(conversationKey);
   let previousRevision=0,selectedName='';
   // The shared classifier deliberately asks a clarification for generic catalog questions.
   // Request the complete list explicitly, then select an item in a separate execution.
   const turns=options.payjoy?[[1,'Bom dia! Envie a lista completa de todos os celulares disponíveis, por favor.'],[2,'1'],[3,'Me envie o link oficial da PayJoy para fazer a análise.'],[4,''],[5,'Quanto fica a entrada?'],[6,'']]:[[1,'Bom dia! Envie a lista completa de todos os celulares disponíveis, por favor.'],[2,'1'],[3,'Quero mais informações']];
   for(const [turn,text] of turns){
    const humanPause=turn===(options.payjoy?6:3);
    if(humanPause)await db.query("UPDATE meta_attendance_conversations SET paused_until=DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 2 HOUR),paused_by='human' WHERE conversation_hash=?",[digest(conversationKey)]);
    const providerEventId='mdv-validation-'+runId+'-'+channel+'-'+turn;
    const eventKey=digest(providerEventId);eventKeys.push(eventKey);
    const event={schemaVersion:1,channel,accountId,participantId,conversationKey,providerEventId,eventKey,
      surface:'dm',eventType:'message',status:'captured',isEcho:false,text,attachments:[],occurredAt:new Date().toISOString()};
    const [insert]=await db.query(`INSERT INTO meta_attendance_events
     (event_key,channel,account_id,participant_id,conversation_key,provider_event_id,surface,event_type,status,normalized_event)
     VALUES (?,?,?,?,?,?,'dm','message','captured',?)`,[eventKey,channel,accountId,participantId,conversationKey,providerEventId,JSON.stringify(event)]);
    await db.query("INSERT INTO meta_attendance_jobs(event_key,conversation_hash,inbox_id,status) VALUES (?,?,?,'planning')",[eventKey,digest(conversationKey),insert.insertId]);
    const result=await fetch(process.env.META_ATTENDANCE_N8N_URL,{method:'POST',headers:{'Content-Type':'application/json','x-mdv-meta-key':process.env.META_ATTENDANCE_N8N_KEY},
      body:JSON.stringify({metaAttendance:event,...(options.payjoy&&(turn===4||turn===6)?{payjoyImage:{data:options.approvalImage,mimeType:'image/png'}}:{}),conversationEventVersion:Date.now()*1000+turn}),signal:AbortSignal.timeout(155000),redirect:'error'});
    if(!result.ok)throw Error('Engine HTTP validation failed');
    const response=await result.json();
    if(humanPause){
      if(response.eventKey!==eventKey||response.conversationKey!==conversationKey||response.blocked!==true||response.messages?.length!==0)throw Error('Human pause validation failed');
      summary.push({channel,turn,humanPauseRespected:true,messages:0});continue;
    }
    if(response.eventKey!==eventKey||response.conversationKey!==conversationKey||!response.messages?.length||response.blocked)throw Error('Engine response validation failed');
    const [[state]]=await db.query('SELECT state_revision,conversation_state FROM meta_attendance_conversations WHERE conversation_hash=?',[digest(conversationKey)]);
    if(Number(state?.state_revision)<=previousRevision)throw Error('Conversation state was not persisted');
    previousRevision=Number(state.state_revision);
    const stateValue=typeof state.conversation_state==='string'?JSON.parse(state.conversation_state):state.conversation_state;
    if(turn===1&&!stateValue?.salesPostList)throw Error('Catalog state missing');
    const output=response.messages.map(m=>m.text||'').join('\n');
    if(options.payjoy&&turn===2){const selection=stateValue.salesPostList;selectedName=selection?.options?.find(o=>Number(o.number)===Number(selection.selectedOptionNumber))?.name||'';if(!selectedName)throw Error('Selected device missing');}
    if(options.payjoy&&turn===3){if(stateValue.payjoyByJid?.status!=='awaiting_result'||!output.includes('https://'))throw Error('PayJoy link state not durable');}
    if(options.payjoy&&(turn===4||turn===5)){
      const approval=stateValue.payjoyByJid;
      if(approval?.status!=='approved'||approval.approvedAmountCents!==160000||approval.entryPercentBp!==1400)throw Error('PayJoy approval not durable');
      if(!/224,00/.test(output)||!output.includes(selectedName))throw Error('PayJoy calculation or selected-device continuity failed');
    }
    summary.push({channel,turn,messages:response.messages.length,statePersisted:true,...(options.payjoy&&turn>=4?{payjoyApprovalPersisted:true,entryCents:22400,selectedDevicePreserved:true}:{}),responseSha256:digest(JSON.stringify(response.messages))});
   }
  }
  const fs=require('node:fs');
  const moduleHashes=Object.fromEntries(['services/metaAttendanceServer.cjs','services/metaAttendanceReplies.cjs','services/metaAttendanceTransport.cjs','services/metaAttendanceMedia.cjs'].map(file=>[file,digest(fs.readFileSync(file,'utf8'))]));
  console.log(JSON.stringify({ok:true,at:new Date().toISOString(),syntheticOnly:true,metaSends:0,moduleHashes,conversations,turns:summary}));
 }finally{
  for(const key of eventKeys){await db.query('DELETE FROM meta_attendance_outbox WHERE event_key=?',[key]);await db.query('DELETE FROM meta_attendance_jobs WHERE event_key=?',[key]);await db.query('DELETE FROM meta_attendance_events WHERE event_key=?',[key]);}
  for(const key of conversations)await db.query('DELETE FROM meta_attendance_conversations WHERE conversation_hash=?',[digest(key)]);
  await db.end();
 }
}
async function main(){
 const payjoy=process.argv.length===3&&process.argv[2]==='--payjoy';
 if(process.argv.length!==2&&!payjoy)throw Error('Only --payjoy supported');
 const options=payjoy?{payjoy:true,approvalImage:fs.readFileSync(path.join(__dirname,'../tmp-tests/fixtures/payjoy-model-test-approval.png')).toString('base64')}:{};
 const client=new Client();try{
  await new Promise((r,j)=>client.on('ready',r).on('error',j).connect(getVpsSshConfig()));
  const input=`(${validate.toString()})(${JSON.stringify(options)}).catch(()=>{console.error('Engine validation failed; private details withheld');process.exitCode=1;});`;
  const output=await new Promise((r,j)=>client.exec('cd /var/www/mdv-api && node',(e,s)=>{if(e)return j(Error('SSH unavailable'));let text='';s.on('data',x=>text+=x);s.stderr.on('data',()=>{});s.on('close',code=>code?j(Error('Engine validation failed; inspect private execution status')):r(text));s.end(input);}));
  const proof=JSON.parse(output.trim());
  fs.writeFileSync(path.join(__dirname,payjoy?'../.local/meta-payjoy-engine-validation.json':'../.local/meta-engine-validation.json'),JSON.stringify(proof,null,2),{mode:0o600});
  console.log(JSON.stringify({...proof,conversations:undefined}));
 }finally{client.end();}
}
module.exports={validate};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
