'use strict';
// A deterministic, local-only transform. The published WhatsApp graph remains
// the owner of business rules; Meta only supplies identity/state and transport.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {patchWhatsAppWebhookAck} = require('./n8n-whatsapp-webhook-ack.cjs');
const MARKER = 'meta-attendance-shared-core-v1';
const BASE = 'https://api.xiaomipetrolina.com.br/internal/meta/attendance/n8n/';
const SOURCE = "$('switc Mensagens').first().json";
const OPERATIONS = Object.freeze({
  'Controle Bot - Registrar Entrada': 'log',
  'Controle Bot - Registrar Saida': 'log',
  'Controle Bot - Buscar Controle': 'context',
  'Controle Bot - Consumir Reset': 'reset',
  'Controle Bot - Verificar mensagem atual': 'freshness',
  'Handoff - Persistir solicitado': 'handoff',
  'Vendas - Persistir Handoff Especialista': 'handoff',
  'Vendas - Persistir Preferencias': 'preferences',
  'Estado Conversa - Persistir': 'state',
});
const NAMES = Object.freeze({
  webhook: 'Meta - Webhook Atendimento', normalize: 'Meta - Normalizar entrada',
  afterLog: 'Meta - Entrada registrada?', contactGate: 'Meta - Preparar contato?',
  contact: 'Meta - Contato sem telefone', outputGate: 'Meta - Retornar mensagens?',
  aggregate: 'Meta - Agregar resposta', respond: 'Meta - Responder webhook',
  blockedGate: 'Meta - Bloqueado?', blocked: 'Meta - Resposta bloqueada',
});
const NORMALIZE = `// ${MARKER}: trusted service input, never an Evolution payload.
const input = $json.body || {};
const event = input.metaAttendance;
if (!event || typeof event !== 'object') throw new Error('invalid_meta_event');
const validId = value => typeof value === 'string' && /^[\\x21-\\x7e]{1,255}$/.test(value);
if (!['instagram','messenger'].includes(event.channel) || event.surface !== 'dm'
 || event.eventType !== 'message' || event.isEcho === true || event.status !== 'captured'
 || !validId(event.accountId) || !validId(event.participantId)
 || typeof event.eventKey !== 'string' || !/^[a-f0-9]{64}$/.test(event.eventKey)
 || !validId(event.providerEventId)) throw new Error('invalid_meta_event');
const expectedKey = [event.channel,event.accountId,event.participantId,'dm'].map(encodeURIComponent).join(':');
if (event.conversationKey !== expectedKey) throw new Error('invalid_meta_conversation');
const version = Number(input.conversationEventVersion || event.conversationEventVersion);
if (!Number.isSafeInteger(version) || version <= 0) throw new Error('invalid_meta_event_version');
const conversation = typeof event.text === 'string' ? event.text.trim() : '';
if (!conversation || conversation.length > 20000) throw new Error('unsupported_meta_text');
return [{json:{channel:event.channel,remoteJid:'meta:'+expectedKey,phone:'',
 memorySessionKey:'meta:'+expectedKey,fromMe:false,messageType:'conversation',conversation,
 messageId:event.providerEventId,conversationEventVersion:version,
 messageTimestamp:event.occurredAt || null,Instancia:'meta',pushName:'',
 metaAttendance:{eventKey:event.eventKey,conversationKey:expectedKey,channel:event.channel,
 accountId:event.accountId,participantId:event.participantId,providerEventId:event.providerEventId}}}];`;
const AGGREGATE = `// ${MARKER}: one envelope contains every split message in order.
const source = $('switc Mensagens').first().json;
for (const name of ['Controle Bot - Buscar Controle','Estado Conversa - Persistir']) {
 if ($(name).first().json.metaAttendanceOk !== true) throw new Error('meta_boundary_failed');
}
for (const name of ['Controle Bot - Registrar Entrada','Controle Bot - Consumir Reset',
 'Vendas - Persistir Preferencias','Handoff - Persistir solicitado','Vendas - Persistir Handoff Especialista']) {
 let payload; try { payload = $(name).first().json; } catch { continue; }
 if (payload.metaAttendanceOk !== true) throw new Error('meta_boundary_failed');
}
let state = {}; try { state = $('Estado Conversa - Preparar').first().json || {}; } catch {}
const messages = $input.all().map(item => {
 const row = item.json || {};
 const text = String(row.message || row.caption || '');
 return row.messageType === 'image'
  ? {type:'image',url:String(row.mediaUrl || ''),text,messageIndex:Number(row.messageIndex || 0)}
  : {type:'text',text,messageIndex:Number(row.messageIndex || 0)};
}).filter(row => row.text || row.url).sort((a,b)=>a.messageIndex-b.messageIndex)
 .map(({messageIndex,...message})=>message);
if (messages.length > 100) throw new Error('too_many_meta_messages');
return [{json:{eventKey:source.metaAttendance.eventKey,conversationKey:source.metaAttendance.conversationKey,
 messages,blocked:false,handoffRequested:state.handoffRequested === true || state.requiresSpecialistHandoff === true,
 allowHandoffResponse:state.handoffRequested === true || state.requiresSpecialistHandoff === true}}];`;
