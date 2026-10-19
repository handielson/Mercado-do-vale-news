'use strict';
const { createHash } = require('node:crypto');
const { extractCatalogPreferences } = require('./autoresponderCatalogPreferences.cjs');
const { createMetaAttendanceTransport } = require('./metaAttendanceTransport.cjs');
const { createMetaAttendanceMedia } = require('./metaAttendanceMedia.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => typeof value === 'string' ? JSON.parse(value) : (value || {});
const bad = code => Object.assign(new Error(code), { statusCode: 400 });
const ms = value => new Date(value || 0).getTime();

function replyConfig(env = process.env) {
  return { enabled: env.META_ATTENDANCE_REPLIES_ENABLED === 'true',
    n8nUrl: env.META_ATTENDANCE_N8N_URL || '', n8nKey: env.META_ATTENDANCE_N8N_KEY || '' };
}
function eligibleEvent(event, runtime, receivedAt, now = Date.now()) {
  return runtime?.enabled === 1 || runtime?.enabled === true
    ? event?.surface === 'dm' && event.eventType === 'message' && event.status === 'captured' && event.isEcho === false
      && ['instagram','messenger'].includes(event.channel) && Boolean(event.conversationKey && event.participantId)
      && Number.isFinite(ms(event.occurredAt)) && ms(event.occurredAt) >= ms(runtime.activation_at)
      && ms(receivedAt) >= ms(runtime.activation_at) && ms(event.occurredAt) <= now
      && now - ms(event.occurredAt) < 20 * 60 * 1000
    : false;
}
function normalizeResponse(response, event) {
  if (!response || response.eventKey !== event.eventKey || response.conversationKey !== event.conversationKey
    || !Array.isArray(response.messages) || response.messages.length > 100) throw bad('invalid_engine_response');
  if (response.blocked === true) return [];
  const blocks = [];
  for (const message of response.messages) {
    if (!message || !['text','image'].includes(message.type)) throw bad('invalid_engine_message');
    const text = message.text == null ? '' : message.text;
    if (typeof text !== 'string' || text.length > 50000) throw bad('invalid_engine_text');
    if (message.type === 'image') {
      if (typeof message.url !== 'string') throw bad('invalid_engine_image');
      blocks.push({type:'image',url:message.url});
    }
    // Instagram's smaller text limit applies to both channels. Split by Unicode code point.
    const points = [...text.trim()];
    for (let offset=0; offset<points.length; offset+=900) blocks.push({type:'text',text:points.slice(offset,offset+900).join('')});
  }
  if (blocks.length > 150) throw bad('too_many_reply_blocks');
  return blocks;
}

function createMetaAttendanceReplies({pool, fetch: fetchImpl = globalThis.fetch, env = process.env, now = Date.now, transport: suppliedTransport, media: suppliedMedia} = {}) {
  const media = suppliedMedia || createMetaAttendanceMedia({fetch:fetchImpl});
  const transport = suppliedTransport || createMetaAttendanceTransport({ fetch: fetchImpl,
    graphVersion:env.META_GRAPH_API_VERSION,appId:env.META_APP_ID,appSecret:env.META_APP_SECRET,
    encryptionKey:env.META_TOKEN_ENCRYPTION_KEY,now,
    loadConnection: async()=> (await pool.query('SELECT * FROM meta_marketing_connections WHERE id=1'))[0][0] });
  async function globalPaused(db=pool) {
    const [rows] = await db.query("SELECT paused FROM n8n_bot_global_control WHERE control_key='main' LIMIT 1");
    return Number(rows[0]?.paused || 0) === 1;
  }
  async function runtime(db=pool) { return (await db.query('SELECT * FROM meta_attendance_runtime WHERE id=1'))[0][0]; }
  async function eventFor(key,db=pool) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw bad('invalid_event_key');
    const [rows] = await db.query('SELECT * FROM meta_attendance_events WHERE event_key=? LIMIT 1',[key]);
    if (!rows[0]) throw bad('event_not_found');
    return {...rows[0],event:json(rows[0].normalized_event)};
  }
  async function ensureConversation(event,db=pool) {
    const key=hash(event.conversationKey);
    await db.query(`INSERT IGNORE INTO meta_attendance_conversations
      (conversation_hash,conversation_key,channel,account_id,participant_id) VALUES (?,?,?,?,?)`,
      [key,event.conversationKey,event.channel,event.accountId,event.participantId]);
    return key;
  }
  async function context(event,db=pool) {
    const key=await ensureConversation(event,db);
    const [[row]]=await db.query('SELECT * FROM meta_attendance_conversations WHERE conversation_hash=?',[key]);
    const [inbound]=await db.query(`SELECT normalized_event,received_at FROM meta_attendance_events e
      WHERE conversation_key=? AND surface='dm' AND event_type IN ('message','message_echo')
      AND NOT (event_type='message_echo' AND EXISTS (SELECT 1 FROM meta_attendance_outbox o JOIN meta_attendance_events origin ON origin.event_key=o.event_key
        WHERE o.provider_message_id=e.provider_event_id AND o.status='sent' AND origin.channel=e.channel AND origin.account_id=e.account_id))
      ORDER BY id DESC LIMIT 30`,[event.conversationKey]);
    const [outbound]=await db.query(`SELECT o.message_json,o.updated_at FROM meta_attendance_outbox o
      JOIN meta_attendance_jobs j ON j.event_key=o.event_key WHERE j.conversation_hash=? AND o.status='sent'
      ORDER BY o.updated_at DESC LIMIT 30`,[key]);
    const recent=[...inbound.map(r=>{const e=json(r.normalized_event);return {role:e.isEcho?'Atendente humano':'Cliente',text:e.text||'',direction:e.isEcho?'outbound':'inbound',source_node:e.isEcho?'meta-manual':'meta-inbound',created_at:r.received_at};}),
      ...outbound.map(r=>({role:'Loja',text:json(r.message_json).text||'[Imagem do produto]',direction:'outbound',source_node:'meta-bot',created_at:r.updated_at}))]
      .filter(r=>r.text).sort((a,b)=>ms(a.created_at)-ms(b.created_at)).slice(-30);
    const paused=ms(row.paused_until)>now();
    return {ok:true,metaAttendanceOk:true,globalPaused:await globalPaused(db),resetPending:false,
      memorySessionKey:'meta:'+event.conversationKey,humanHandoffPaused:paused,
      control:{remote_jid:'meta:'+event.conversationKey,phone:'',blocked:false,human_handoff_active:paused,
        human_handoff_until:row.paused_until,human_handoff_by:row.paused_by,
        conversation_state:json(row.conversation_state),conversation_state_revision:Number(row.state_revision),
        conversation_state_event_version:Number(row.state_event_version),sales_preferences:json(row.sales_preferences),reset_count:0},
      recentMessages:recent,conversationHistory:recent.map(r=>r.role+': '+r.text.slice(0,1500)).join('\n')};
  }
  async function operate(operation,eventKey,body={}) {
    const row=await eventFor(eventKey), event=row.event;
    const [jobs]=await pool.query("SELECT status FROM meta_attendance_jobs WHERE event_key=? AND status='planning'",[eventKey]);
    if (!jobs.length) throw bad('event_not_claimed');
    if (event.status!=='captured'||event.surface!=='dm'||event.isEcho) throw bad('invalid_claimed_event');
    if (operation==='context') return context(event);
    if (operation==='log'||operation==='reset') return {ok:true,metaAttendanceOk:true};
    const conversationHash=await ensureConversation(event);
    if (operation==='handoff') {
      const seconds=Math.min(86400,Math.max(300,Number(body.durationSeconds)||7200));
      await pool.query(`UPDATE meta_attendance_conversations SET paused_until=GREATEST(COALESCE(paused_until,CURRENT_TIMESTAMP(3)),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL ? SECOND)),
        paused_by='bot-handoff',handoff_event_key=? WHERE conversation_hash=?`,[seconds,eventKey,conversationHash]);
      return {...await context(event),adminNotification:{notified:false,reason:'meta_inbox_handoff'}};
    }
    if (operation==='preferences') {
      const [[current]]=await pool.query('SELECT sales_preferences FROM meta_attendance_conversations WHERE conversation_hash=?',[conversationHash]);
      const [brands]=await pool.query("SELECT DISTINCT brand FROM products WHERE status='active' AND stock_quantity>0 AND (is_parent=0 OR is_parent IS NULL) AND brand IS NOT NULL");
      const merged=extractCatalogPreferences(String(body.message||'').slice(0,20000),json(current.sales_preferences),brands.map(b=>b.brand));
      await pool.query('UPDATE meta_attendance_conversations SET sales_preferences=? WHERE conversation_hash=?',[JSON.stringify(merged.state),conversationHash]);
      return {ok:true,metaAttendanceOk:true,recognized:merged.recognized,patch:merged.patch,preferences:merged.state};
    }
    if (operation==='state') {
      const state=json(body.conversationState);
      if(!state||Array.isArray(state)||typeof state!=='object'||Object.keys(state).some(k=>!['salesPostList','pendingDeviceClarification','payjoyByJid'].includes(k))
        || Buffer.byteLength(JSON.stringify(state))>512*1024)throw bad('invalid_conversation_state');
      const revision=Number(body.expectedRevision),version=Number(body.eventVersion);
      if(!Number.isSafeInteger(revision)||revision<0||!Number.isSafeInteger(version)||version<=0)throw bad('invalid_state_revision');
      const [saved]=await pool.query(`UPDATE meta_attendance_conversations SET conversation_state=?,state_revision=state_revision+1,state_event_version=?
        WHERE conversation_hash=? AND state_revision=? AND state_event_version<?`,[JSON.stringify(state),version,conversationHash,revision,version]);
      const result=await context(event);
      const stale=Number(result.control.conversation_state_event_version)>=version;
      return {...result,conversationStateWrite:saved.affectedRows?{applied:true,revision:result.control.conversation_state_revision,eventVersion:version}
        :{applied:false,reason:stale?'stale_or_duplicate_event':'revision_conflict',currentRevision:result.control.conversation_state_revision}};
    }
    if(operation==='freshness')return {ok:true,metaAttendanceOk:true,rows:[]};
    throw bad('unknown_operation');
  }
  async function canSend(row,response,db=pool) {
    const r=await runtime(db);
    if(!replyConfig(env).enabled||!r?.enabled||Number(row.id)<=Number(r.activation_event_id)||await globalPaused(db))return false;
    const e=row.event;
    if(!eligibleEvent(e,r,row.received_at,now()))return false;
    const key=await ensureConversation(e,db);
    const [[c]]=await db.query('SELECT paused_until,paused_by,handoff_event_key FROM meta_attendance_conversations WHERE conversation_hash=?',[key]);
    if(ms(c.paused_until)>now() && !(c.paused_by==='bot-handoff'&&c.handoff_event_key===e.eventKey&&response.allowHandoffResponse===true))return false;
    const [newer]=await db.query(`SELECT id FROM meta_attendance_events WHERE conversation_key=? AND id>? AND surface='dm'
      AND (event_type='message' OR (event_type='message_echo' AND NOT EXISTS
        (SELECT 1 FROM meta_attendance_outbox o JOIN meta_attendance_events origin ON origin.event_key=o.event_key
          WHERE o.provider_message_id=meta_attendance_events.provider_event_id AND o.status='sent'
          AND origin.channel=meta_attendance_events.channel AND origin.account_id=meta_attendance_events.account_id))) LIMIT 1`,[e.conversationKey,row.id]);
    return newer.length===0;
  }
  async function inspectEchoes(db=pool) {
    // Sender echoes from a human take precedence over queued or generated bot replies.
    const [echoes]=await db.query(`SELECT e.* FROM meta_attendance_events e JOIN meta_attendance_runtime r ON r.id=1
      LEFT JOIN meta_attendance_jobs j ON j.event_key=e.event_key WHERE e.id>r.activation_event_id
      AND e.surface='dm' AND e.event_type='message_echo' AND j.event_key IS NULL
      AND e.received_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 3 SECOND) ORDER BY e.id LIMIT 50`);
    for(const row of echoes){const event=json(row.normalized_event),key=await ensureConversation(event,db);
      const [sent]=await db.query(`SELECT 1 FROM meta_attendance_outbox o JOIN meta_attendance_events origin ON origin.event_key=o.event_key
        WHERE o.provider_message_id=? AND o.status='sent' AND origin.channel=? AND origin.account_id=? LIMIT 1`,[event.providerEventId,event.channel,event.accountId]);
      if(!sent.length)await db.query(`UPDATE meta_attendance_conversations SET paused_until=DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 2 HOUR),paused_by='human',handoff_event_key=NULL WHERE conversation_hash=?`,[key]);
      await db.query("INSERT IGNORE INTO meta_attendance_jobs(event_key,conversation_hash,inbox_id,status,error_code) VALUES (?,?,?,'suppressed',?)",[event.eventKey,key,row.id,sent.length?'bot_echo':'human_reply']);
    }
  }
  async function sendReady(row,response,db=pool) {
    const blocks=normalizeResponse(response,row.event);
    for(let index=0;index<blocks.length;index++)await db.query('INSERT IGNORE INTO meta_attendance_outbox(event_key,block_index,message_json) VALUES (?,?,?)',[row.event.eventKey,index,JSON.stringify(blocks[index])]);
    const [outbox]=await db.query('SELECT * FROM meta_attendance_outbox WHERE event_key=? ORDER BY block_index',[row.event.eventKey]);
    for(const block of outbox){
      if(block.status==='sent')continue;
      if(block.status!=='pending')return;
      if(!await canSend(row,response,db)){
        await db.query("UPDATE meta_attendance_outbox SET status='suppressed',error_code='paused_stale_or_disabled' WHERE event_key=? AND status='pending'",[row.event.eventKey]);
        await db.query("UPDATE meta_attendance_jobs SET status='suppressed',error_code='paused_stale_or_disabled' WHERE event_key=?",[row.event.eventKey]);return;
      }
      const [claimed]=await db.query("UPDATE meta_attendance_outbox SET status='sending' WHERE event_key=? AND block_index=? AND status='pending'",[row.event.eventKey,block.block_index]);
      if(!claimed.affectedRows)return;
      const r=await runtime(db);
      let result;
      try{result=await transport.send({event:{...row.event,receivedAt:new Date(row.received_at).toISOString(),activationAt:new Date(r.activation_at).toISOString()},message:json(block.message_json)});}
      catch{result={ok:false,status:'result_unknown',code:'meta_send_result_unknown'};}
      const status=result.ok?'sent':result.status==='result_unknown'?'result_unknown':'failed';
      await db.query('UPDATE meta_attendance_outbox SET status=?,provider_message_id=?,error_code=? WHERE event_key=? AND block_index=?',
        [status,result.ok?result.providerMessageId:null,result.ok?null:String(result.code||'send_failed').slice(0,80),row.event.eventKey,block.block_index]);
      if(!result.ok){await db.query('UPDATE meta_attendance_jobs SET status=?,error_code=? WHERE event_key=?',[status==='result_unknown'?'result_unknown':'failed',String(result.code||'send_failed').slice(0,80),row.event.eventKey]);return;}
    }
    await db.query("UPDATE meta_attendance_jobs SET status='completed' WHERE event_key=?",[row.event.eventKey]);
  }
  async function tick() {
    const config=replyConfig(env);
    if(!config.enabled||!/^https:\/\/n8n\.mercadodovale\.com\.br\/webhook\/meta-attendance$/.test(config.n8nUrl)||config.n8nKey.length<32)return;
    const db=await pool.getConnection();let locked=false;
    try{
      const [[lock]]=await db.query("SELECT GET_LOCK('mdv.meta.attendance.worker',0) AS acquired");locked=Number(lock.acquired)===1;if(!locked)return;
      const r=await runtime(db);if(!r?.enabled)return;
      await db.query("UPDATE meta_attendance_jobs SET status='failed',error_code='interrupted_planning' WHERE status='planning'");
      await inspectEchoes(db);
      // After a crash, a send may have reached Meta. Never retry a sending block blindly.
      await db.query("UPDATE meta_attendance_outbox SET status='result_unknown',error_code='interrupted_send' WHERE status='sending'");
      await db.query("UPDATE meta_attendance_jobs j SET j.status='result_unknown',j.error_code='interrupted_send' WHERE j.status='ready' AND EXISTS (SELECT 1 FROM meta_attendance_outbox o WHERE o.event_key=j.event_key AND o.status='result_unknown')");
      const [ready]=await db.query("SELECT e.*,j.response_json FROM meta_attendance_jobs j JOIN meta_attendance_events e ON e.event_key=j.event_key WHERE j.status='ready' ORDER BY e.id LIMIT 1");
      if(ready.length){const row={...ready[0],event:json(ready[0].normalized_event)};await sendReady(row,json(row.response_json),db);return;}
      const [pending]=await db.query(`SELECT e.* FROM meta_attendance_events e LEFT JOIN meta_attendance_jobs j ON j.event_key=e.event_key
        WHERE e.id>? AND e.surface='dm' AND e.event_type='message' AND e.status='captured' AND j.event_key IS NULL
        AND e.received_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 5 SECOND) ORDER BY e.id LIMIT 1`,[r.activation_event_id]);
      if(!pending.length)return;
      const row={...pending[0],event:json(pending[0].normalized_event)},event=row.event;
      const key=await ensureConversation(event,db);
      const [insert]=await db.query("INSERT IGNORE INTO meta_attendance_jobs(event_key,conversation_hash,inbox_id,status) VALUES (?,?,?,'planning')",[event.eventKey,key,row.id]);
      if(!insert.affectedRows)return;
      if(!await canSend(row,{},db)){await db.query("UPDATE meta_attendance_jobs SET status='suppressed',error_code='paused_stale_or_disabled' WHERE event_key=?",[event.eventKey]);return;}
      // Group bursts in the event's text using the canonical inbox; newer messages cancel this attempt before send.
      let response, payjoyImage;
      const images=(Array.isArray(event.attachments)?event.attachments:[]).filter(a=>a.type==='image');
      const fallback=text=>({eventKey:event.eventKey,conversationKey:event.conversationKey,messages:[{type:'text',text}]});
      if(images.length>1)response=fallback('Para conferir o resultado da PayJoy, envie um único print legível com o valor aprovado e o percentual de entrada. 😊');
      else if(images.length===1){
        const downloaded=await media.download({event,attachment:images[0]});
        if(downloaded.ok)payjoyImage={data:downloaded.data,mimeType:downloaded.mimeType};
        else response=fallback('Não consegui abrir esse print com segurança. Pode reenviar uma imagem legível ou informar o valor aprovado pela PayJoy e o percentual de entrada? 😊');
      }
      if(!response&&!payjoyImage&&!String(event.text||'').trim())response=fallback('Recebi seu arquivo 😊 Para eu conferir direitinho por aqui, pode me mandar sua dúvida também em texto?');
      if(!response){
        // Recheck after network download: a manual answer/newer event must stop OCR too.
        if(!await canSend(row,{},db)){
          await db.query("UPDATE meta_attendance_jobs SET status='suppressed',error_code='paused_stale_or_disabled' WHERE event_key=?",[event.eventKey]);return;
        }
        const result=await fetchImpl(config.n8nUrl,{method:'POST',headers:{'Content-Type':'application/json','x-mdv-meta-key':config.n8nKey},
          // Signed CDN URLs stay in the trusted inbox; n8n receives only the bounded image.
          body:JSON.stringify({metaAttendance:{...event,attachments:undefined},...(payjoyImage?{payjoyImage}:{}),conversationEventVersion:ms(row.received_at)*1000+Number(row.id)%1000}),
          signal:AbortSignal.timeout(150000),redirect:'error'});
        if(!result.ok)throw Error('engine_unavailable');
        response=await result.json();normalizeResponse(response,event);
      }
      await db.query("UPDATE meta_attendance_jobs SET status='ready',response_json=? WHERE event_key=? AND status='planning'",[JSON.stringify(response),event.eventKey]);
      await sendReady(row,response,db);
    }catch{
      // No customer payloads or upstream exceptions enter logs.
      if(locked)await db.query("UPDATE meta_attendance_jobs SET status='failed',error_code='engine_or_storage_failed' WHERE status='planning'").catch(()=>{});
    }finally{if(locked)await db.query("SELECT RELEASE_LOCK('mdv.meta.attendance.worker')").catch(()=>{});db.release();}
  }
  return {operate,tick,context,canSend,normalizeResponse};
}
module.exports={createMetaAttendanceReplies,replyConfig,eligibleEvent,normalizeResponse};
