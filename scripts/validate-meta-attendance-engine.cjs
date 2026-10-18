'use strict';
// Executes the real shared n8n core against isolated synthetic conversations.
// It never calls the Meta transport, never enables the worker and removes its own fixtures.
const fs=require('node:fs'),path=require('node:path');
const {Client}=require('ssh2');
const {getVpsSshConfig}=require('../tmp-tests/vps-ssh-config.cjs');
async function validate(){
 const crypto=require('node:crypto');require('dotenv').config({quiet:true});
 if(process.env.META_ATTENDANCE_REPLIES_ENABLED==='true')throw Error('Disable worker before validation');
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
   let previousRevision=0;
   for(const [turn,text] of [[1,'Bom dia! Quais celulares estão disponíveis?'],[2,'1']]){
    const providerEventId='mdv-validation-'+runId+'-'+channel+'-'+turn;
    const eventKey=digest(providerEventId);eventKeys.push(eventKey);
    const event={schemaVersion:1,channel,accountId,participantId,conversationKey,providerEventId,eventKey,
      surface:'dm',eventType:'message',status:'captured',isEcho:false,text,attachments:[],occurredAt:new Date().toISOString()};
    const [insert]=await db.query(`INSERT INTO meta_attendance_events
     (event_key,channel,account_id,participant_id,conversation_key,provider_event_id,surface,event_type,status,normalized_event)
     VALUES (?,?,?,?,?,?,'dm','message','captured',?)`,[eventKey,channel,accountId,participantId,conversationKey,providerEventId,JSON.stringify(event)]);
    await db.query("INSERT INTO meta_attendance_jobs(event_key,conversation_hash,inbox_id,status) VALUES (?,?,?,'planning')",[eventKey,digest(conversationKey),insert.insertId]);
    const result=await fetch(process.env.META_ATTENDANCE_N8N_URL,{method:'POST',headers:{'Content-Type':'application/json','x-mdv-meta-key':process.env.META_ATTENDANCE_N8N_KEY},
      body:JSON.stringify({metaAttendance:event,conversationEventVersion:Date.now()*1000+turn}),signal:AbortSignal.timeout(155000),redirect:'error'});
    if(!result.ok)throw Error('Engine HTTP validation failed');
    const response=await result.json();
    if(response.eventKey!==eventKey||response.conversationKey!==conversationKey||!response.messages?.length||response.blocked)throw Error('Engine response validation failed');
    const [[state]]=await db.query('SELECT state_revision,conversation_state FROM meta_attendance_conversations WHERE conversation_hash=?',[digest(conversationKey)]);
    if(Number(state?.state_revision)<=previousRevision)throw Error('Conversation state was not persisted');
    previousRevision=Number(state.state_revision);
    const stateValue=typeof state.conversation_state==='string'?JSON.parse(state.conversation_state):state.conversation_state;
    if(turn===1&&!stateValue?.salesPostList)throw Error('Catalog state missing');
    summary.push({channel,turn,messages:response.messages.length,statePersisted:true,responseSha256:digest(JSON.stringify(response.messages))});
   }
  }
  console.log(JSON.stringify({ok:true,at:new Date().toISOString(),syntheticOnly:true,metaSends:0,conversations,turns:summary}));
 }finally{
  for(const key of eventKeys){await db.query('DELETE FROM meta_attendance_outbox WHERE event_key=?',[key]);await db.query('DELETE FROM meta_attendance_jobs WHERE event_key=?',[key]);await db.query('DELETE FROM meta_attendance_events WHERE event_key=?',[key]);}
  for(const key of conversations)await db.query('DELETE FROM meta_attendance_conversations WHERE conversation_hash=?',[digest(key)]);
  await db.end();
 }
}
async function main(){
 if(process.argv.length!==2)throw Error('No arguments supported');
 const client=new Client();try{
  await new Promise((r,j)=>client.on('ready',r).on('error',j).connect(getVpsSshConfig()));
  const input=`(${validate.toString()})().catch(()=>{console.error('Engine validation failed; private details withheld');process.exitCode=1;});`;
  const output=await new Promise((r,j)=>client.exec('cd /var/www/mdv-api && node',(e,s)=>{if(e)return j(Error('SSH unavailable'));let text='';s.on('data',x=>text+=x);s.stderr.on('data',()=>{});s.on('close',code=>code?j(Error('Engine validation failed; inspect private execution status')):r(text));s.end(input);}));
  const proof=JSON.parse(output.trim());
  fs.writeFileSync(path.join(__dirname,'../.local/meta-engine-validation.json'),JSON.stringify(proof,null,2),{mode:0o600});
  console.log(JSON.stringify({...proof,conversations:undefined}));
 }finally{client.end();}
}
module.exports={validate};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
