'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchWorkflow}=require('./n8n-attendance-flow-contract.cjs');
const workflow=JSON.parse(fs.readFileSync(process.env.MDV_ATTENDANCE_SNAPSHOT,'utf8'));
test('exact attendance candidate already contains every correction and has no transform drift',()=>{
 const candidate=JSON.parse(fs.readFileSync(process.env.MDV_ATTENDANCE_SNAPSHOT,'utf8'));
 assert.deepEqual(patchWorkflow(candidate),candidate,'Tests must cover the fully patched artifact');
 for(const [name,marker]of [
  ['Parse Classificacao','attendance-policy-fixes-v1'],
  ['Parse Classificacao','attendance-classifier-recovery-v1'],
  ['Resolver Acao de Conversacao','attendance-policy-fixes-v1'],
  ['Pagamento - Politica','attendance-policy-fixes-v1'],
  ['Vendas - Verificar Pos Lista','attendance-sales-validation-v2'],
 ])assert.ok(candidate.nodes.find(n=>n.name===name)?.parameters.jsCode.includes(marker),name+': '+marker);
});
const jid='synthetic-composed-only';
async function composed(text,step,intent='fallback',semantic=null){
 const option={number:1,name:'Fixture',memory:'8GB/256GB',price:'R$ 1.224,00',colors:[{productId:'fixture',color:'Roxo',memory:'8GB/256GB',price:'R$ 1.224,00',priceCents:122400}]};
 const state={payjoyByJid:{[jid]:{status:'awaiting_result',updatedAt:Date.now(),expiresAt:Date.now()+60000}},salesPostList:{}};
 if(step)state.salesPostList[jid]={flow:'sales_post_list',step,expiresAt:Date.now()+60000,options:[option],orderDraft:{productId:'fixture',name:'Fixture',memory:'8GB/256GB',color:'Roxo',price:'R$ 1.224,00',unitPriceCents:122400,quantity:1,fulfillment:'delivery',paymentMethod:'pix',customer:{fullName:'Cliente Teste'}}};
 const run=(name,input,source)=>new Function('$json','$','$getWorkflowStaticData','fetch',workflow.nodes.find(n=>n.name===name).parameters.jsCode)(input,()=>({first:()=>({json:source}),all:()=>[{json:source}]}),()=>state,async()=>{throw Error('External request forbidden in fixture');});
 const source={remoteJid:jid,conversation:text,salesConversationState:{ativo:!!step,step}};
 const parsed=(await run('Parse Classificacao',{output:JSON.stringify({intencao:intent,confianca:.99,collection_reply:semantic})},source))[0].json;
 const result=step?(await run('Vendas - Verificar Pos Lista',{},parsed))[0].json:(await run('Resolver Acao de Conversacao',parsed,parsed))[0].json;
 return {state,result,run};
}
for(const text of ['Não estou aprovado','Foi aprovado?'])test('parser and resolver do not turn '+text+' into credit approval',async()=>{
 const {result,state,run}=await composed(text);
 assert.equal(result.conversationAction,'responder_politica_pagamento');
 const payment=(await run('Pagamento - Politica',{payjoy_analysis_url:'https://www.payjoy.com/br/fixture'},result))[0].json;
 assert.notEqual(state.payjoyByJid[jid].status,'approved');assert.doesNotMatch(payment.output,/Que notícia boa|🎉/);
});
for(const [text,step]of [['Não confirmo','awaiting_order_confirmation'],['Não está correto','awaiting_customer_phone_confirm']])test('classifier fallback cannot confirm '+step,async()=>{
 const {result,state}=await composed(text,step);
 assert.notEqual(state.salesPostList[jid].step,'awaiting_team_confirmation');assert.ok(!result.salesOrderNeedsHandoff);
 if(step==='awaiting_order_confirmation')assert.equal(state.salesPostList[jid].step,step);
 else assert.equal(state.salesPostList[jid].step,'awaiting_customer_phone');
});
test('classifier delivery intent respects explicit pickup choice',async()=>{
 const {state}=await composed('Não quero entrega, vou retirar na loja','awaiting_fulfillment','entrega_frete');
 assert.equal(state.salesPostList[jid].orderDraft.fulfillment,'pickup');
});
test('classifier product search cannot bypass used device purchase policy',async()=>{
 const {result}=await composed('Quanto vocês pagam no meu iPhone usado?',null,'vendas_produtos');
 assert.equal(result.conversationAction,'responder_politica_pagamento');
});
for(const [text,step]of [['Vila Nova Modelo','awaiting_delivery_neighborhood'],['Rua da Garantia, 10','awaiting_delivery_address_text']])test('classifier field value survives commercial words in '+text,async()=>{
 const {state,result}=await composed(text,step,'entrega_frete',{decision:'field_value',confidence:.99});
 assert.notEqual(state.salesPostList[jid].step,step);assert.ok(!result.collectionInterruption);
});
