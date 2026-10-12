const assert = require('node:assert/strict');
const fs = require('node:fs');
const {patchWorkflow,validate} = require('./n8n-fix-payjoy-link-confirmation.cjs');
assert.ok(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT, 'Provide a read-only active workflow snapshot');
const original=JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'utf8'));
const updated=patchWorkflow(original);
assert.deepEqual(updated.connections,original.connections);
assert.deepEqual(patchWorkflow(updated),updated);
const allowed=new Set(['Resolver Acao de Conversacao','Pagamento - Politica','Agente Geral - Atendimento']);
for(let i=0;i<original.nodes.length;i++)if(!allowed.has(original.nodes[i].name))assert.deepEqual(updated.nodes[i],original.nodes[i]);
validate(updated);
const code=name=>updated.nodes.find(n=>n.name===name).parameters.jsCode;
const jid='fixture@s.whatsapp.net';
const source={remoteJid:jid,conversationStateRevision:7,conversationStateEventVersion:12345};
const execute=(name,json,state,lookup=source)=>new Function('$json','$','$getWorkflowStaticData',code(name))(json,()=>({first:()=>({json:lookup})}),()=>state)[0].json;
const entry={status:'awaiting_link_confirmation',updatedAt:Date.now(),expiresAt:Date.now()+86400000};
const store={payjoyByJid:{[jid]:entry},salesPostList:{[jid]:{step:'awaiting_color',expiresAt:Date.now()+86400000}}};
const request=execute('Estado Conversa - Preparar',source,store).conversationStatePersistRequest;
assert.equal(request.conversationState.payjoyByJid,undefined);
assert.equal(request.expectedRevision,7);
assert.equal(request.eventVersion,12345);
const restarted={};
const payload={control:{conversation_state:request.conversationState,conversation_state_revision:8,human_handoff_active:true}};
const hydrated=execute('Controle Bot - Aplicar Controle',payload,restarted);
assert.equal(restarted.payjoyByJid,undefined);
assert.equal(hydrated.n8nBotBlocked,true);
assert.equal(restarted.salesPostList[jid].step,'awaiting_color');
execute('Controle Bot - Aplicar Controle',{...payload,resetPending:true},restarted);
assert.equal(restarted.salesPostList[jid],undefined);
const expired={payjoyByJid:{[jid]:{...entry,expiresAt:Date.now()-1}}};
assert.equal(execute('Estado Conversa - Preparar',source,expired).conversationStatePersistRequest.conversationState.payjoyByJid,undefined);
const resolver=code('Resolver Acao de Conversacao'),payment=code('Pagamento - Politica');
function route(text,state){const s={...source,conversation:text};return new Function('$json','$','$getWorkflowStaticData',resolver)({...s,output:JSON.stringify({acao:'perguntar_esclarecimento'})},()=>({first:()=>({json:s})}),()=>state)[0].json;}
function reply(text,state,link='https://app.payjoy.com/br/d2c?fixture=1'){return new Function('$json','$','$getWorkflowStaticData',payment)({payjoy_analysis_url:link},()=>({first:()=>({json:route(text,state)})}),()=>state)[0].json;}
for(const text of ['Manda o link','Tem como fazer a análise?','Como faz pra saber']){const s={payjoyByJid:{[jid]:{...entry,status:'awaiting_result'}}};assert.equal(route(text,s).conversationIntent,'payjoy');assert.match(reply(text,s).output,/fixture=1/);}
for(const text of ['Quero falar com atendente','Tem iphone?','Entrega hoje?','Quanto custa a análise?','Sim'])assert.notEqual(route(text,{payjoyByJid:{[jid]:{...entry,status:'awaiting_result'}}}).conversationIntent,'payjoy',text);
for(const text of ['Não quero fazer análise','Não','Não quero o link da PayJoy']){const s={payjoyByJid:{[jid]:entry}};assert.equal(route(text,s).conversationIntent,'payjoy');assert.doesNotMatch(reply(text,s).output,/fixture=1/);assert.equal(s.payjoyByJid[jid].status,'declined');assert.notEqual(route('Sim',s).conversationIntent,'payjoy');}
for(const text of ['Não fui aprovado na análise','Não consegui fazer a análise','Quero fazer análise mas fui reprovada']){const s={payjoyByJid:{[jid]:entry}};assert.equal(route(text,s).conversationIntent,'payjoy',text);assert.doesNotMatch(reply(text,s).output,/fixture=1/,text);assert.equal(s.payjoyByJid[jid].status,'denied',text);}
assert.equal(reply('Sim',{payjoyByJid:{[jid]:entry}},'https://example.com').payjoyNeedsHandoff,true);
assert.doesNotMatch(reply('Vocês aceitam celular usado como entrada?',{payjoyByJid:{[jid]:entry}}).output,/fixture=1/);
const general=updated.nodes.find(n=>n.name==='Agente Geral - Atendimento').parameters.options.systemMessage;
assert.match(general,/Nunca solicite nome completo, CPF/);
assert.match(general,/nao altera o cadastro normal/);
console.log('PayJoy continuation, official link, existing state/API contract, handoff, refusals, unrelated topics and scoped/idempotent patch passed');
