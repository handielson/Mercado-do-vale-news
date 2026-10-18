'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {patchWorkflow:transform,OPERATIONS,NAMES,NORMALIZE,AGGREGATE,BLOCKED}=require('../scripts/build-n8n-meta-attendance.cjs');
const patchWorkflow=input=>transform(input,{allowPlaceholder:true});
const snapshot=process.env.MDV_META_SOURCE_SNAPSHOT || path.resolve(__dirname,'../.local/meta-current-workflow.private.json');
assert.ok(fs.existsSync(snapshot),'Exact unpatched runtime source required; no fixture fallback');
const source=JSON.parse(fs.readFileSync(snapshot,'utf8'));
const candidate=patchWorkflow(source);
const node=name=>candidate.nodes.find(n=>n.name===name);
const event={channel:'instagram',accountId:'17841405577271290',participantId:'001-87opaque',surface:'dm',
 eventType:'message',status:'captured',isEcho:false,eventKey:'a'.repeat(64),providerEventId:'mid.test',
 conversationKey:'instagram:17841405577271290:001-87opaque:dm',text:'Tem Poco X8 512 GB?',occurredAt:'2026-10-18T12:00:00.000Z'};
function execute(code,input={},sources={},state={},items=[input]){
 const $=name=>{assert.ok(Object.hasOwn(sources,name),'Unmocked upstream '+name);return {first:()=>({json:sources[name]}),all:()=>[{json:sources[name]}]};};
 return new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',code)(input,
  {all:()=>items.map(json=>({json})),first:()=>({json:input})},$,()=>state,{id:'900010'},0);
}
const normalized=()=>execute(NORMALIZE,{body:{metaAttendance:event,conversationEventVersion:1800000000000001}})[0].json;
const expression=(text,sources)=>new Function('$','$json','return ('+text.slice(3,-2)+')')(name=>({first:()=>({json:sources[name]})}), {remoteJid:'5587990000000@s.whatsapp.net'});
test('source is immutable and WhatsApp node business rules/credentials preserved',()=>{
 const before=JSON.stringify(source);patchWorkflow(source);assert.equal(JSON.stringify(source),before);
 const changed=new Set([...Object.keys(OPERATIONS),'Controle Bot - Aplicar Controle','Estado Conversa - Preparar','Vendas - Verificar Pos Lista']);
 for(const original of source.nodes){const current=node(original.name);assert.deepEqual(current.credentials,original.credentials,'Credential drift '+original.name);
  if(!changed.has(original.name))assert.deepEqual(current,original,'Unscoped change '+original.name);
  else {const a=structuredClone(original),b=structuredClone(current);delete a.parameters;delete b.parameters;assert.deepEqual(b,a,'Nonparameter drift '+original.name);}
 }
});
test('WhatsApp graph preserved except three intentional boundary gates',()=>{
 const changed=new Set(['Controle Bot - Registrar Entrada','Controle Bot - Bloqueado?','Dividir mensagens']);
 for(const [name,connections]of Object.entries(source.connections))if(!changed.has(name))assert.deepEqual(candidate.connections[name],connections,name);
 assert.deepEqual(candidate.connections[NAMES.afterLog].main[1],source.connections['Controle Bot - Registrar Entrada'].main[0]);
 assert.deepEqual(candidate.connections[NAMES.contactGate].main[1],source.connections['Controle Bot - Bloqueado?'].main[1]);
 assert.deepEqual(candidate.connections[NAMES.outputGate].main[1],source.connections['Dividir mensagens'].main[0]);
 assert.deepEqual(candidate.connections[NAMES.blockedGate].main[1],[]);
});
test('webhook is authenticated and responds through explicit response node',()=>{
 const n=node(NAMES.webhook);assert.equal(n.parameters.httpMethod,'POST');assert.equal(n.parameters.authentication,'headerAuth');
 assert.equal(n.credentials.httpHeaderAuth.id,'meta-attendance-header');assert.equal(n.parameters.responseMode,'responseNode');
 assert.equal(node(NAMES.respond).parameters.respondWith,'firstIncomingItem');
 assert.throws(()=>patchWorkflow(candidate),/already exists/);
 assert.throws(()=>transform(source),/credentialId/);
 assert.equal(transform(source,{credentialId:'real-credential'}).nodes.find(n=>n.name===NAMES.webhook).credentials.httpHeaderAuth.id,'real-credential');
});
test('opaque identity retains leading zero and never fabricates phone/JID',()=>{
 const result=normalized();assert.equal(result.remoteJid,'meta:'+event.conversationKey);assert.equal(result.phone,'');
 assert.equal(result.metaAttendance.participantId,'001-87opaque');assert.equal(result.messageType,'conversation');
 assert.equal(result.memorySessionKey,result.remoteJid);assert.equal(result.fromMe,false);
 const contact=execute(node(NAMES.contact).parameters.jsCode,result)[0].json;
 assert.equal(contact.phoneDigits,'');assert.equal(contact.phoneE164,'');assert.equal(contact.clienteNome,'');
});
test('both supported channels isolate account/participant conversations',()=>{
 const variants=[event,{...event,channel:'messenger',conversationKey:'messenger:17841405577271290:001-87opaque:dm'},
 {...event,accountId:'other',conversationKey:'instagram:other:001-87opaque:dm'}];
 const keys=variants.map(e=>execute(NORMALIZE,{body:{metaAttendance:e,conversationEventVersion:1}})[0].json.memorySessionKey);
 assert.equal(new Set(keys).size,3);
});
test('invalid events, echoes, comments and missing order are rejected before core',()=>{
 for(const delta of [{isEcho:true},{channel:'whatsapp'},{surface:'comment'},{status:'ignored'},
  {conversationKey:'forged'},{participantId:123},{eventKey:'bad'},{text:''},{providerEventId:''}])
  assert.throws(()=>execute(NORMALIZE,{body:{metaAttendance:{...event,...delta},conversationEventVersion:1}}));
 assert.throws(()=>execute(NORMALIZE,{body:{metaAttendance:event}}),/version/);
});
test('Meta URLs bind eventKey and WhatsApp URLs retain exact behavior',()=>{
 const meta=normalized(),wa={remoteJid:'5587990000000@s.whatsapp.net'};
 for(const [name,op] of Object.entries(OPERATIONS)){
  assert.equal(expression(node(name).parameters.url,{'switc Mensagens':meta}),
   'https://api.xiaomipetrolina.com.br/internal/meta/attendance/n8n/'+op+'?eventKey='+event.eventKey);
  const original=source.nodes.find(n=>n.name===name).parameters.url;
  const sources={'switc Mensagens':wa,'Controle Bot - Verificar Cliente':wa};
  const actual=expression(node(name).parameters.url,sources);
  const expected=original.startsWith('={{')?expression(original,sources):original;
  assert.equal(actual,expected,name);
 }
});
test('global pause and handoff suppress Meta through canonical control node',()=>{
 for(const payload of [{globalPaused:true},{control:{human_handoff_active:true}},{control:{blocked:true}}]){
  const result=execute(node('Controle Bot - Aplicar Controle').parameters.jsCode,{metaAttendanceOk:true,control:{},...payload},{'Controle Bot - Verificar Cliente':normalized()})[0].json;
  assert.equal(result.n8nBotBlocked,true);
 }
 const wa=execute(node('Controle Bot - Aplicar Controle').parameters.jsCode,{globalPaused:true},{'Controle Bot - Verificar Cliente':{remoteJid:'wa'}})[0].json;
 assert.equal(wa.n8nBotBlocked,false,'WhatsApp existing pause branch owns its policy');
 assert.throws(()=>execute(node('Controle Bot - Aplicar Controle').parameters.jsCode,{error:'timeout'},{'Controle Bot - Verificar Cliente':normalized()}),/meta_context_failed/);
});
test('state serialization keeps Meta phone empty and source event/revision',()=>{
 const input={...normalized(),conversationStateRevision:4,conversationStateEventVersion:123};
 const result=execute(node('Estado Conversa - Preparar').parameters.jsCode,input,{
  'switc Mensagens':input,'Controle Bot - Aplicar Controle':input,'Vendas - Verificar Pos Lista':input})[0].json;
 assert.equal(result.conversationStatePersistRequest.phone,'');
 assert.equal(result.conversationStatePersistRequest.remoteJid,input.remoteJid);
 assert.equal(result.conversationStatePersistRequest.expectedRevision,4);
 assert.equal(result.conversationStatePersistRequest.eventVersion,123);
});
test('DDD inference is disabled for Meta while keeping original WhatsApp call',()=>{
 const original=source.nodes.find(n=>n.name==='Vendas - Verificar Pos Lista').parameters.jsCode;
 assert.ok(original.includes("contactDeliveryAssumptionV401(options.remoteJid || options.phone || options.ddd || '')"));
 const code=node('Vendas - Verificar Pos Lista').parameters.jsCode;
 assert.ok(code.includes("source.metaAttendance ? '' : (options.remoteJid || options.phone || options.ddd || '')"));
});
test('response includes all split messages in original order and handoff acknowledgement flag',()=>{
 const input=normalized(),items=[{message:'segundo',messageIndex:2},{message:'primeiro',messageIndex:1},
 {messageType:'image',mediaUrl:'https://example.com/product.jpg',caption:'produto',messageIndex:3}];
 const result=execute(AGGREGATE,{}, {'switc Mensagens':input,'Estado Conversa - Preparar':{handoffRequested:true},'Controle Bot - Buscar Controle':{metaAttendanceOk:true},'Estado Conversa - Persistir':{metaAttendanceOk:true}}, {},items)[0].json;
 assert.deepEqual(result.messages.map(m=>m.text),['primeiro','segundo','produto']);assert.equal(result.messages[2].type,'image');
 assert.equal(result.allowHandoffResponse,true);assert.equal(result.handoffRequested,true);assert.equal(result.eventKey,event.eventKey);
 const blocked=execute(BLOCKED,{}, {'switc Mensagens':input})[0].json;
 assert.deepEqual(blocked.messages,[]);assert.equal(blocked.blocked,true);assert.equal(blocked.allowHandoffResponse,false);
 const failed={'switc Mensagens':input,'Controle Bot - Buscar Controle':{metaAttendanceOk:true},'Estado Conversa - Persistir':{error:'timeout'}};
 assert.throws(()=>execute(AGGREGATE,{},failed,{},items),/meta_boundary_failed/);
 const failedOptional={...failed,'Estado Conversa - Persistir':{metaAttendanceOk:true},'Handoff - Persistir solicitado':{error:'timeout'}};
 assert.throws(()=>execute(AGGREGATE,{},failedOptional,{},items),/meta_boundary_failed/);
});
test('Meta reachable graph cannot enter Evolution, contacts, admin commands or scheduled follow-ups',()=>{
 const seen=new Set(),queue=[NAMES.webhook];
 const selected={ [NAMES.afterLog]:[0],[NAMES.contactGate]:[0],[NAMES.outputGate]:[0],[NAMES.blockedGate]:[0] };
 while(queue.length){const name=queue.pop();if(seen.has(name))continue;seen.add(name);
  const outputs=candidate.connections[name]?.main||[];
  for(const index of selected[name]||outputs.map((_,i)=>i))for(const e of outputs[index]||[])queue.push(e.node);
 }
 for(const name of seen)assert.doesNotMatch(name,/^Enviar WhatsApp|^Contato - |^Controle Bot - (Buscar Admin|Comando Admin|Executar Comando|Responder Admin)|^Follow-up Lista|^PayJoy - (Agendar|Recuperar midia)/,name);
 assert.ok(seen.has('Vendas - Contexto Produtos'));assert.ok(seen.has('Pagamento - Politica'));assert.ok(seen.has(NAMES.respond));
});
test('Meta catalog survives durable serialization into another execution without crossing channels',async()=>{
 const first=normalized(),firstState={};
 const base={...first,conversation:'Quais celulares disponíveis?',productCategoryId:'smartphones',productSearchKind:'categoria'};
 const products=[{id:'fixture-256',model_id:'Redmi 15',model_name:'Redmi 15',name:'Redmi 15 Roxo',brand:'Xiaomi',
  status:'active',stock_quantity:1,price_retail:122400,specs:{ram:'8GB',storage:'256GB',color:'Roxo'},slug:'fixture-256',images:[]}];
 const catalog=execute(node('Vendas - Contexto Produtos').parameters.jsCode,{},
  {'Vendas - Preparar Busca':base,'Vendas - Buscar Produtos':products,'switc Mensagens':base},firstState,
  [{channel:'presencial',installments:12,applied_fee_pct:11.9}])[0].json;
 assert.ok(firstState.salesPostList[first.remoteJid]);
 const request=execute(node('Estado Conversa - Preparar').parameters.jsCode,catalog,
  {'Controle Bot - Aplicar Controle':base,'Vendas - Verificar Pos Lista':base},firstState)[0].json.conversationStatePersistRequest;
 const durable=JSON.parse(JSON.stringify(request.conversationState));
 const second={...first,messageId:'mid.second',conversation:'1',conversationEventVersion:first.conversationEventVersion+1};
 const secondState={};
 const hydrated=execute(node('Controle Bot - Aplicar Controle').parameters.jsCode,{metaAttendanceOk:true,
  control:{conversation_state:durable,conversation_state_revision:1}}, {'Controle Bot - Verificar Cliente':second},secondState)[0].json;
 const selected=(await execute(node('Vendas - Verificar Pos Lista').parameters.jsCode,{},
  {'Parse Classificacao':hydrated},secondState))[0].json;
 assert.equal(selected.salesPostListHandled,true);
 assert.equal(secondState.salesPostList[first.remoteJid].orderDraft.productId,'fixture-256');
 assert.equal(Object.hasOwn(secondState.salesPostList,'5587990000000@s.whatsapp.net'),false);
 assert.equal(request.phone,'');
});
