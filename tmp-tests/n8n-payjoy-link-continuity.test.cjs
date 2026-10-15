'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchWorkflow,SCOPED_NODES,MARKER}=require('./n8n-payjoy-link-continuity.cjs');
const original=JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT||'.local/2670-current-workflow.json','utf8'));
const workflow=patchWorkflow(original);
if(process.env.MDV_PAYJOY_CONTINUITY_EXACT==='1')assert.deepEqual(workflow,original,'Exact candidate must already include the continuity patch');
const code=name=>workflow.nodes.find(n=>n.name===name).parameters.jsCode;
const jid='fixture@s.whatsapp.net';
const URL='https://app.payjoy.com/br/d2c?fixture=unique-official-analysis';
const config={payjoy_analysis_url:URL,store_address:'Endereço sintético da loja'};
const now=()=>Date.now();
const outbound=(text,age=1000)=>({direction:'outbound',text,created_at:new Date(now()-age).toISOString()});
const reference=()=>[outbound('Você pode fazer a análise de crédito diretamente com a PayJoy no site oficial.')];
function store(status){
 const data={salesPostList:{[jid]:{flow:'sales_post_list',step:'awaiting_purchase_confirmation',createdAt:new Date().toISOString(),expiresAt:now()+60000,selectedOptionNumber:1,options:[{number:1,name:'Fixture',memory:'8GB/256GB',colors:[{productId:'fixture',color:'Roxo'}]}],orderDraft:{productId:'fixture',name:'Fixture',memory:'8GB/256GB',color:'Roxo',unitPriceCents:122400,quantity:1}}}};
 if(status)data.payjoyByJid={[jid]:{status,updatedAt:now()-1000,expiresAt:now()+60000}};
 return data;
}
async function prepare(text,state={},recentMessages=[],extra={}){
 const src={remoteJid:jid,conversation:text,recentMessages,...extra};
 return (await new Function('$json','$getWorkflowStaticData','fetch',code('Vendas - Preparar Contexto IA'))(src,()=>state,async()=>({ok:false,json:async()=>({})})))[0].json;
}
function parse(prepared,reply,intent='formas_pagamento',raw){
 return new Function('$json','$',code('Parse Classificacao'))({output:raw??JSON.stringify({intencao:intent,payjoy_link_reply:reply})},()=>({first:()=>({json:prepared})}))[0].json;
}
function resolve(parsed,state){return new Function('$json','$','$getWorkflowStaticData',code('Resolver Acao de Conversacao'))(parsed,()=>({first:()=>({json:parsed})}),()=>state)[0].json;}
function payment(resolved,state,cfg=config){return new Function('$json','$','$getWorkflowStaticData',code('Pagamento - Politica'))(cfg,()=>({first:()=>({json:resolved})}),()=>state)[0].json;}
async function flow(text,{state=store(),history=reference(),decision='request',confidence=.99,intent='formas_pagamento',cfg=config,extra={}}={}){
 const prepared=await prepare(text,state,history,extra),parsed=parse(prepared,{decision,confidence},intent),resolved=resolve(parsed,state);
 const paid=resolved.conversationAction==='responder_politica_pagamento'?payment(resolved,state,cfg):null;
 return {prepared,parsed,resolved,paid,state,output:paid?.output||resolved.output||''};
}
function noLink(result,label){assert.ok(!result.output.includes(URL),label);assert.doesNotMatch(result.output,/https:\/\/(?:[a-z0-9-]+\.)*payjoy\.com/i,label);}

test('continuity changes only its five existing nodes, purely and idempotently',()=>{
 assert.equal(MARKER,'payjoy-link-continuity-v1');
 const expected=['Vendas - Preparar Contexto IA','Agente Inicial - Classificador','Parse Classificacao','Resolver Acao de Conversacao','Pagamento - Politica'];
 assert.deepEqual([...SCOPED_NODES].sort(),expected.sort());
 const before=structuredClone(original),updated=patchWorkflow(original);assert.deepEqual(original,before);assert.deepEqual(patchWorkflow(updated),updated);
 assert.deepEqual(updated.connections,original.connections);assert.equal(updated.nodes.length,original.nodes.length);
 const {nodes:a,...metaA}=updated,{nodes:b,...metaB}=original;assert.deepEqual(metaA,metaB);
 for(const old of b){const actual=a.find(n=>n.id===old.id);assert.ok(actual);assert.deepEqual(actual.credentials,old.credentials);if(!SCOPED_NODES.includes(old.name))assert.deepEqual(actual,old,old.name);}
 const classifier=updated.nodes.find(n=>n.name==='Agente Inicial - Classificador');assert.match(JSON.stringify(classifier.parameters),/request/);
});

test('context grounds an explicit current mention or latest recent PayJoy reply without requiring pending offer',async()=>{
 for(const [text,history]of [['Quero o site da PayJoy',[]],['Me manda esse site',reference()]]){
  const prepared=await prepare(text,store('awaiting_result'),history);assert.equal(prepared.payjoyLinkContext.ativo,false);assert.equal(prepared.payjoyLinkContext.referenciaDisponivel,true);
 }
 for(const history of [[outbound('O link da PayJoy permite fazer a análise.',25*3600000)],[outbound('O link da PayJoy permite fazer a análise.',-3600000)],[{direction:'outbound',text:'O link da PayJoy permite fazer a análise.',created_at:'not-a-date'}],[...reference(),outbound('O site da loja mostra acessórios e carregadores.')],[]]){
  assert.equal((await prepare('Me manda esse site',store(),history)).payjoyLinkContext.referenciaDisponivel,false);
 }
 assert.equal((await prepare('Manda esse site',store(),[outbound('O link da PayJoy permite fazer a análise.',23*3600000)])).payjoyLinkContext.referenciaDisponivel,true);
});

