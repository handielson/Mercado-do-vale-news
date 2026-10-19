'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMetaAttendanceReplies, replyConfig, eligibleEvent, normalizeResponse } = require('../services/metaAttendanceReplies.cjs');
const NOW = Date.parse('2026-10-18T15:00:00Z');
const KEY = 'a'.repeat(64);
const stamp = offset => new Date(NOW + offset).toISOString();
const runtime = { enabled: 1, activation_at: stamp(-60000), activation_event_id: 10 };
const event = extra => ({ eventKey: KEY, conversationKey: 'instagram:ig:user:dm', channel: 'instagram', accountId: 'ig',
  participantId: 'user', providerEventId: 'inbound', surface: 'dm', eventType: 'message', status: 'captured', isEcho: false,
  occurredAt: stamp(-10000), text: 'Tem Xiaomi?', ...extra });
const response = (e = event()) => ({ eventKey: e.eventKey, conversationKey: e.conversationKey, messages: [{ type: 'text', text: 'Temos estas opções.' }] });
const enabledEnv = { META_ATTENDANCE_REPLIES_ENABLED: 'true', META_ATTENDANCE_N8N_URL: 'https://n8n.mercadodovale.com.br/webhook/meta-attendance', META_ATTENDANCE_N8N_KEY: 'synthetic-key-for-tests-only-1234567890' };

