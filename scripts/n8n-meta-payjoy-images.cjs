'use strict';
// Additive adapter: reuse the existing PayJoy reader, calculator and policies.
// No WhatsApp media retrieval, contact lookup or state contract is changed.
const assert=require('node:assert/strict');
const MARKER='meta-payjoy-images-continuity-v1';
const NAMES={prepare:'Meta - Preparar print PayJoy',fallback:'Meta - Imagem sem contexto?',
 contact:'Meta - Contato apos imagem?',unavailable:'Meta - Print indisponivel?'};
const ENTRY_QUESTION=String.raw`function isMetaPayjoyEntryQuestionV1(meta,text,state){
 if(!meta || state?.status!=='approved')return false;
 const current=Date.now(),updated=Number(state.updatedAt || 0);
 if(!Number.isFinite(updated)||updated<=0||current<updated||current-updated>=30*86400000
  || (state.expiresAt && Number(state.expiresAt)<=current))return false;
 if(!Number.isSafeInteger(state.approvedAmountCents)||state.approvedAmountCents<=0||state.approvedAmountCents>100000000
  || !Number.isInteger(state.entryPercentBp)||state.entryPercentBp<0||state.entryPercentBp>10000)return false;
 const n=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return /\bentrada\b/.test(n) && /\b(?:quanto|qual|valor|fica|preciso|pagar|dar|custa)\b/.test(n)
  && !/\b(?:nao|reprovad[oa]s?|negad[oa]s?|atendente|humano|vendedor|cartao|juros|desconto|taxa|usb|p2|hdmi|fone|carregador|cabo|porta)\b/.test(n);
}`;
const PREPARE=String.raw`// ${MARKER}: the canonical durable context has already been hydrated.
const source=$json || {};
const state=$getWorkflowStaticData('global').payjoyByJid?.[source.remoteJid];
const current=Date.now(),updated=Number(state?.updatedAt || 0);
const active=state && ['awaiting_result','approved'].includes(state.status)
 && Number.isFinite(updated) && updated>0 && current>=updated && current-updated<30*86400000
 && (!state.expiresAt || Number(state.expiresAt)>current);
const caption=String(source.metaOriginalCaption || '').trim();
const human=/\b(?:atendente|humano|vendedor|pessoa da equipe)\b/i.test(caption);
const payjoyPrint=source.metaImageReceived === true && Boolean(active) && !human;
const needsContext=source.metaImageReceived === true && !payjoyPrint && !caption;
const result={...source,payjoyPrint,metaImageNeedsContext:needsContext};
if(!payjoyPrint){delete result.payjoyImageBase64;delete result.payjoyImageMimeType;}
if(needsContext)result.output='Recebi sua imagem 😊 Você está enviando o resultado de uma análise da PayJoy? Me conte o que precisa conferir nela.';
return [{json:result}];`;
function once(text,old,next){assert.equal(text.split(old).length-1,1,'Missing/ambiguous Meta PayJoy anchor');return text.replace(old,()=>next);}
const edge=node=>({node,type:'main',index:0});
function ifNode(template,name,id,expression,position){const result=structuredClone(template);
 delete result.credentials;result.id=id;result.name=name;result.position=position;
 const conditions=result.parameters.conditions;conditions.conditions=[{id:id+'-condition',leftValue:expression,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}];
 return result;
}
function validateMetaPayjoyWorkflow(w){
 const get=name=>{const n=w.nodes.find(n=>n.name===name);assert.ok(n,'Missing Meta PayJoy node '+name);return n;};
 assert.equal(get(NAMES.prepare).parameters.jsCode,PREPARE,'Meta PayJoy preparation drift');
 for(const name of ['Meta - Normalizar entrada','Controle Bot - Aplicar Controle','Estado Conversa - Preparar','Estado Conversa - Restaurar','Resolver Acao de Conversacao','Pagamento - Politica'])assert.ok(get(name).parameters.jsCode.includes(MARKER),'Missing Meta PayJoy boundary '+name);
 assert.deepEqual(w.connections['Meta - Preparar contato?'].main[0],[edge(NAMES.prepare)]);
 assert.deepEqual(w.connections[NAMES.prepare].main,[[edge(NAMES.fallback)]]);
 assert.deepEqual(w.connections[NAMES.fallback].main,[[edge('Estado Conversa - Preparar')],[edge('PayJoy - Recebeu print?')]]);
 assert.deepEqual(w.connections['PayJoy - Recebeu print?'].main[1],[edge(NAMES.contact)]);
 assert.deepEqual(w.connections[NAMES.contact].main,[[edge('Meta - Contato sem telefone')],[edge('Contato - Preparar')]]);
 assert.deepEqual(w.connections['PayJoy - Print tem arquivo?'].main[1],[edge(NAMES.unavailable)]);
 assert.deepEqual(w.connections[NAMES.unavailable].main,[[edge('PayJoy - Calcular entrada do print')],[edge('PayJoy - Recuperar midia')]]);
 assert.deepEqual(w.connections['PayJoy - Ler aprovacao'].main[0],[edge('PayJoy - Calcular entrada do print')]);
 assert.equal(get('PayJoy - Ler aprovacao').onError,'continueRegularOutput','Existing vision error fallback must remain wired');
 const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length,'Duplicate nodes');
 for(const [name,outputs]of Object.entries(w.connections)){assert.ok(names.has(name));for(const groups of Object.values(outputs))for(const group of groups)for(const e of group)assert.ok(names.has(e.node),'Unknown target');}
 for(const n of w.nodes)if(n.parameters?.jsCode)new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',n.parameters.jsCode);
 return true;
}
function patchMetaNormalizerCode(code){
 let next=once(code,
  "const conversation = typeof event.text === 'string' ? event.text.trim() : '';\nif (!conversation || conversation.length > 20000) throw new Error('unsupported_meta_text');",
  String.raw`// ${MARKER}: image bytes come only from the trusted API downloader.
const originalCaption=typeof event.text === 'string' ? event.text.trim() : '';
const image=input.payjoyImage;
const imageReceived=image != null || (Array.isArray(event.attachments) && event.attachments.some(a=>a?.type==='image'));
const mime=typeof image?.mimeType === 'string' ? image.mimeType.toLowerCase() : '';
let base64=typeof image?.base64 === 'string' ? image.base64 : typeof image?.data === 'string' ? image.data : '';
base64=base64.replace(/^data:image\/[^;]+;base64,/,'').replace(/\s+/g,'');
if(!/^image\/(?:jpeg|png|webp|gif)$/.test(mime) || !base64 || base64.length>16*1024*1024
 || base64.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))base64='';
const conversation=originalCaption || (imageReceived ? '[Imagem recebida]' : '');
if(!conversation || conversation.length>20000)throw new Error('unsupported_meta_text');`);
 return once(next,"messageId:event.providerEventId,conversationEventVersion:version,",
  "messageId:event.providerEventId,conversationEventVersion:version,\n metaOriginalCaption:originalCaption,metaImageReceived:imageReceived,payjoyPrint:imageReceived,payjoyImageBase64:base64,payjoyImageMimeType:mime,");
}
function patchMetaPayjoyWorkflow(input){
 assert.ok(Array.isArray(input.nodes)&&input.connections,'Workflow required');
 if(input.nodes.some(n=>n.name===NAMES.prepare)){validateMetaPayjoyWorkflow(input);return structuredClone(input);}
 const w=structuredClone(input),get=name=>{const n=w.nodes.find(n=>n.name===name);assert.ok(n,'Missing source node '+name);return n;};
 const normal=get('Meta - Normalizar entrada');
 normal.parameters.jsCode=patchMetaNormalizerCode(normal.parameters.jsCode);
 const apply=get('Controle Bot - Aplicar Controle');
 apply.parameters.jsCode=once(apply.parameters.jsCode,
  '// meta-attendance-shared-core-v1: global pause also applies when Meta bypasses phone admin commands.',
  `// ${MARKER}: Meta state is authoritative even for a first revision or reset.
if(source.metaAttendance){
 staticData.payjoyByJid=staticData.payjoyByJid || {};
 const payjoy=persistedConversationState.payjoyByJid;
 const current=Date.now(),updated=Number(payjoy?.updatedAt || 0);
 const valid=payjoy && typeof payjoy==='object' && !Array.isArray(payjoy) && Number.isFinite(updated)
  && updated>0 && current>=updated && current-updated<30*86400000
  && (!payjoy.expiresAt || Number(payjoy.expiresAt)>current) && !payload.resetPending;
 if(valid)staticData.payjoyByJid[remoteJid]=JSON.parse(JSON.stringify(payjoy));
 else delete staticData.payjoyByJid[remoteJid];
}
// meta-attendance-shared-core-v1: global pause also applies when Meta bypasses phone admin commands.`);
 const prepare=get('Estado Conversa - Preparar');
 prepare.parameters.jsCode=once(prepare.parameters.jsCode,'return [{ json: {\n  ...source,\n  conversationStatePersistRequest:',
  `// ${MARKER}: durable PayJoy continuation is scoped exclusively to Meta.
if(source.metaAttendance || controlSource.metaAttendance){
 const payjoy=staticData.payjoyByJid?.[remoteJid];
 const updated=Number(payjoy?.updatedAt || 0);
 if(payjoy && typeof payjoy==='object' && !Array.isArray(payjoy) && Number.isFinite(updated)
  && updated>0 && now>=updated && now-updated<30*86400000 && (!payjoy.expiresAt || Number(payjoy.expiresAt)>now))
   conversationState.payjoyByJid=JSON.parse(JSON.stringify(payjoy));
 else if(staticData.payjoyByJid)delete staticData.payjoyByJid[remoteJid];
}
return [{ json: {
  ...source,
  conversationStatePersistRequest:`);
 const restore=get('Estado Conversa - Restaurar');
 restore.parameters.jsCode=once(restore.parameters.jsCode,"  for (const key of ['salesPostList', 'pendingDeviceClarification']) {",
  `  // ${MARKER}: rejected writes must restore Meta PayJoy state too.
  for (const key of ['salesPostList', 'pendingDeviceClarification', ...(prepared.metaAttendance ? ['payjoyByJid'] : [])]) {`);
 const resolver=get('Resolver Acao de Conversacao');
 resolver.parameters.jsCode=once(resolver.parameters.jsCode,'const deterministicPayjoyV1 = ',
  `// ${MARKER}: approved durable result grounds an entry-only follow-up.\n${ENTRY_QUESTION}\nconst metaPayjoyEntryQuestionV1=isMetaPayjoyEntryQuestionV1(source.metaAttendance,text,payjoyStateV1);\nconst deterministicPayjoyV1 = `);
 resolver.parameters.jsCode=once(resolver.parameters.jsCode,'&& (payjoyTypedResultV4 || (payjoyExplicitV1',
  '&& (metaPayjoyEntryQuestionV1 || payjoyTypedResultV4 || (payjoyExplicitV1');
 const payment=get('Pagamento - Politica');
 payment.parameters.jsCode=once(payment.parameters.jsCode,'const inputPayjoyV4=parsePayjoyTextV4(text,active?.awaiting);',
  `// ${MARKER}: reuse the same calculation and reply without re-requesting a print.
${ENTRY_QUESTION}
if(isMetaPayjoyEntryQuestionV1(source.metaAttendance,text,active)){
 const values=calculatePayjoyEntryV4({},active);
 const selectedState=staticData.salesPostList?.[remoteJid];
 const selected=selectedState?.options?.find(item=>Number(item.number)===Number(selectedState.selectedOptionNumber));
 return [{json:{...source,output:payjoyReplyV4(values,selected?.name||''),payjoyFollowupKind:'',payjoyNeedsHandoff:false,payjoyCalculation:values}}];
}
const inputPayjoyV4=parsePayjoyTextV4(text,active?.awaiting);`);
 const gate=get('Meta - Preparar contato?');
 w.nodes.push({id:'meta-payjoy-prepare-v1',name:NAMES.prepare,type:'n8n-nodes-base.code',typeVersion:2,position:[200,720],parameters:{mode:'runOnceForAllItems',jsCode:PREPARE}},
  ifNode(gate,NAMES.fallback,'meta-payjoy-context-gate-v1','={{$json.metaImageNeedsContext === true}}',[400,720]),
  ifNode(gate,NAMES.contact,'meta-payjoy-contact-gate-v1',"={{Boolean($('switc Mensagens').first().json.metaAttendance)}}",[600,920]),
  ifNode(gate,NAMES.unavailable,'meta-payjoy-unavailable-gate-v1',"={{Boolean($('switc Mensagens').first().json.metaAttendance)}}",[600,720]));
 assert.deepEqual(w.connections['Meta - Preparar contato?'].main[0],[edge('Meta - Contato sem telefone')]);
 assert.deepEqual(w.connections['PayJoy - Recebeu print?'].main[1],[edge('Contato - Preparar')]);
 assert.deepEqual(w.connections['PayJoy - Print tem arquivo?'].main[1],[edge('PayJoy - Recuperar midia')]);
 w.connections['Meta - Preparar contato?'].main[0]=[edge(NAMES.prepare)];
 w.connections[NAMES.prepare]={main:[[edge(NAMES.fallback)]]};
 w.connections[NAMES.fallback]={main:[[edge('Estado Conversa - Preparar')],[edge('PayJoy - Recebeu print?')]]};
 w.connections['PayJoy - Recebeu print?'].main[1]=[edge(NAMES.contact)];
 w.connections[NAMES.contact]={main:[[edge('Meta - Contato sem telefone')],[edge('Contato - Preparar')]]};
 w.connections['PayJoy - Print tem arquivo?'].main[1]=[edge(NAMES.unavailable)];
 w.connections[NAMES.unavailable]={main:[[edge('PayJoy - Calcular entrada do print')],[edge('PayJoy - Recuperar midia')]]};
 validateMetaPayjoyWorkflow(w);return w;
}
module.exports={MARKER,NAMES,PREPARE,ENTRY_QUESTION,patchMetaPayjoyWorkflow,patchMetaNormalizerCode,validateMetaPayjoyWorkflow};