test('friend asks for that site after PayJoy explanation and receives only configured analysis URL',async()=>{
 const state=store('awaiting_result'),before=structuredClone(state.salesPostList),r=await flow('Meu amigo quer fazer também, me manda esse site',{state});
 assert.equal(r.prepared.payjoyLinkContext.referenciaDisponivel,true);assert.equal(r.parsed.payjoyLinkReply.decision,'request');assert.equal(r.resolved.conversationAction,'responder_politica_pagamento');
 assert.ok(r.output.includes(URL));assert.equal((r.output.match(/https?:\/\/[^\s|]+/g)||[]).length,1);assert.equal(r.paid.payjoyFollowupKind,'analysis_check');assert.equal(state.payjoyByJid[jid].status,'awaiting_result');assert.deepEqual(state.salesPostList,before);
});

test('explicit PayJoy analysis site request works without stored PayJoy state',async()=>{
 const state=store(),before=structuredClone(state.salesPostList),r=await flow('Me envia o site da PayJoy para fazer a análise',{state,history:[]});
 assert.equal(r.prepared.payjoyLinkContext.referenciaDisponivel,true);assert.ok(r.output.includes(URL));assert.equal(r.paid.payjoyFollowupKind,'analysis_check');assert.equal(state.payjoyByJid[jid].status,'awaiting_result');assert.deepEqual(state.salesPostList,before);
});

test('greetings, bare yes, questions, refusal, human request and outcomes never authorize a new URL',async()=>{
 for(const [text,decision,intent]of [
  ['Bom dia','other','saudacao'],['Sim','accept','saudacao'],['É seguro?','question','formas_pagamento'],['Não quero esse site','decline','formas_pagamento'],
  ['Quero falar com atendente','other','pedido_humano'],['Fui aprovado','other','formas_pagamento'],['Fui reprovado','other','formas_pagamento'],
 ]){
  const r=await flow(text,{decision,intent});noLink(r,text);
 }
});

test('another website, stale history and ungrounded request fail closed',async()=>{
 for(const history of [[...reference(),outbound('Nosso site da loja tem carregadores.')],[outbound('Você pode usar o site da PayJoy.',31*86400000)],[]]){
  const r=await flow('Pode mandar esse site',{history});assert.equal(r.prepared.payjoyLinkContext.referenciaDisponivel,false);assert.equal(r.parsed.payjoyLinkReply,null);noLink(r);
 }
});

test('invalid enum, confidence, source and malformed classifier never grant semantic request',async()=>{
 const prepared=await prepare('Manda esse site',store(),reference());
 for(const reply of [null,{decision:'send',confidence:1},{decision:'request',confidence:'1'},{decision:'request',confidence:.79},{decision:'request',confidence:1.01},{decision:'request',confidence:null}]){
  const parsed=parse(prepared,reply);assert.equal(parsed.payjoyLinkReply,null);const state=store(),resolved=resolve(parsed,state);noLink({output:resolved.conversationAction==='responder_politica_pagamento'?payment(resolved,state).output:resolved.output||''});
 }
 const ungrounded={...prepared,payjoyLinkContext:{ativo:false,referenciaDisponivel:false}};
 assert.equal(parse(ungrounded,{decision:'request',confidence:.99}).payjoyLinkReply,null);
 const malformed=parse(prepared,null,'formas_pagamento','{broken');assert.ok(!malformed.payjoyLinkReply);
 for(const confidence of [.8,1])assert.equal(parse(prepared,{decision:'request',confidence}).payjoyLinkReply.decision,'request');
});

test('missing and nonofficial configured URLs cause handoff without invented links',async()=>{
 for(const url of ['', 'https://example.com/checkout', 'https://payjoy.com.example.com/analysis']){
  const r=await flow('Me manda esse site',{cfg:{payjoy_analysis_url:url}});assert.ok(r.paid);assert.equal(r.paid.payjoyNeedsHandoff,true);noLink(r);if(url)assert.ok(!r.output.includes(url));
 }
});

test('resolver and payment independently reject a request flag when reference is absent',async()=>{
 const state=store('awaiting_result');
 const source={...(await prepare('Pode mandar esse site',state,[])),payjoyLinkReply:{decision:'request',confidence:.99}};
 assert.equal(source.payjoyLinkContext.referenciaDisponivel,false);
 const resolved=resolve(source,state);noLink({output:resolved.output||''});
 noLink({output:payment(source,state).output});
 for(const confidence of ['1',.79,1.01]){
  const prepared=await prepare('Pode mandar esse site',store(),reference());
  const forged={...prepared,payjoyLinkReply:{decision:'request',confidence}};
  noLink({output:payment(forged,store()).output});
 }
});

test('normal pending-offer acceptance remains valid and ordinary yes remains insufficient',async()=>{
 const pending=store('awaiting_link_confirmation'),r=await flow('Sim',{state:pending,decision:'accept',history:[outbound('Quer receber o link de análise PayJoy?')]});
 assert.equal(r.prepared.payjoyLinkContext.ativo,true);assert.ok(r.output.includes(URL));assert.equal(r.paid.payjoyFollowupKind,'analysis_check');
 const notPending=await flow('Sim',{state:store('awaiting_result'),decision:'accept'});assert.equal(notPending.parsed.payjoyLinkReply,null);noLink(notPending);
});