function worker({ enabled = true, paused = false, echo = false, conversationPaused = false, newer = false, ready = false, planning = false, sendResult, eventPatch = {}, mediaResult, pauseDuringDownload = false } = {}) {
  const e = event({...eventPatch,...(echo ? { isEcho: true, eventType: 'message_echo', status: 'ignored' } : {})});
  const row = { id: 11, event_key: KEY, received_at: stamp(-9000), normalized_event: JSON.stringify(e) };
  const calls = { send: [], engine: [], media: [], sql: [], unknownSql: [], released: 0 };
  const jobs = new Map();
  if (ready || planning) jobs.set(KEY, { status: ready ? 'ready' : 'planning', response_json: JSON.stringify(response(e)) });
  const blocks = [];
  const db = {
    release() { calls.released++; },
    async query(sql, args = []) {
      const s = sql.replace(/\s+/g, ' ').trim(); calls.sql.push(s);
      if (s.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (s.includes('RELEASE_LOCK')) return [[{ released: 1 }]];
      if (s.startsWith('SELECT * FROM meta_attendance_runtime')) return [[{ ...runtime, enabled: enabled ? 1 : 0 }]];
      if (s.startsWith('SELECT paused FROM n8n_bot_global_control')) return [[{ paused: paused ? 1 : 0 }]];
      if (s.startsWith('SELECT e.* FROM meta_attendance_events e JOIN meta_attendance_runtime')) return [[]];
      if (s.startsWith("UPDATE meta_attendance_outbox SET status='result_unknown'")) return [{ affectedRows: 0 }];
      if (s.startsWith('UPDATE meta_attendance_jobs j SET')) return [{ affectedRows: 0 }];
      if (s.startsWith('SELECT e.*,j.response_json')) return [jobs.get(KEY)?.status === 'ready' ? [{ ...row, response_json: jobs.get(KEY).response_json }] : []];
      if (s.startsWith('SELECT e.* FROM meta_attendance_events e LEFT JOIN')) return [!jobs.has(KEY) && !echo ? [row] : []];
      if (s.startsWith('INSERT IGNORE INTO meta_attendance_conversations')) return [{ affectedRows: 1 }];
      if (s.startsWith('SELECT paused_until,paused_by,handoff_event_key')) return [[{ paused_until: conversationPaused ? stamp(60000) : null, paused_by: 'human', handoff_event_key: null }]];
      if (s.startsWith('SELECT id FROM meta_attendance_events WHERE conversation_key')) return [newer ? [{ id: 12 }] : []];
      if (s.startsWith('INSERT IGNORE INTO meta_attendance_jobs')) {
        if (jobs.has(KEY)) return [{ affectedRows: 0 }];
        jobs.set(KEY, { status: 'planning' }); return [{ affectedRows: 1 }];
      }
      if (s.startsWith("UPDATE meta_attendance_jobs SET status='ready'")) { Object.assign(jobs.get(KEY), { status: 'ready', response_json: args[0] }); return [{ affectedRows: 1 }]; }
      if (s.startsWith('INSERT IGNORE INTO meta_attendance_outbox')) { if (!blocks.some(b => b.block_index === args[1])) blocks.push({ block_index: args[1], message_json: args[2], status: 'pending' }); return [{ affectedRows: 1 }]; }
      if (s.startsWith('SELECT * FROM meta_attendance_outbox WHERE')) return [[...blocks]];
      if (s.startsWith("UPDATE meta_attendance_outbox SET status='sending'")) { const b = blocks.find(b => b.block_index === args[1]); if (b.status !== 'pending') return [{ affectedRows: 0 }]; b.status = 'sending'; return [{ affectedRows: 1 }]; }
      if (s.startsWith('UPDATE meta_attendance_outbox SET status=?')) { Object.assign(blocks.find(b => b.block_index === args[4]), { status: args[0], provider_message_id: args[1], error_code: args[2] }); return [{ affectedRows: 1 }]; }
      if (s.startsWith("UPDATE meta_attendance_outbox SET status='suppressed'")) { blocks.filter(b => b.status === 'pending').forEach(b => { b.status = 'suppressed'; }); return [{ affectedRows: 1 }]; }
      if (s.startsWith("UPDATE meta_attendance_jobs SET status='suppressed'")) { jobs.get(KEY).status = 'suppressed'; return [{ affectedRows: 1 }]; }
      if (s.startsWith("UPDATE meta_attendance_jobs SET status='completed'")) { jobs.get(KEY).status = 'completed'; return [{ affectedRows: 1 }]; }
      if (s.startsWith('UPDATE meta_attendance_jobs SET status=?')) { jobs.get(KEY).status = args[0]; return [{ affectedRows: 1 }]; }
      if (s.startsWith("UPDATE meta_attendance_jobs SET status='failed'")) { for (const j of jobs.values()) if (j.status === 'planning') j.status = 'failed'; return [{ affectedRows: 1 }]; }
      calls.unknownSql.push(s); throw new Error('Mock SQL not implemented');
    },
  };
  const service = createMetaAttendanceReplies({ pool: { ...db, getConnection: async () => db }, env: enabledEnv, now: () => NOW,
    media: { download: async input => { calls.media.push(input); if(pauseDuringDownload)conversationPaused=true; return mediaResult || {ok:true,data:'c3ludGhldGlj',mimeType:'image/png'}; } },
    fetch: async (url, init) => { calls.engine.push({ url, init }); return { ok: true, json: async () => response(e) }; },
    transport: { send: async input => { calls.send.push(input); return sendResult || { ok: true, status: 'sent', providerMessageId: 'outbound' }; } },
  });
  return { service, calls, jobs, blocks, row: { ...row, event: e } };
}

test('reply flags require explicit true and eligibility excludes stale/historical/non-DM events', () => {
  assert.equal(replyConfig({ META_ATTENDANCE_REPLIES_ENABLED: '1' }).enabled, false);
  assert.equal(eligibleEvent(event(), runtime, stamp(-9000), NOW), true);
  for (const e of [event({ isEcho: true }), event({ surface: 'comment' }), event({ status: 'ignored' }), event({ channel: 'whatsapp' }),
    event({ occurredAt: stamp(1) }), event({ occurredAt: stamp(-1200000) }), event({ occurredAt: stamp(-61000) }), event({ participantId: '' })]) {
    assert.equal(eligibleEvent(e, runtime, stamp(-9000), NOW), false);
  }
  assert.equal(eligibleEvent(event(), { ...runtime, enabled: 0 }, stamp(-9000), NOW), false);
  assert.equal(eligibleEvent(event(), runtime, stamp(-61000), NOW), false);
});

test('engine response must bind to exact event/conversation and supports blocked suppression', () => {
  const e = event();
  for (const invalid of [null, { ...response(e), eventKey: 'foreign' }, { ...response(e), conversationKey: 'foreign' }, { ...response(e), messages: [{}] }, { ...response(e), messages: [{ type: 'text', text: {} }] }]) {
    assert.throws(() => normalizeResponse(invalid, e), error => error.statusCode === 400);
  }
  assert.deepEqual(normalizeResponse({ ...response(e), blocked: true }, e), []);
});

test('normalization preserves Unicode and image captions in ordered blocks while stripping injected recipient fields', () => {
  const e = event();
  const blocks = normalizeResponse({ ...response(e), messages: [
    { type: 'text', text: '🌿'.repeat(901), recipientId: 'foreign' },
    { type: 'image', url: 'https://imagens.xiaomipetrolina.com.br/a.jpg', text: 'Legenda', recipient: 'foreign' },
  ] }, e);
  assert.deepEqual(blocks.map(b => b.type), ['text', 'text', 'image', 'text']);
  assert.equal([...blocks[0].text].length, 900);
  assert.equal(blocks[1].text, '🌿');
  assert.equal(blocks[3].text, 'Legenda');
  assert.ok(blocks.every(b => !('recipient' in b) && !('recipientId' in b)));
  assert.throws(() => normalizeResponse({ ...response(e), messages: Array(101).fill({ type: 'text', text: 'x' }) }, e));
  assert.throws(() => normalizeResponse({ ...response(e), messages: [{ type: 'text', text: 'x'.repeat(50001) }] }, e));
});

test('worker disabled through environment performs no queries, engine calls or sends', async () => {
  let queried = false, sent = false;
  const service = createMetaAttendanceReplies({ pool: { getConnection: async () => { queried = true; throw Error('unexpected'); } }, env: {}, transport: { send: async () => { sent = true; } } });
  await service.tick();
  assert.equal(queried, false); assert.equal(sent, false);
});

test('runtime disable, global pause, human handoff, newer inbound and echoes prevent worker send', async () => {
  for (const config of [{ enabled: false }, { paused: true }, { conversationPaused: true }, { newer: true }, { echo: true }]) {
    const { service, calls } = worker(config);
    await service.tick();
    assert.equal(calls.send.length, 0, JSON.stringify(config));
    assert.equal(calls.engine.length, 0, JSON.stringify(config));
    assert.deepEqual(calls.unknownSql, []);
    assert.equal(calls.released, 1);
  }
});

test('worker persists outbox, emits trusted event and does not repeat on second tick', async () => {
  const { service, calls, jobs, blocks } = worker();
  await service.tick(); await service.tick();
  assert.deepEqual(calls.unknownSql, []);
  assert.equal(calls.engine.length, 1);
  assert.equal(calls.send.length, 1);
  assert.equal(calls.send[0].event.participantId, 'user');
  assert.equal(calls.send[0].event.activationAt, runtime.activation_at);
  assert.equal(calls.send[0].event.receivedAt, stamp(-9000));
  assert.equal(jobs.get(KEY).status, 'completed');
  assert.equal(blocks[0].status, 'sent');
  const input = JSON.parse(calls.engine[0].init.body);
  assert.equal(input.metaAttendance.eventKey, KEY);
  assert.ok(Number.isSafeInteger(input.conversationEventVersion));
  assert.equal(calls.engine[0].init.redirect, 'error');
});

test('ambiguous send becomes durable unknown and next tick never repeats POST', async () => {
  const { service, calls, jobs, blocks } = worker({ sendResult: { ok: false, status: 'result_unknown', code: 'meta_send_result_unknown' } });
  await service.tick(); await service.tick();
  assert.deepEqual(calls.unknownSql, []);
  assert.equal(calls.send.length, 1);
  assert.equal(jobs.get(KEY).status, 'result_unknown');
  assert.equal(blocks[0].status, 'result_unknown');
});

test('a ready reply is rechecked against global pause before any send', async () => {
  const { service, calls, jobs, blocks } = worker({ ready: true, paused: true });
  await service.tick();
  assert.deepEqual(calls.unknownSql, []);
  assert.equal(calls.engine.length, 0); assert.equal(calls.send.length, 0);
  assert.equal(jobs.get(KEY).status, 'suppressed');
  assert.equal(blocks[0].status, 'suppressed');
});

test('ready recovery skips a block whose provider receipt is already persisted', async () => {
  const { service, calls, jobs, blocks } = worker({ ready: true });
  blocks.push({ block_index: 0, message_json: JSON.stringify({ type: 'text', text: 'Already sent' }), status: 'sent', provider_message_id: 'known-receipt' });
  await service.tick();
  assert.deepEqual(calls.unknownSql, []);
  assert.equal(calls.send.length, 0);
  assert.equal(calls.engine.length, 0);
  assert.equal(jobs.get(KEY).status, 'completed');
  assert.equal(blocks[0].provider_message_id, 'known-receipt');
});

test('canSend rejects echo event itself even if a caller incorrectly supplies it as ready', async () => {
  const { service, calls, row } = worker({ echo: true });
  assert.equal(await service.canSend(row, response(row.event)), false);
  assert.equal(calls.send.length, 0);
  assert.deepEqual(calls.unknownSql, []);
});

test('orphaned planning after process restart receives terminal failure instead of staying stuck', async () => {
  const { service, calls, jobs } = worker({ planning: true });
  await service.tick();
  assert.deepEqual(calls.unknownSql, []);
  assert.equal(calls.send.length, 0);
  assert.equal(jobs.get(KEY).status, 'failed');
});

test('image-only Meta message reaches shared engine with downloaded print and no signed URL in its payload', async () => {
  for(const channel of ['instagram','messenger']){
    const {service,calls,jobs}=worker({eventPatch:{channel,text:'',attachments:[{type:'image',url:'https://lookaside.fbsbx.com/image?secret=synthetic'}]}});
    await service.tick();await service.tick();
    assert.equal(calls.media.length,1);assert.equal(calls.engine.length,1);assert.equal(calls.send.length,1);
    const body=JSON.parse(calls.engine[0].init.body);
    assert.deepEqual(body.payjoyImage,{data:'c3ludGhldGlj',mimeType:'image/png'});
    assert.doesNotMatch(calls.engine[0].init.body,/lookaside|secret=/);
    assert.equal(jobs.get(KEY).status,'completed');assert.deepEqual(calls.unknownSql,[]);
  }
});

test('global/human pause, historical and superseded events prevent image download and OCR', async () => {
  for(const config of [{paused:true},{conversationPaused:true},{newer:true},{enabled:false},{eventPatch:{occurredAt:stamp(-61000)}}]){
    const eventPatch={text:'',attachments:[{type:'image',url:'https://lookaside.fbsbx.com/image'}],...config.eventPatch};
    const {service,calls}=worker({...config,eventPatch});await service.tick();
    assert.equal(calls.media.length,0);assert.equal(calls.engine.length,0);assert.equal(calls.send.length,0);
  }
});

test('expired/unsupported media delegates to the canonical unavailable branch without image bytes, allowing old approval to be cleared',async()=>{
  const {service,calls}=worker({eventPatch:{text:'',attachments:[{type:'image',url:'https://lookaside.fbsbx.com/expired'}]},mediaResult:{ok:false,code:'media_unavailable'}});
  await service.tick();assert.equal(calls.media.length,1);assert.equal(calls.engine.length,1);assert.equal(calls.send.length,1);
  assert.deepEqual(JSON.parse(calls.engine[0].init.body).payjoyImage,{data:'',mimeType:''});
});

test('manual pause arriving during image download stops before OCR',async()=>{
  const {service,calls}=worker({eventPatch:{text:'',attachments:[{type:'image',url:'https://lookaside.fbsbx.com/x'}]},pauseDuringDownload:true});
  await service.tick();assert.equal(calls.media.length,1);assert.equal(calls.engine.length,0);assert.equal(calls.send.length,0);
});

test('multiple images use unavailable-image branch without download, and non-image files keep text fallback',async()=>{
  for(const attachments of [[{type:'image'},{type:'image'}],[{type:'file'}]]){
    const {service,calls}=worker({eventPatch:{text:'',attachments}});await service.tick();
    assert.equal(calls.engine.length,attachments[0].type==='image'?1:0);assert.equal(calls.media.length,0);assert.equal(calls.send.length,1);
  }
});

test('PayJoy approval state is accepted only for its claimed Meta conversation and uses existing revision CAS',async()=>{
  const updates=[];const e=event();
  const db={query:async(sql,args)=>{
    if(sql.startsWith('SELECT * FROM meta_attendance_events'))return [[{event_key:KEY,normalized_event:e}]];
    if(sql.startsWith('SELECT status FROM meta_attendance_jobs'))return [[{status:'planning'}]];
    if(sql.startsWith('INSERT IGNORE INTO meta_attendance_conversations'))return [{affectedRows:1}];
    if(sql.startsWith('UPDATE meta_attendance_conversations SET conversation_state=')){updates.push(args);return [{affectedRows:1}];}
    if(sql.startsWith('SELECT * FROM meta_attendance_conversations'))return [[{conversation_state:JSON.parse(updates.at(-1)?.[0]||'{}'),state_revision:1,state_event_version:99,sales_preferences:{}}]];
    if(sql.startsWith('SELECT normalized_event')||sql.startsWith('SELECT o.message_json'))return [[]];
    if(sql.startsWith('SELECT paused FROM'))return [[{paused:0}]];
    throw Error('Unexpected SQL');
  }};
  const service=createMetaAttendanceReplies({pool:db,transport:{}});
  const state={payjoyByJid:{status:'approved',approvedAmountCents:160000,entryPercentBp:1400,updatedAt:NOW,expiresAt:NOW+10000}};
  const saved=await service.operate('state',KEY,{conversationState:state,expectedRevision:0,eventVersion:99});
  assert.equal(saved.conversationStateWrite.applied,true);assert.deepEqual(saved.control.conversation_state,state);
  assert.equal(updates[0][2],require('node:crypto').createHash('sha256').update(e.conversationKey).digest('hex'));
  await assert.rejects(service.operate('state',KEY,{conversationState:{foreignKey:{}},expectedRevision:1,eventVersion:100}),/invalid_conversation_state/);
});
