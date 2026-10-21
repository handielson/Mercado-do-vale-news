'use strict';
const assert=require('node:assert/strict');
const {patchMetaPayjoyWorkflow}=require('./n8n-meta-payjoy-images.cjs');
const MARKER='whatsapp-payjoy-durable-image-v1';
const NAMES={prepare:'WhatsApp - Preparar print PayJoy',fallback:'WhatsApp - Imagem sem contexto?'};
const edge=node=>({node,type:'main',index:0});
const once=(code,before,after)=>{assert.equal(code.split(before).length,2,'PayJoy patch anchor drift');return code.replace(before,()=>after);};
const MEDIA=String.raw`// ${MARKER}: preserve new image bytes before hydration, never decide from staticData.
const payjoyImageV4=message.imageMessage;
if(!fromMe && payjoyImageV4){
 base.messageType='conversation';
 base.whatsappImageReceived=true;
 base.whatsappOriginalCaption=String(payjoyImageV4.caption||'').trim();
 base.conversation=base.whatsappOriginalCaption||'[Imagem recebida]';
 base.payjoyPrint=false;
 base.payjoyImageBase64=String(payjoyImageV4.base64||message.base64||data.base64||body.base64||'').replace(/^data:image\/[^;]+;base64,/, '').replace(/\s+/g,'');
 base.payjoyImageMimeType=String(payjoyImageV4.mimetype||'image/jpeg').toLowerCase();
 if(!/^image\/(?:jpeg|png|webp|gif)$/.test(base.payjoyImageMimeType)||base.payjoyImageBase64.length>16*1024*1024||base.payjoyImageBase64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base.payjoyImageBase64))base.payjoyImageBase64='';
}
`;
const PREPARE=String.raw`// ${MARKER}: runs only after canonical hydration and the existing pause gate.
const source=$json||{};
if(source.metaAttendance || source.whatsappImageReceived!==true)return [{json:source}];
if(source.fromMe===true || source.n8nBotBlocked===true || source.humanHandoffPaused===true)return [];
const state=$getWorkflowStaticData('global').payjoyByJid?.[source.remoteJid];
const now=Date.now(),updated=Number(state?.updatedAt||0);
const active=state && ['awaiting_result','approved'].includes(state.status)
 && Number.isFinite(updated)&&updated>0&&now>=updated&&now-updated<30*86400000
 && (!state.expiresAt || Number(state.expiresAt)>now);
const caption=String(source.whatsappOriginalCaption||'');
const human=/\b(?:atendente|humano|vendedor|pessoa da equipe)\b/i.test(caption);
// History can authorize reading THIS new image, never recover an amount or percentage.
const recent=!state&&!source.payjoyContextRejected&&(source.recentMessages||[]).some(row=>{
 if(row.direction!=='outbound'||typeof row.text!=='string'||!/\bpayjoy\b/i.test(row.text))return false;
 const sent=Date.parse(String(row.created_at||''));
 return Number.isFinite(sent)&&sent>0&&now>=sent&&now-sent<86400000;
});
const payjoyPrint=!source.n8nBotResetApplied&&!human&&Boolean(active||/\bpayjoy\b/i.test(caption)||recent);
const result={...source,payjoyPrint,whatsappImageNeedsContext:!payjoyPrint&&!human};
if(!payjoyPrint){delete result.payjoyImageBase64;delete result.payjoyImageMimeType;}
if(result.whatsappImageNeedsContext)result.output='Recebi sua imagem 😊 Ela é o resultado da análise da PayJoy? Me confirme o que você precisa conferir nela para eu continuar o atendimento.';
return [{json:result}];`;

