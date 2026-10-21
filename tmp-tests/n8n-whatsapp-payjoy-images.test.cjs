'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchWhatsAppPayjoyWorkflow,validate,NAMES}=require('../scripts/n8n-whatsapp-payjoy-images.cjs');
const source=JSON.parse(fs.readFileSync(process.env.MDV_WA_PAYJOY_SOURCE||'.local/whatsapp-payjoy-source.private.json','utf8'));
const w=patchWhatsAppPayjoyWorkflow(source);
if(process.env.MDV_WA_PAYJOY_CANDIDATE){const expected=JSON.parse(fs.readFileSync(process.env.MDV_WA_PAYJOY_CANDIDATE,'utf8'));assert.deepEqual(w,expected);}
const jid='5587000000000@s.whatsapp.net',now=Date.now();
const entry=extra=>({status:'awaiting_result',updatedAt:Date.now(),expiresAt:Date.now()+86400000,...extra});
const base=extra=>({remoteJid:jid,conversation:'[Imagem recebida]',messageType:'conversation',whatsappImageReceived:true,fromMe:false,payjoyImageBase64:Buffer.from('synthetic-image').toString('base64'),payjoyImageMimeType:'image/png',conversationEventVersion:now*1000,...extra});
function run(name,input,state={},sources={}){
 const code=w.nodes.find(n=>n.name===name)?.parameters.jsCode;assert.ok(code,name);
 const lookup=name=>{assert.ok(Object.hasOwn(sources,name),'Unexpected node reference '+name);return {first:()=>({json:sources[name]}),all:()=>[{json:sources[name]}]};};
 return new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',code)(input,{all:()=>[{json:input}]},lookup,()=>state,{id:'900001'},0);
}
const one=(...args)=>run(...args)[0]?.json;
const hydrate=(s,canonical,store={},control={},extra={})=>one('Controle Bot - Aplicar Controle',{
 control:{conversation_state_revision:1,conversation_state:canonical?{payjoyByJid:canonical}:{},...control},...extra},store,{'Controle Bot - Verificar Cliente':s});
const prepare=(s,store)=>one(NAMES.prepare,s,store);
const persist=(s,store)=>one('Estado Conversa - Preparar',s,store,{'Controle Bot - Aplicar Controle':s}).conversationStatePersistRequest;
const vision=(s,store,result)=>one('PayJoy - Calcular entrada do print',{content:JSON.stringify(result)},store,{'Controle Bot - Aplicar Controle':s});
const approved={isPayjoyResult:true,legible:true,approvalStatus:'approved',approvedAmount:1600,entryPercent:20};

