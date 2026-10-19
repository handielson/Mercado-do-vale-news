'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {patchMetaPayjoyWorkflow,patchMetaNormalizerCode,validateMetaPayjoyWorkflow,NAMES,PREPARE,LEGACY_PREPARE,POSLIST_YIELD_CODE}=require('../scripts/n8n-meta-payjoy-images.cjs');
const sourcePath=process.env.MDV_META_PAYJOY_SNAPSHOT||path.resolve(__dirname,'../.local/meta-payjoy-source.private.json');
assert.ok(fs.existsSync(sourcePath),'Exact published source snapshot required');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8')),patched=patchMetaPayjoyWorkflow(source);
if(process.env.MDV_META_PAYJOY_CANDIDATE){const candidate=JSON.parse(fs.readFileSync(process.env.MDV_META_PAYJOY_CANDIDATE,'utf8'));
 assert.deepEqual({nodes:candidate.nodes,connections:candidate.connections},{nodes:patched.nodes,connections:patched.connections},'Candidate graph drift');}
const node=name=>patched.nodes.find(n=>n.name===name);
function execute(name,input={},sources={},state={}){const code=name===NAMES.prepare?PREPARE:node(name).parameters.jsCode;
 const lookup=name=>{assert.ok(Object.hasOwn(sources,name),'Unexecuted '+name);return {first:()=>({json:sources[name]})};};
 const result=new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',code)(input,{all:()=>[{json:input}]},lookup,()=>state,{id:'900000'},0);
 return result?.then?result.then(rows=>rows[0]?.json):result[0]?.json;
}
const now=Date.now();
const entry=extra=>({status:'awaiting_result',updatedAt:Date.now(),expiresAt:Date.now()+86400000,...extra});
const event={channel:'instagram',accountId:'fixture-account',participantId:'fixture-participant',surface:'dm',eventType:'message',status:'captured',isEcho:false,
 providerEventId:'fixture-mid',eventKey:'a'.repeat(64),conversationKey:'instagram:fixture-account:fixture-participant:dm',text:'',attachments:[{type:'image'}]};