function patchWhatsAppPayjoyWorkflow(input){
 const w=patchMetaPayjoyWorkflow(input),get=name=>{const n=w.nodes.find(n=>n.name===name);assert.ok(n,'Missing node '+name);return n;};
 if(w.nodes.some(n=>n.name===NAMES.prepare)){validate(w);return w;}
 const dados=get('Dados');
 const start=dados.parameters.jsCode.indexOf('// payjoy-approval-entry-v4: only customer images');
 const end=dados.parameters.jsCode.indexOf('const isAudioPayload = ',start);
 assert.ok(start>=0&&end>start,'Missing legacy image gate');
 dados.parameters.jsCode=dados.parameters.jsCode.slice(0,start)+MEDIA+dados.parameters.jsCode.slice(end);
 const apply=get('Controle Bot - Aplicar Controle');
 apply.parameters.jsCode=once(apply.parameters.jsCode,'if(source.metaAttendance){\n staticData.payjoyByJid=',
  `// ${MARKER}: the API is authoritative for every channel, including revision zero.\n{\n staticData.payjoyByJid=`);
 apply.parameters.jsCode=once(apply.parameters.jsCode,' if(valid)staticData.payjoyByJid[remoteJid]=',
  ' baseOutput.payjoyContextRejected=Boolean(payjoy && !valid);\n if(valid)staticData.payjoyByJid[remoteJid]=');
 const persist=get('Estado Conversa - Preparar');
 persist.parameters.jsCode=once(persist.parameters.jsCode,'if(source.metaAttendance || controlSource.metaAttendance){',
  `// ${MARKER}: serialize canonical PayJoy continuation for WhatsApp too.\n{`);
 const restore=get('Estado Conversa - Restaurar');
 restore.parameters.jsCode=once(restore.parameters.jsCode,"...(prepared.metaAttendance ? ['payjoyByJid'] : [])","'payjoyByJid'");
 restore.parameters.jsCode=once(restore.parameters.jsCode,
  "  if (write.reason !== 'revision_conflict' || retryCount >= 2 || !prepared.conversation) return [];",
  `  // ${MARKER}: a rejected OCR result must not enter generic sales rebase.
  if(write.reason==='revision_conflict' && prepared.whatsappImageReceived===true){
    if(control.blocked || control.human_handoff_active || prepared.humanHandoffPaused)return [];
    const safe={...prepared,conversationStateRebase:false,conversationStateRevision:revision,
      n8nBotControl:{...(prepared.n8nBotControl||{}),...control},
      output:'Recebi seu print, mas preciso que você confirme o valor aprovado e o percentual de entrada para continuar com segurança. 😊'};
    delete safe.payjoyCalculation;delete safe.conversationStatePersistRequest;delete safe.payjoyImageBase64;
    return [{json:safe}];
  }
  if (write.reason !== 'revision_conflict' || retryCount >= 2 || !prepared.conversation) return [];`);
 const gate=get('Meta - Imagem sem contexto?');
 const fallback=structuredClone(gate);fallback.id=MARKER+'-context';fallback.name=NAMES.fallback;
 fallback.position=[400,1100];fallback.parameters.conditions.conditions=[{
  id:MARKER+'-condition',leftValue:'={{$json.whatsappImageNeedsContext === true}}',rightValue:true,
  operator:{type:'boolean',operation:'true',singleValue:true}}];
 w.nodes.push({id:MARKER+'-prepare',name:NAMES.prepare,type:'n8n-nodes-base.code',typeVersion:2,
  position:[200,1100],parameters:{mode:'runOnceForAllItems',jsCode:PREPARE}},fallback);
 assert.deepEqual(w.connections['Meta - Preparar contato?'].main[1],[edge('PayJoy - Recebeu print?')]);
 w.connections['Meta - Preparar contato?'].main[1]=[edge(NAMES.prepare)];
 w.connections[NAMES.prepare]={main:[[edge(NAMES.fallback)]]};
 w.connections[NAMES.fallback]={main:[[edge('Estado Conversa - Preparar')],[edge('PayJoy - Recebeu print?')]]};
 // Conversion errors must still emit an item for the reader's existing safe fallback.
 get('PayJoy - Preparar imagem').alwaysOutputData=true;
 get('PayJoy - Ler aprovacao').alwaysOutputData=true;
 validate(w);return w;
}
function validate(w){
 const get=name=>w.nodes.find(n=>n.name===name);
 assert.equal(get(NAMES.prepare)?.parameters.jsCode,PREPARE,'Image preparation drift');
 assert.ok(get('Dados').parameters.jsCode.includes(MEDIA),'Normalization drift');
 assert.ok(!get('Dados').parameters.jsCode.includes('const payjoyStateV4='),'Pre-hydration state dependency remains');
 assert.ok(get('Controle Bot - Aplicar Controle').parameters.jsCode.includes(MARKER));
 assert.ok(get('Estado Conversa - Preparar').parameters.jsCode.includes(MARKER));
 assert.ok(!get('Estado Conversa - Restaurar').parameters.jsCode.includes("prepared.metaAttendance ? ['payjoyByJid']"));
 assert.deepEqual(w.connections['Meta - Preparar contato?'].main[1],[edge(NAMES.prepare)]);
 assert.deepEqual(w.connections[NAMES.prepare],{main:[[edge(NAMES.fallback)]]});
 assert.deepEqual(w.connections[NAMES.fallback],{main:[[edge('Estado Conversa - Preparar')],[edge('PayJoy - Recebeu print?')]]});
 for(const name of ['PayJoy - Preparar imagem','PayJoy - Ler aprovacao','PayJoy - Recuperar midia'])
  assert.equal(get(name).onError,'continueRegularOutput',name+' fallback missing');
 assert.equal(get('PayJoy - Preparar imagem').alwaysOutputData,true);
 assert.equal(get('PayJoy - Ler aprovacao').alwaysOutputData,true);
 for(const n of w.nodes)if(n.parameters?.jsCode)new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',n.parameters.jsCode);
 return true;
}
module.exports={MARKER,NAMES,MEDIA,PREPARE,patchWhatsAppPayjoyWorkflow,validate};