test('patch is idempotent, restricted to image/state boundaries, preserves pause gates and native reader',()=>{
 assert.equal(validate(w),true);assert.deepEqual(patchWhatsAppPayjoyWorkflow(w),w);
 const changed=new Set(['Dados','Controle Bot - Aplicar Controle','Estado Conversa - Preparar','Estado Conversa - Restaurar','PayJoy - Preparar imagem','PayJoy - Ler aprovacao','Vendas - Verificar Pos Lista','Resolver Acao de Conversacao','Pagamento - Politica']);
 for(const n of source.nodes){const after=w.nodes.find(x=>x.name===n.name);assert.deepEqual(n.credentials,after.credentials,n.name);if(!changed.has(n.name))assert.deepEqual(after,n,n.name);}
 for(const [name,edges] of Object.entries(source.connections))if(name!=='Meta - Preparar contato?')assert.deepEqual(w.connections[name],edges,name);
 assert.equal(w.nodes.length,source.nodes.length+(source.nodes.some(n=>n.name===NAMES.prepare)?0:2));
 assert.deepEqual(w.settings,source.settings);
});
test('captionless WhatsApp image reaches conversation route with empty staticData',()=>{
 const input={body:{event:'messages.upsert',instance:'fixture',data:{key:{remoteJid:jid,fromMe:false,id:'synthetic-mid'},messageType:'imageMessage',message:{imageMessage:{mimetype:'image/png'},base64:base().payjoyImageBase64}}}};
 const output=one('Dados',input,{});assert.equal(output.messageType,'conversation');assert.equal(output.whatsappImageReceived,true);
 assert.equal(output.payjoyPrint,false);assert.equal(output.conversation,'[Imagem recebida]');assert.ok(output.payjoyImageBase64);
 const manual=one('Dados',{body:{...input.body,data:{...input.body.data,key:{...input.body.data.key,fromMe:true}}}},{});
 assert.equal(manual.whatsappImageReceived,undefined);
});
test('two separate executions persist link state, then cold-start image hydrates before OCR',()=>{
 const first={},text=base({whatsappImageReceived:false,conversation:'Mande o link'});
 hydrate(text,null,first);
 const linkSource={...text,conversation:'Me envie o link da PayJoy',payjoyLinkReply:{decision:'request',confidence:0.99},payjoyLinkContext:{referenciaDisponivel:true}};
 const linkReply=one('Pagamento - Politica',{payjoy_analysis_url:'https://apply.payjoy.com/synthetic'},first,{'Resolver Acao de Conversacao':linkSource});
 assert.match(linkReply.output,/https:\/\/apply\.payjoy\.com\/synthetic/);
 assert.equal(first.payjoyByJid[jid].status,'awaiting_result');
 first.salesPostList={[jid]:{selectedOptionNumber:1,options:[{number:1,name:'Note 70 8GB/256GB',colors:[{productId:'fixture-sku'}]}]}};
 const saved=JSON.parse(JSON.stringify(persist(text,first).conversationState));
 assert.equal(saved.payjoyByJid.status,'awaiting_result');
 const second={};const loaded=hydrate(base(),saved.payjoyByJid,second,{conversation_state:saved});
 assert.equal(prepare(loaded,second).payjoyPrint,true);
 const answer=vision(loaded,second,approved);
 assert.equal(answer.payjoyCalculation.entryCents,32000);assert.match(answer.output,/320,00/);assert.match(answer.output,/Note 70/);
 assert.equal(second.salesPostList[jid].options[0].colors[0].productId,'fixture-sku');
 assert.equal(persist(answer,second).conversationState.payjoyByJid.approvedAmountCents,160000);
 assert.equal(answer.payjoyImageBase64,undefined);
});
test('partial print survives fresh execution then text percentage completes the calculation',()=>{
 const first={},loaded=hydrate(base(),entry(),first);
 const answer=vision(loaded,first,{...approved,entryPercent:null});
 const saved=persist(answer,first).conversationState;
 assert.equal(saved.payjoyByJid.awaiting,'entry_percent');
 const second={},text=hydrate(base({whatsappImageReceived:false,conversation:'20%'}),saved.payjoyByJid,second);
 const result=one('Pagamento - Politica',{},second,{'Resolver Acao de Conversacao':text});
 assert.equal(result.payjoyCalculation.entryCents,32000);
});

test('cold execution reuses photo approval before sales collection and renders outbound without restarting the device',async()=>{
 const first={},loaded=hydrate(base(),entry(),first);
 const variant={productId:'fixture-note70-black',color:'Preto',memory:'8GB/256GB',price:'R$ 1.090,00',priceCents:109000};
 first.salesPostList={[jid]:{flow:'sales_post_list',step:'awaiting_fulfillment',selectedOptionNumber:1,selectedColor:'Preto',
  options:[{number:1,name:'Realme Note 70',memory:variant.memory,colors:[variant]}],
  orderDraft:{productId:variant.productId,name:'Realme Note 70',memory:variant.memory,color:'Preto',unitPriceCents:109000,quantity:1},expiresAt:Date.now()+86400000}};
 const photo=vision(loaded,first,{...approved,entryPercent:14});
 const saved=structuredClone(persist(photo,first).conversationState);
 for(const step of ['awaiting_color','awaiting_fulfillment','awaiting_pickup_time']){
  const second={},canonical={...saved,salesPostList:{...saved.salesPostList,step}};
  const incoming=base({whatsappImageReceived:false,conversation:'Quanto fica a entrada desse aparelho?'});
  const current=hydrate(incoming,canonical.payjoyByJid,second,{conversation_state:canonical});
  const before=structuredClone(second.salesPostList[jid]);
  const parsed={...current,intencao:'formas_pagamento',salesFlowAction:'indefinido',collectionInterruption:'question'};
  const post=(await run('Vendas - Verificar Pos Lista',{},second,{'Parse Classificacao':parsed}))[0].json;
  assert.equal(post.salesPostListHandled,false);
  const routed=one('Resolver Acao de Conversacao',post,second,{'switc Mensagens':current});
  assert.equal(routed.conversationAction,'responder_politica_pagamento');
  const reply=one('Pagamento - Politica',{},second,{'Resolver Acao de Conversacao':routed});
  assert.equal(reply.payjoyCalculation.entryCents,22400);assert.equal(reply.payjoyCalculation.amountCents,160000);
  assert.deepEqual(second.salesPostList[jid],before);assert.deepEqual(second.payjoyByJid[jid],saved.payjoyByJid);
  const parts=run('Dividir mensagens',reply,second,{'Resolver Acao de Conversacao':routed,'switc Mensagens':current,'Contato - Resolver':{},'Contato - Preparar':{}});
  const text=parts.map(p=>p.json.message).join('\n');
  assert.match(text,/224,00/);assert.match(text,/Realme Note 70/);
  assert.doesNotMatch(text,/envie.{0,20}print|qual aparelho|valor aprovado\?|qual percentual/i);
  // Render the HTTP body as data only. Never execute the sending node.
  const fields=w.nodes.find(n=>n.name==='Enviar WhatsApp').parameters.bodyParameters.parameters;
  for(const part of parts){const body=Object.fromEntries(fields.map(({name,value})=>[name,new Function('$json','return ('+value.slice(3,-2)+')')(part.json)]));assert.equal(body.number,jid.split('@')[0]);assert.equal(body.text,part.json.message);}
 }
});