const image={data:Buffer.from('fixture-image-bytes').toString('base64'),mimeType:'image/png'};
const normalized=(e=event,img=image)=>execute('Meta - Normalizar entrada',{body:{metaAttendance:e,conversationEventVersion:1,payjoyImage:img}});
const hydrate=(base,payjoy,state={},extra={})=>execute('Controle Bot - Aplicar Controle',{metaAttendanceOk:true,control:{conversation_state_revision:1,conversation_state:payjoy?{payjoyByJid:payjoy}:{}},...extra},{'Controle Bot - Verificar Cliente':base},state);
const persist=(base,state)=>execute('Estado Conversa - Preparar',base,{'Controle Bot - Aplicar Controle':base,'Parse Classificacao':base},state).conversationStatePersistRequest;
const vision=(base,state,result)=>execute('PayJoy - Calcular entrada do print',{content:JSON.stringify(result)},{'Controle Bot - Aplicar Controle':base},state);
test('patch is pure/idempotent and leaves OCR, commercial policies, credentials and WhatsApp nodes intact',()=>{
 const before=JSON.stringify(source);assert.equal(validateMetaPayjoyWorkflow(patched),true);assert.equal(JSON.stringify(source),before);
 assert.deepEqual(patchMetaPayjoyWorkflow(patched),patched);
 const changed=new Set(['Meta - Normalizar entrada','Controle Bot - Aplicar Controle','Estado Conversa - Preparar','Estado Conversa - Restaurar','Resolver Acao de Conversacao','Pagamento - Politica','Vendas - Verificar Pos Lista']);
 for(const old of source.nodes){const after=node(old.name);assert.deepEqual(after.credentials,old.credentials,old.name);if(!changed.has(old.name))assert.deepEqual(after,old,old.name);}
 const graphChanges=new Set(['Meta - Preparar contato?','PayJoy - Recebeu print?','PayJoy - Print tem arquivo?']);
 for(const [name,c]of Object.entries(source.connections))if(!graphChanges.has(name))assert.deepEqual(patched.connections[name],c,name);
 assert.equal(patched.nodes.length,source.nodes.length+4);
});
test('upgrade of already published V1 changes only exact legacy preparation and post-list owner',()=>{
 const v1=structuredClone(patched),post=v1.nodes.find(n=>n.name==='Vendas - Verificar Pos Lista');
 assert.ok(post.parameters.jsCode.includes(POSLIST_YIELD_CODE));post.parameters.jsCode=post.parameters.jsCode.replace(POSLIST_YIELD_CODE,'');
 v1.nodes.find(n=>n.name===NAMES.prepare).parameters.jsCode=LEGACY_PREPARE;
 const upgraded=patchMetaPayjoyWorkflow(v1);assert.deepEqual(upgraded,patched);
 assert.deepEqual(upgraded.connections,v1.connections);assert.equal(upgraded.nodes.length,v1.nodes.length);
 for(const n of v1.nodes)if(![post.name,NAMES.prepare].includes(n.name))assert.deepEqual(upgraded.nodes.find(x=>x.name===n.name),n,n.name);
 const unknown=structuredClone(v1);unknown.nodes.find(n=>n.name===NAMES.prepare).parameters.jsCode+='\n// unknown edit';
 assert.throws(()=>patchMetaPayjoyWorkflow(unknown),/Unknown.*drift/);
});
test('validator normalizer getter matches exact transformed source and metadata stays opaque',()=>{
 assert.equal(patchMetaNormalizerCode(source.nodes.find(n=>n.name==='Meta - Normalizar entrada').parameters.jsCode),node('Meta - Normalizar entrada').parameters.jsCode);
 const base=normalized();assert.equal(base.phone,'');assert.equal(base.remoteJid,'meta:'+event.conversationKey);
 assert.equal(base.conversation,'[Imagem recebida]');assert.equal(base.payjoyImageBase64,image.data);assert.equal(base.payjoyImageMimeType,'image/png');
});
test('text-only messages preserve text and reject an empty unrelated message',()=>{
 const base=normalized({...event,text:'Qual o preço?',attachments:[]},null);assert.equal(base.conversation,'Qual o preço?');
 assert.throws(()=>normalized({...event,text:'',attachments:[]},null),/unsupported_meta_text/);
});
test('invalid media never feeds the native converter or Evolution, while trusted valid data supports both input names',()=>{
 for(const img of [{data:'!bad',mimeType:'image/png'},{data:'YQ==',mimeType:'text/html'},{data:'abc',mimeType:'image/png'},null]){
  const base=normalized(event,img);assert.equal(base.payjoyImageBase64,'');
  const state={},hydrated=hydrate(base,entry(),state),prepared=execute(NAMES.prepare,hydrated,{},state);
  assert.equal(prepared.payjoyPrint,true);assert.equal(Boolean(prepared.payjoyImageBase64),false);
 }
 assert.equal(normalized(event,{base64:image.data,mimeType:'image/png'}).payjoyImageBase64,image.data);
 assert.equal(normalized(event,{data:'data:image/png;base64,'+image.data,mimeType:'image/png'}).payjoyImageBase64,image.data);
});
test('active PayJoy image reuses reader, while a new or expired image asks context without inventing approval',()=>{
 const base=normalized(),state={},hydrated=hydrate(base,entry(),state);
 assert.equal(execute(NAMES.prepare,hydrated,{},state).payjoyPrint,true);
 for(const old of [null,entry({status:'awaiting_link_confirmation'}),entry({expiresAt:now-1}),entry({updatedAt:now+86400000})]){
  const s={},h=hydrate(base,old,s),p=execute(NAMES.prepare,h,{},s);assert.equal(p.payjoyPrint,false);assert.equal(p.metaImageNeedsContext,true);assert.ok(!p.payjoyImageBase64);assert.match(p.output,/Você está enviando o resultado/);
 }
});
test('explicit human request caption takes precedence over OCR and continues canonical handoff classification',()=>{
 const base=normalized({...event,text:'Quero falar com um atendente'}),state={},hydrated=hydrate(base,entry(),state);
 const result=execute(NAMES.prepare,hydrated,{},state);assert.equal(result.payjoyPrint,false);assert.equal(result.metaImageNeedsContext,false);
 assert.equal(result.conversation,'Quero falar com um atendente');assert.ok(!result.payjoyImageBase64);
});
test('legacy trusted recent shop PayJoy reply permits only reading a newly attached image without restoring finances',()=>{
 const base=normalized(),state={};
 const hydrated=hydrate(base,null,state);
 hydrated.recentMessages=[{source_node:'meta-bot',direction:'outbound',text:'Envie o print do resultado PayJoy com valor aprovado.',created_at:new Date(Date.now()-60000).toISOString()}];
 const prepared=execute(NAMES.prepare,hydrated,{},state);
 assert.equal(prepared.payjoyPrint,true);assert.equal(prepared.metaImageNeedsContext,false);
 assert.equal(state.payjoyByJid[base.remoteJid],undefined);
 const fresh=vision(hydrated,state,{isPayjoyResult:true,approvalStatus:'approved',legible:true,approvedAmount:2000,entryPercent:20});
 assert.equal(fresh.payjoyCalculation.entryCents,40000);
});
test('explicit PayJoy caption permits strict reading with no state, while human request remains higher priority',()=>{
 for(const existing of [null,entry({status:'denied'}),entry({status:'declined'})]){
  const base=normalized({...event,text:'Segue o resultado da PayJoy'}),state={};
  const prepared=execute(NAMES.prepare,hydrate(base,existing,state),{},state);assert.equal(prepared.payjoyPrint,true);
 }
 const human=normalized({...event,text:'PayJoy quero falar com um atendente'});
 assert.equal(execute(NAMES.prepare,hydrate(human,null,{}),{},{}).payjoyPrint,false);
});
test('forged user role, inbound messages, stale/future history and declined state cannot reopen OCR by history',()=>{
 const base=normalized(),valid={source_node:'meta-bot',direction:'outbound',text:'PayJoy análise',created_at:new Date(Date.now()-1000).toISOString()};
 for(const row of [{...valid,source_node:'meta-inbound',role:'Loja'},{...valid,direction:'inbound'},
  {...valid,created_at:new Date(Date.now()-86400001).toISOString()},{...valid,created_at:new Date(Date.now()+86400000).toISOString()},
  {...valid,created_at:'not-a-date'},{...valid,source_node:'other'}]){
  const state={},hydrated=hydrate(base,null,state);hydrated.recentMessages=[row];
  assert.equal(execute(NAMES.prepare,hydrated,{},state).payjoyPrint,false);
 }
 for(const status of ['denied','declined','awaiting_link_confirmation']){
  const state={},hydrated=hydrate(base,entry({status}),state);hydrated.recentMessages=[valid];
  assert.equal(execute(NAMES.prepare,hydrated,{},state).payjoyPrint,false,status);
 }
});
test('global pause and previous manual handoff still block before Meta image preparation',()=>{
 const base=normalized();for(const extra of [{globalPaused:true},{control:{conversation_state_revision:1,conversation_state:{payjoyByJid:entry()},human_handoff_active:true}}]){
  const result=hydrate(base,entry(),{},extra);assert.equal(result.n8nBotBlocked,true);
 }
 assert.deepEqual(patched.connections['Controle Bot - Bloqueado?'],source.connections['Controle Bot - Bloqueado?']);
 assert.equal(patched.connections['Meta - Preparar contato?'].main[0][0].node,NAMES.prepare);
});
test('vision fixture computes approved amount entry and preserves selected SKU/name',()=>{
 const base=normalized(),state={};const hydrated=hydrate(base,entry(),state);
 state.salesPostList={[base.remoteJid]:{selectedOptionNumber:2,options:[{number:2,name:'Poco X8',colors:[{productId:'sku-real'}]}],expiresAt:Date.now()+86400000}};
 const result=vision(hydrated,state,{isPayjoyResult:true,approvalStatus:'approved',legible:true,approvedAmount:2000,entryPercent:20});
 assert.equal(result.payjoyCalculation.entryCents,40000);assert.match(result.output,/400,00/);assert.match(result.output,/Poco X8/);
 assert.equal(state.salesPostList[base.remoteJid].options[0].colors[0].productId,'sku-real');
 assert.equal(persist(result,state).conversationState.payjoyByJid.approvedAmountCents,200000);
 assert.ok(!result.payjoyImageBase64);
});
test('two isolated executions persist partial OCR amount then complete percentage using existing payment calculator',()=>{
 const base=normalized(),firstState={},hydrated=hydrate(base,entry(),firstState);
 const partial=vision(hydrated,firstState,{isPayjoyResult:true,approvalStatus:'approved',legible:true,approvedAmount:2000,entryPercent:null});
 const saved=JSON.parse(JSON.stringify(persist(partial,firstState).conversationState));
 assert.equal(saved.payjoyByJid.awaiting,'entry_percent');assert.equal(saved.payjoyByJid.approvedAmountCents,200000);
 const secondBase=normalized({...event,text:'20%',attachments:[],providerEventId:'second'},null),secondState={};
 const second=hydrate(secondBase,saved.payjoyByJid,secondState);
 const answer=execute('Pagamento - Politica',{}, {'Resolver Acao de Conversacao':second},secondState);
 assert.equal(answer.payjoyCalculation.entryCents,40000);assert.equal(answer.payjoyCalculation.amountCents,200000);
 assert.equal(persist(answer,secondState).conversationState.payjoyByJid.entryPercentBp,2000);
});
test('next execution asks Quanto fica a entrada, exits awaiting-color collection and reuses approved amount',async()=>{
 const base=normalized(),firstState={},hydrated=hydrate(base,entry(),firstState);
 const answer=vision(hydrated,firstState,{isPayjoyResult:true,approvalStatus:'approved',legible:true,approvedAmount:2240,entryPercent:10});
 const durable=JSON.parse(JSON.stringify(persist(answer,firstState).conversationState));
 const next=normalized({...event,text:'Quanto fica a entrada?',attachments:[],providerEventId:'next'},null),state={};
 const current=hydrate(next,durable.payjoyByJid,state);
 state.salesPostList={[next.remoteJid]:{step:'awaiting_color',selectedOptionNumber:1,options:[{number:1,name:'Poco X8',priceCents:139900}]}};
 const before=structuredClone(state.salesPostList[next.remoteJid]);
 const yielded=await execute('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':{...current,intencao:'geral',salesFlowAction:'indefinido'}},state);
 assert.equal(yielded.salesPostListHandled,false);assert.equal(yielded.metaPayjoyYield,true);
 assert.deepEqual(state.salesPostList[next.remoteJid],before);
 const routed=execute('Resolver Acao de Conversacao',yielded, {'switc Mensagens':next},state);
 assert.equal(routed.conversationAction,'responder_politica_pagamento');assert.equal(routed.conversationDecision.intencao,'payjoy');
 const result=execute('Pagamento - Politica',{}, {'Resolver Acao de Conversacao':routed},state);
 assert.equal(result.payjoyCalculation.entryCents,22400);assert.equal(result.payjoyCalculation.amountCents,224000);
 assert.match(result.output,/224,00/);assert.match(result.output,/Poco X8/);assert.doesNotMatch(result.output,/Envie um print|Qual.*valor aprovado/);
});
test('explicit validated PayJoy link request escapes awaiting-color collection and persists link continuation',async()=>{
 const base=normalized({...event,text:'Me envie o link oficial da PayJoy para fazer a análise.',attachments:[]},null);
 const state={salesPostList:{[base.remoteJid]:{step:'awaiting_color',selectedOptionNumber:1,options:[{number:1,name:'Redmi 15',colors:['Roxo']}]}}};
 const source={...base,intencao:'vendas_produtos',salesFlowAction:'indefinido',payjoyLinkReply:{decision:'request',confidence:0.99},payjoyLinkContext:{referenciaDisponivel:true,ativo:false}};
 const before=structuredClone(state.salesPostList[base.remoteJid]);
 const yielded=await execute('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':source},state);
 assert.equal(yielded.salesPostListHandled,false);assert.equal(yielded.metaPayjoyYield,true);assert.deepEqual(state.salesPostList[base.remoteJid],before);
 const routed=execute('Resolver Acao de Conversacao',yielded,{'switc Mensagens':base},state);
 assert.equal(routed.conversationAction,'responder_politica_pagamento');
 const reply=execute('Pagamento - Politica',{payjoy_analysis_url:'https://apply.payjoy.com/fixture'},{'Resolver Acao de Conversacao':routed},state);
 assert.match(reply.output,/https:\/\/apply\.payjoy\.com\/fixture/);
 assert.equal(persist(reply,state).conversationState.payjoyByJid.status,'awaiting_result');
 assert.deepEqual(state.salesPostList[base.remoteJid],before);
});
test('post-list precedence requires grounded valid semantics and never preempts human/card/USB/WhatsApp requests',()=>{
 const guard=new Function('source','staticData',POSLIST_YIELD_CODE);
 const base={...normalized({...event,text:'Me envie o link da PayJoy',attachments:[]},null),payjoyLinkReply:{decision:'request',confidence:0.99},payjoyLinkContext:{referenciaDisponivel:true}};
 assert.equal(guard(base,{})[0].json.metaPayjoyYield,true);
 for(const delta of [{metaAttendance:null},{payjoyLinkReply:{decision:'request',confidence:0.79}},
  {payjoyLinkContext:{}},{payjoyLinkReply:{decision:'other',confidence:1}},
  {conversation:'Quero falar com um atendente da PayJoy'},{conversation:'Qual a entrada USB?'},{conversation:'Quanto de entrada no cartão?'}])
  assert.equal(guard({...base,...delta},{}),undefined);
 for(const decision of ['accept','decline','question'])assert.equal(guard({...base,payjoyLinkReply:{decision,confidence:0.99},payjoyLinkContext:{ativo:true}}, {})[0].json.metaPayjoyYield,true);
});
test('entry question guard excludes missing/expired approval, human requests and unrelated payment/device questions',()=>{
 const {ENTRY_QUESTION}=require('../scripts/n8n-meta-payjoy-images.cjs');
 const check=new Function(ENTRY_QUESTION+';return isMetaPayjoyEntryQuestionV1;')();
 const approved=entry({status:'approved',approvedAmountCents:224000,entryPercentBp:1000});
 assert.equal(check(true,'Quanto fica a entrada?',approved),true);assert.equal(check(false,'Quanto fica a entrada?',approved),false);
 for(const state of [null,entry(),{...approved,entryPercentBp:null},{...approved,expiresAt:now-1},{...approved,approvedAmountCents:-1}])
  assert.equal(check(true,'Quanto fica a entrada?',state),false);
 for(const text of ['Qual a entrada USB desse carregador?','Quanto fica a entrada no cartão?','Quero falar com atendente sobre a entrada','Não quero pagar a entrada'])
  assert.equal(check(true,text,approved),false,text);
});
test('OCR denial, illegible image and provider error use existing safe parser without fabricated approved amount',()=>{
 const base=normalized();for(const result of [{isPayjoyResult:true,approvalStatus:'denied',legible:true,approvedAmount:null,entryPercent:null},
  {isPayjoyResult:false,approvalStatus:'unknown',legible:false,approvedAmount:9999,entryPercent:1}]){
  const state={},hydrated=hydrate(base,entry(),state),answer=vision(hydrated,state,result);
  assert.ok(!answer.payjoyCalculation);assert.equal(state.payjoyByJid[base.remoteJid].approvedAmountCents,undefined);
 }
 const state={},hydrated=hydrate(base,entry(),state);
 const failed=execute('PayJoy - Calcular entrada do print',{error:'provider timeout'},{'Controle Bot - Aplicar Controle':hydrated},state);
 assert.match(failed.output,/Não consegui ler com segurança/);assert.ok(!failed.payjoyCalculation);
});
test('rejected Meta state writes restore canonical PayJoy entry and WhatsApp state serialization stays unchanged',()=>{
 const base=normalized(),state={payjoyByJid:{[base.remoteJid]:entry({approvedAmountCents:999999})}};
 const canonical=entry({approvedAmountCents:200000});
 execute('Estado Conversa - Restaurar',{control:{conversation_state:{payjoyByJid:canonical}},conversationStateWrite:{applied:false,reason:'stale_or_duplicate_event'}},
  {'Estado Conversa - Preparar':base},state);
 assert.equal(state.payjoyByJid[base.remoteJid].approvedAmountCents,200000);
 const wa={remoteJid:'5587990000000@s.whatsapp.net',conversation:'PayJoy'};
 const waState={payjoyByJid:{[wa.remoteJid]:entry()}};assert.ok(!persist(wa,waState).conversationState.payjoyByJid);
 const existing=waState.payjoyByJid[wa.remoteJid];hydrate(wa,null,waState);assert.deepEqual(waState.payjoyByJid[wa.remoteJid],existing);
});
test('Meta branch paths never reach Evolution recovery or Google Contacts; WhatsApp false branches preserved',()=>{
 assert.equal(patched.connections[NAMES.contact].main[1][0].node,'Contato - Preparar');
 assert.equal(patched.connections[NAMES.unavailable].main[1][0].node,'PayJoy - Recuperar midia');
 const seen=new Set(),queue=[NAMES.prepare],selected={[NAMES.contact]:[0],[NAMES.unavailable]:[0],'Meta - Retornar mensagens?':[0]};
 while(queue.length){const name=queue.pop();if(seen.has(name))continue;seen.add(name);const groups=patched.connections[name]?.main||[];
  for(const i of selected[name]||groups.map((_,i)=>i))for(const e of groups[i]||[])queue.push(e.node);}
 for(const name of seen)assert.doesNotMatch(name,/^Contato - |^Enviar WhatsApp|^PayJoy - Recuperar midia/);
 assert.ok(seen.has('PayJoy - Ler aprovacao'));assert.ok(seen.has('PayJoy - Calcular entrada do print'));
});
