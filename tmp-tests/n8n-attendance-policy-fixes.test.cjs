'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
assert.ok(process.env.MDV_ATTENDANCE_SNAPSHOT,'MDV_ATTENDANCE_SNAPSHOT must identify the exact candidate');
const baseline=JSON.parse(fs.readFileSync(process.env.MDV_ATTENDANCE_SNAPSHOT,'utf8'));
const old=process.env.MDV_TEST_OLD==='1';
const w=old?baseline:require('./n8n-attendance-policy-fixes.cjs').patchWorkflow(baseline);
const jid='synthetic-policy-only';
const run=(name,input,source,state)=>new Function('$json','$','$getWorkflowStaticData',w.nodes.find(n=>n.name===name).parameters.jsCode)(input,()=>({first:()=>({json:source}),all:()=>[{json:source}]}),()=>state)[0].json;
function payment(text){const state={payjoyByJid:{[jid]:{status:'awaiting_result',updatedAt:Date.now(),expiresAt:Date.now()+60000}}};
 const source={remoteJid:jid,conversation:text};const route=run('Resolver Acao de Conversacao',source,source,state);
 const result=run('Pagamento - Politica',{payjoy_analysis_url:'https://www.payjoy.com/br/fixture'},route,state);
 return {state:state.payjoyByJid[jid],result,route};}
test('negative, pending, questions and hypothetical results never become approvals',()=>{
 for(const text of ['Não estou aprovado','Não deu aprovado','Não apareceu aprovado','Foi aprovado?','Fui aprovado?','Estou aprovado?','Se eu for aprovado','Quero ser aprovado','Ainda não fui aprovado','Será que estou aprovado?','Não estou reprovado','Meu irmão foi aprovado, mas eu não','Foi aprovado para minha esposa, mas eu não','A PayJoy aprovou meu amigo, mas a minha análise não deu certo']){
  const {state,result}=payment(text);assert.notEqual(state.status,'approved',text);assert.doesNotMatch(result.output,/Que not[ií]cia boa|🎉/,text);
  assert.doesNotMatch(result.output,/fixture/,text);
 }
});
test('unambiguous actual result reports keep approval and rejection without sending new links',()=>{
 for(const text of ['Fui aprovada','A PayJoy aprovou','Consegui aprovação','Fui aprovada, como funciona a entrada?','Fui aprovada e quanto ficou a entrada?','A PayJoy me aprovou e quanto ficou a entrada?'])assert.equal(payment(text).state.status,'approved',text);
 for(const text of ['Não fui aprovado','Fui reprovada','Não estou aprovado'])assert.equal(payment(text).state.status,'denied',text);
});
test('selling a used phone routes to existing policy instead of product search',()=>{
 for(const text of ['Quanto vocês pagam no meu iPhone usado?','Vocês avaliam meu celular usado?','Quero vender meu iPhone usado','Vocês compram aparelhos usados?','Vocês compram meu iPhone?','Quanto pagam no meu iPhone?','Quero vender meu iPhone','Tenho um iPhone usado para vender']){
  const source={remoteJid:jid,conversation:text};const state={};
  const parsed=run('Parse Classificacao',{output:JSON.stringify({intencao:'vendas_produtos',confianca:0.98,venda:{tipo:'busca',busca:'iPhone'}})},source,state);
  assert.equal(parsed.intencao,'formas_pagamento',text);
  const route=run('Resolver Acao de Conversacao',parsed,source,state);
  assert.equal(route.conversationAction,'responder_politica_pagamento',text);
  const result=run('Pagamento - Politica',{},route,state);assert.match(result.output,/n[aã]o compramos aparelhos usados/,text);
 }
});
test('a purchase of a used phone in the past remains an after-sales inquiry',()=>{
 const source={remoteJid:jid,conversation:'Comprei um celular usado e ele deu defeito'};
 assert.equal(run('Parse Classificacao',{output:JSON.stringify({intencao:'pos_venda',confianca:0.98})},source,{}).intencao,'pos_venda');
});
if(!old)test('patch is pure, scoped and idempotent with credentials and graph intact',()=>{
 const mod=require('./n8n-attendance-policy-fixes.cjs'),before=structuredClone(baseline);mod.patchWorkflow(baseline);
 assert.deepEqual(before,baseline);assert.deepEqual(mod.patchWorkflow(w),w);assert.deepEqual(w.connections,baseline.connections);
 for(const n of baseline.nodes){const actual=w.nodes.find(x=>x.name===n.name);assert.deepEqual(actual.credentials,n.credentials);if(!mod.SCOPED_NODES.includes(n.name))assert.deepEqual(actual,n);}
});