test('approval recall rejects invalid context and explicit new amounts; zero percent stays valid',()=>{
 const {ENTRY_QUESTION}=require('../scripts/n8n-meta-payjoy-images.cjs');
 const check=new Function(ENTRY_QUESTION+';return isPayjoyEntryQuestionV2;')();
 const valid=entry({status:'approved',approvedAmountCents:160000,entryPercentBp:1400});
 for(const state of [null,entry(),{...valid,status:'denied'},{...valid,status:'declined'},
  {...valid,entryPercentBp:null},{...valid,updatedAt:Date.now()+60000},{...valid,expiresAt:1},{...valid,approvedAmountCents:-1}])
  assert.equal(check('Quanto fica a entrada?',state),false);
 for(const text of ['Quanto fica a entrada com 30%?','Quanto fica a entrada com trinta por cento?','Quanto fica a entrada com trinta porcento?','Aprovado 2000, quanto fica a entrada?',
  'Qual a entrada USB?','Quanto de entrada no cartão?','Qual entrada com juros?',
  'Quero atendente para saber a entrada','Não quero pagar entrada'])assert.equal(check(text,valid),false,text);
 const state={payjoyByJid:{[jid]:{...valid,entryPercentBp:0}}};
 const reply=one('Pagamento - Politica',{},state,{'Resolver Acao de Conversacao':base({conversation:'Quanto fica a entrada?'})});
 assert.equal(reply.payjoyCalculation.entryCents,0);assert.match(reply.output,/0,00/);
});
test('legacy recent store context authorizes only this new image, never reconstructs approval',()=>{
 const state={},loaded=hydrate(base(),null,state,{}, {recentMessages:[{direction:'outbound',text:'Envie o print do resultado da PayJoy: aprovado R$ 9.999',created_at:new Date().toISOString()}]});
 assert.equal(prepare(loaded,state).payjoyPrint,true);assert.equal(state.payjoyByJid[jid],undefined);
 const answer=vision(loaded,state,{error:'unreadable'});assert.equal(answer.payjoyCalculation,undefined);assert.match(answer.output,/Não consegui ler/);
 assert.equal(state.payjoyByJid[jid].approvedAmountCents,undefined);
});
test('no context, invalid state and failed media always have explicit safe reply instead of zero items',()=>{
 const cases=[null,entry({expiresAt:now-1}),entry({updatedAt:now+100000}),entry({status:'declined'}),entry({status:'denied'})];
 for(const canonical of cases){const state={payjoyByJid:{[jid]:entry({status:'approved',approvedAmountCents:999999})}};
  const loaded=hydrate(base(),canonical,state,{conversation_state_revision:0});
  const answer=prepare(loaded,state);assert.equal(answer.payjoyPrint,false);assert.equal(answer.whatsappImageNeedsContext,true);assert.match(answer.output,/Recebi sua imagem/);
  assert.equal(answer.payjoyImageBase64,undefined);
 }
 for(const output of [{error:'timeout'},{status:'incomplete'}, {status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal'}]}]},{}]){
  const state={},loaded=hydrate(base(),entry(),state);
  const answer=one('PayJoy - Calcular entrada do print',output,state,{'Controle Bot - Aplicar Controle':loaded});
  assert.match(answer.output,/Não consegui ler com segurança/);assert.equal(answer.payjoyCalculation,undefined);
 }
 assert.equal(w.nodes.find(n=>n.name==='PayJoy - Preparar imagem').alwaysOutputData,true);
});
test('no caption without history asks context, explicit PayJoy caption allows new OCR, stale history does not',()=>{
 const store={};const loaded=hydrate(base({whatsappOriginalCaption:'Resultado da PayJoy'}),null,store);
 assert.equal(prepare(loaded,store).payjoyPrint,true);
 for(const row of [{direction:'inbound',text:'PayJoy',created_at:new Date().toISOString()},
  {direction:'outbound',text:'PayJoy',created_at:new Date(now-86400001).toISOString()},
  {direction:'outbound',text:'preço',created_at:new Date().toISOString()}]){
  assert.equal(prepare({...hydrate(base(),null,{}),recentMessages:[row]},{}).whatsappImageNeedsContext,true);
 }
});
test('manual pause, explicit handoff and reset are preserved before image interpretation',()=>{
 for(const control of [{blocked:true},{human_handoff_active:true}]){
  const store={},loaded=hydrate(base(),entry(),store,control);
  assert.equal(loaded.n8nBotBlocked,true);assert.deepEqual(run(NAMES.prepare,loaded,store),[]);
 }
 const store={},loaded=hydrate(base(),entry(),store,{}, {resetPending:true});
 assert.equal(loaded.n8nBotResetApplied,true);assert.equal(prepare(loaded,store).payjoyPrint,false);
 const human=prepare(hydrate(base({whatsappOriginalCaption:'Quero falar com atendente'}),entry(),{}),{});
 assert.equal(human.whatsappImageNeedsContext,false);assert.equal(human.payjoyPrint,false);
});
test('rejected state write restores canonical PayJoy or clears a phantom approval without unpausing',()=>{
 for(const canonical of [entry({approvedAmountCents:160000}),null]){
  const store={payjoyByJid:{[jid]:entry({approvedAmountCents:999999})}},s=base({n8nBotControl:{human_handoff_active:true}});
  const rows=run('Estado Conversa - Restaurar',{control:{conversation_state:canonical?{payjoyByJid:canonical}:{},human_handoff_active:true},conversationStateWrite:{applied:false,reason:'stale_or_duplicate_event'}},store,{'Estado Conversa - Preparar':s});
  assert.deepEqual(rows,[]);assert.deepEqual(store.payjoyByJid[jid],canonical||undefined);
  assert.equal(s.n8nBotControl.human_handoff_active,true);
 }
});
test('Meta image preparation, credential bindings and routing are unchanged',()=>{
 for(const n of source.nodes.filter(n=>n.name.startsWith('Meta -')))assert.deepEqual(w.nodes.find(x=>x.name===n.name),n,n.name);
 const store={},s=base({metaAttendance:{channel:'instagram'},whatsappImageReceived:false});
 const loaded=hydrate(s,entry(),store,{}, {metaAttendanceOk:true});
 assert.equal(store.payjoyByJid[jid].status,'awaiting_result');
 assert.ok(persist(loaded,store).conversationState.payjoyByJid);
});
test('OCR revision conflict restores canonical state and responds safely without generic sales replay',()=>{
 const store={payjoyByJid:{[jid]:entry({approvedAmountCents:999999})}};
 const canonical=entry({approvedAmountCents:160000});
 const prepared=base({output:'rejected amount',payjoyCalculation:{entryCents:99999},conversationStatePersistRequest:{conversationState:{payjoyByJid:store.payjoyByJid[jid]}}});
 const response={control:{conversation_state_revision:5,conversation_state:{payjoyByJid:canonical}},conversationStateWrite:{applied:false,reason:'revision_conflict'}};
 const answer=one('Estado Conversa - Restaurar',response,store,{'Estado Conversa - Preparar':prepared});
 assert.equal(answer.conversationStateRebase,false);assert.equal(answer.conversationStateRevision,5);
 assert.match(answer.output,/confirme o valor aprovado e o percentual/);
 assert.equal(answer.payjoyCalculation,undefined);assert.equal(answer.conversationStatePersistRequest,undefined);
 assert.deepEqual(store.payjoyByJid[jid],canonical);
 const paused={...response,control:{...response.control,human_handoff_active:true}};
 assert.deepEqual(run('Estado Conversa - Restaurar',paused,store,{'Estado Conversa - Preparar':prepared}),[]);
});
test('selective API publication changes only state allowlist and rejects drift',()=>{
 const {patchStateKey}=require('../scripts/deploy-n8n-payjoy-state.cjs');
 const before="prefix\nconst N8N_BOT_CONVERSATION_STATE_KEYS = new Set([\n  'salesPostList',\n  'pendingDeviceClarification',\n  'optionalCustomerName',\n]);\nsuffix";
 const after=patchStateKey(before);assert.equal(after,before.replace("'optionalCustomerName',","'optionalCustomerName',\n  'payjoyByJid',"));
 assert.equal(patchStateKey(after),after);assert.throws(()=>patchStateKey(before.replace('optionalCustomerName','unknown')));
});