const BLOCKED = `const source = $('switc Mensagens').first().json;
return [{json:{eventKey:source.metaAttendance.eventKey,conversationKey:source.metaAttendance.conversationKey,
 messages:[],blocked:true,handoffRequested:false,allowHandoffResponse:false}}];`;
const edge = node => ({node,type:'main',index:0});
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length - 1, 1, 'Missing or ambiguous channel boundary: ' + before.slice(0,80));
  return text.replace(before,after);
}
function ifNode(name, id, expression, position) {
  return {id,name,type:'n8n-nodes-base.if',typeVersion:2.2,position,parameters:{conditions:{
    options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},
    conditions:[{id:id+'-condition',leftValue:expression,rightValue:true,
      operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
}
function patchWorkflow(input, options={}) {
  assert.ok(Array.isArray(input.nodes) && input.connections,'Workflow snapshot required');
  assert.ok(options.credentialId || options.allowPlaceholder === true,'Explicit inbound Header Auth credentialId required');
  if (input.nodes.some(n=>n.name===NAMES.webhook)) throw new Error('Meta boundary already exists; rebuild from an unpatched source');
  const w = structuredClone(input);
  const node = name => {const n=w.nodes.find(n=>n.name===name);assert.ok(n,'Missing source node '+name);return n;};
  const hasMeta = `={{Boolean(${SOURCE}.metaAttendance)}}`;
  // Keep original URL expression exactly in the WhatsApp branch.
  for (const [name,operation] of Object.entries(OPERATIONS)) {
    const n=node(name), original=n.parameters.url;
    const fallback=original.startsWith('={{') ? original.slice(3,-2).trim() : JSON.stringify(original);
    n.parameters.url=`={{${SOURCE}.metaAttendance ? ${JSON.stringify(BASE+operation+'?eventKey=')} + encodeURIComponent(${SOURCE}.metaAttendance.eventKey) : (${fallback})}}`;
  }
  const apply=node('Controle Bot - Aplicar Controle');
  apply.parameters.jsCode=replaceOnce(apply.parameters.jsCode,'const payload = $json || {};',
    `const payload = $json || {};\nif (source.metaAttendance && (payload.metaAttendanceOk !== true || !payload.control || typeof payload.control !== 'object')) throw new Error('meta_context_failed');`);
  apply.parameters.jsCode=replaceOnce(apply.parameters.jsCode,
    'baseOutput.n8nBotBlocked = Boolean(control.blocked || baseOutput.humanHandoffPaused);',
    `// ${MARKER}: global pause also applies when Meta bypasses phone admin commands.\nbaseOutput.n8nBotBlocked = Boolean(control.blocked || baseOutput.humanHandoffPaused || (source.metaAttendance && payload.globalPaused === true));`);
  const state=node('Estado Conversa - Preparar');
  state.parameters.jsCode=replaceOnce(state.parameters.jsCode,
    "const phone = String(source.phone || controlSource.phone || remoteJid.replace(/@.*$/, '')).replace(/\\D/g, '');",
    `// ${MARKER}: opaque Meta identifiers never become telephone numbers.\nconst phone = (source.metaAttendance || controlSource.metaAttendance) ? '' : String(source.phone || controlSource.phone || remoteJid.replace(/@.*$/, '')).replace(/\\D/g, '');`);
  const sales=node('Vendas - Verificar Pos Lista');
  sales.parameters.jsCode=replaceOnce(sales.parameters.jsCode,
    "  const assumption = contactDeliveryAssumptionV401(options.remoteJid || options.phone || options.ddd || '');",
    `  // ${MARKER}: use explicit address for Meta, no DDD inference.\n  const assumption = contactDeliveryAssumptionV401(source.metaAttendance ? '' : (options.remoteJid || options.phone || options.ddd || ''));`);
  const codeNode=(name,id,jsCode,position)=>({id,name,type:'n8n-nodes-base.code',typeVersion:2,position,parameters:{mode:'runOnceForAllItems',jsCode}});
  w.nodes.push(
    {id:'meta-attendance-webhook-v1',name:NAMES.webhook,type:'n8n-nodes-base.webhook',typeVersion:2,
      webhookId:'meta-attendance-shared-v1',position:[-2000,600],parameters:{httpMethod:'POST',path:'meta-attendance',authentication:'headerAuth',responseMode:'responseNode',options:{}},
      credentials:{httpHeaderAuth:{id:options.credentialId || 'meta-attendance-header',name:'Meta attendance internal header'}},
      notes:'Private API-to-n8n bridge. Only validated, claimed inbox events. No Meta access token enters n8n.'},
    codeNode(NAMES.normalize,'meta-attendance-normalize-v1',NORMALIZE,[-1800,600]),
    ifNode(NAMES.afterLog,'meta-attendance-afterlog-v1',hasMeta,[-1000,600]),
    ifNode(NAMES.contactGate,'meta-attendance-contact-gate-v1',hasMeta,[0,600]),
    codeNode(NAMES.contact,'meta-attendance-contact-v1',`const source=$json; return [{json:{...source,phone:'',phoneDigits:'',phoneE164:'',clienteNome:'',contactExists:false,contactNameSource:'meta-unidentified'}}];`,[200,600]),
    ifNode(NAMES.outputGate,'meta-attendance-output-gate-v1',hasMeta,[4000,600]),
    codeNode(NAMES.aggregate,'meta-attendance-aggregate-v1',AGGREGATE,[4200,600]),
    {id:'meta-attendance-respond-v1',name:NAMES.respond,type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[4400,600],parameters:{respondWith:'firstIncomingItem',options:{responseCode:200}}},
    ifNode(NAMES.blockedGate,'meta-attendance-blocked-gate-v1',hasMeta,[200,900]),
    codeNode(NAMES.blocked,'meta-attendance-blocked-v1',BLOCKED,[4200,900]),
  );
  const c=w.connections;
  const route=(name,target)=>{assert.deepEqual(c[name]?.main?.[0]?.length,1,'Unexpected source edge '+name);c[name].main[0]=[edge(target)];};
  const oldLog=structuredClone(c['Controle Bot - Registrar Entrada'].main[0]);
  route('Controle Bot - Registrar Entrada',NAMES.afterLog);
  c[NAMES.afterLog]={main:[[edge('Controle Bot - Buscar Controle')],oldLog]};
  // Gate before phone contact lookup and Evolution media retrieval.
  const oldAllowed=structuredClone(c['Controle Bot - Bloqueado?'].main[1]);
  assert.deepEqual(c['Controle Bot - Bloqueado?'].main[0],[]);
  c['Controle Bot - Bloqueado?'].main=[[edge(NAMES.blockedGate)],[edge(NAMES.contactGate)]];
  c[NAMES.blockedGate]={main:[[edge(NAMES.blocked)],[]]};
  c[NAMES.blocked]={main:[[edge(NAMES.respond)]]};
  c[NAMES.contactGate]={main:[[edge(NAMES.contact)],oldAllowed]};
  c[NAMES.contact]={main:[[edge('Vendas - Preparar Contexto IA')]]};
  const oldSender=structuredClone(c['Dividir mensagens'].main[0]);
  route('Dividir mensagens',NAMES.outputGate);
  c[NAMES.outputGate]={main:[[edge(NAMES.aggregate)],oldSender]};
  c[NAMES.aggregate]={main:[[edge(NAMES.respond)]]};
  c[NAMES.webhook]={main:[[edge(NAMES.normalize)]]};
  c[NAMES.normalize]={main:[[edge('switc Mensagens')]]};
  const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length);
  for(const [name,outputs] of Object.entries(c)){assert.ok(names.has(name));for(const groups of Object.values(outputs))for(const group of groups)for(const e of group)assert.ok(names.has(e.node),e.node);}
  for(const n of w.nodes)if(n.parameters?.jsCode)new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',n.parameters.jsCode);
  return patchWhatsAppWebhookAck(w);
}
module.exports={patchWorkflow,OPERATIONS,NAMES,NORMALIZE,AGGREGATE,BLOCKED,MARKER};
if(require.main===module){try{
  const [source,destination,credentialId]=process.argv.slice(2);
  assert.ok(source && destination && credentialId,'Usage: node scripts/build-n8n-meta-attendance.cjs source.private.json candidate.private.json headerCredentialId');
  const target=path.resolve(destination);
  assert.ok(target.includes(path.sep+'.local'+path.sep),'Candidate may contain inherited secrets; destination must be .local');
  assert.notEqual(path.resolve(source),target,'Source must be preserved');
  const candidate=patchWorkflow(JSON.parse(fs.readFileSync(source,'utf8')),{credentialId});
  fs.writeFileSync(target,JSON.stringify(candidate,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({created:path.basename(target),nodes:candidate.nodes.length,operations:OPERATIONS}));
}catch(error){console.error(error.message);process.exitCode=1;}}
