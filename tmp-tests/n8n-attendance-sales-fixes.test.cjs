'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
assert.ok(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'MDV_PAYJOY_WORKFLOW_SNAPSHOT must identify the exact candidate');
const original=JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'utf8'));
const migration=process.env.MDV_TEST_OLD==='1'?{patchWorkflow:x=>structuredClone(x)}:require('./n8n-attendance-sales-fixes.cjs');
const workflow=migration.patchWorkflow(original),name='Vendas - Verificar Pos Lista';
const code=workflow.nodes.find(n=>n.name===name).parameters.jsCode;
const jid='5587900000000@s.whatsapp.net';
const option={number:1,name:'Fixture',memory:'8GB/256GB',price:'R$ 1.224,00',colors:[{productId:'fixture',color:'Roxo',memory:'8GB/256GB',price:'R$ 1.224,00',priceCents:122400}]};
async function run(step,text,semantic={decision:'field_value',confidence:.99}){
 const draft={productId:'fixture',name:'Fixture',memory:'8GB/256GB',color:'Roxo',price:'R$ 1.224,00',unitPriceCents:122400,quantity:1,fulfillment:'delivery',paymentMethod:'pix',customer:{fullName:'Cliente Teste',cpf:'52998224725',birthdate:'01/01/1990'}};
 const state={salesPostList:{[jid]:{flow:'sales_post_list',step,expiresAt:Date.now()+60000,options:[option],orderDraft:draft}}};
 const source={remoteJid:jid,conversation:text,collectionReply:semantic};
 const result=(await new Function('$json','$','$getWorkflowStaticData','fetch',code)({},()=>({first:()=>({json:source})}),()=>state,async()=>{throw new Error('External request blocked by offline fixture');}))[0]?.json;
 return {result,state:state.salesPostList[jid],draft:state.salesPostList[jid]?.orderDraft};
}
test('patch is pure/idempotent and preserves all graph and nodes except existing collection owner',()=>{
 const before=structuredClone(original),updated=migration.patchWorkflow(original);
 assert.deepEqual(original,before);assert.deepEqual(migration.patchWorkflow(updated),updated);
 assert.deepEqual(updated.connections,original.connections);assert.equal(updated.nodes.length,original.nodes.length);
 for(const node of original.nodes){const actual=updated.nodes.find(x=>x.id===node.id);if(node.name!==name)assert.deepEqual(actual,node);else{const{parameters:a,...restA}=actual,{parameters:b,...restB}=node;assert.deepEqual(restA,restB);}}
});
test('negative summary never confirms the order',async()=>{
 for(const text of ['Não está certo','Não confirmo','Não, pode ser outro aparelho']){const x=await run('awaiting_order_confirmation',text);assert.equal(x.state.step,'awaiting_order_confirmation',text);assert.notEqual(x.result.salesOrderNeedsHandoff,true);}
 assert.equal((await run('awaiting_order_confirmation','Sim, está correto')).state.step,'awaiting_customer_full_name');
});
test('negative current phone requests another phone without preparing handoff',async()=>{
 for(const text of ['Não está correto','Não, pode ser outro','Não, esse mesmo não']){const x=await run('awaiting_customer_phone_confirm',text);assert.equal(x.state.step,'awaiting_customer_phone',text);assert.notEqual(x.result.salesOrderNeedsHandoff,true);}
 assert.equal((await run('awaiting_customer_phone_confirm','Sim')).result.salesOrderNeedsHandoff,true);
});
test('pickup remains pickup when customer explicitly rejects delivery',async()=>{
 for(const text of ['Não quero entrega, vou retirar na loja','Vou retirar na loja, não precisa de entrega','Entrega não, vou retirar na loja','Entrega eu não quero, vou retirar','Entrega? Não, vou retirar na loja','Quero retirar, entrega só amanhã?']){const x=await run('awaiting_fulfillment',text);assert.equal(x.draft.fulfillment,'pickup',text);assert.equal(x.state.step,'awaiting_pickup_time');}
 assert.equal((await run('awaiting_fulfillment','Quero entrega')).draft.fulfillment,'delivery');
 assert.equal((await run('awaiting_fulfillment','Não vou retirar na loja, quero entrega')).draft.fulfillment,'delivery');
 assert.equal((await run('awaiting_fulfillment','Retirada não, quero entrega')).draft.fulfillment,'delivery');
});
test('CPF checks reject repeated and incorrect digits, retaining valid documents',async()=>{
 for(const text of ['00000000000','11111111111','52998224724'])assert.equal((await run('awaiting_customer_cpf',text)).state.step,'awaiting_customer_cpf',text);
 for(const text of ['52998224725','529.982.247-25'])assert.equal((await run('awaiting_customer_cpf',text)).state.step,'awaiting_customer_birthdate',text);
});
test('birthdate rejects future, impossible age and invalid calendar dates',async()=>{
 for(const text of ['01/01/2099','01/01/1800','31/02/1990'])assert.equal((await run('awaiting_customer_birthdate',text)).state.step,'awaiting_customer_birthdate',text);
 assert.equal((await run('awaiting_customer_birthdate','20/02/1990')).state.step,'awaiting_customer_phone_confirm');
});
test('Brazilian phones reject invalid DDD, lengths and prefixes without silently truncating',async()=>{
 for(const text of ['123456789012','1111111111','00987654321','87123456789','558790000000012'])assert.equal((await run('awaiting_customer_phone',text)).state.step,'awaiting_customer_phone',text);
 for(const text of ['87900000000','+55 87 90000-0000','5533334444','555533334444']){const x=await run('awaiting_customer_phone',text);assert.equal(x.state.step,'awaiting_team_confirmation',text);assert.equal(x.result.salesOrderNeedsHandoff,true);}
 assert.equal((await run('awaiting_customer_phone','5533334444')).draft.customer.whatsapp,'+55 55 3333-4444');
});
test('missing semantic decision cannot turn cancellation or greeting into full name',async()=>{
 for(const text of ['Quero cancelar','Não quero mais','Prefiro não','Não, obrigado','Bom dia','Boa tarde','Oi tudo bem','Olá, bom dia']){const x=await run('awaiting_customer_full_name',text,null);assert.notEqual(x.draft.customer.fullName,text);assert.equal(x.state.step,'awaiting_customer_full_name',text);}
 assert.equal((await run('awaiting_customer_full_name','Maria da Silva',null)).draft.customer.fullName,'Maria da Silva');
});
test('trusted address words Modelo and Garantia are accepted while real payment questions interrupt',async()=>{
 for(const text of ['Modelo','Vila Nova Modelo']){const x=await run('awaiting_delivery_neighborhood',text);assert.equal(x.draft.deliveryNeighborhood,text);assert.equal(x.state.step,'awaiting_delivery_location');}
 const x=await run('awaiting_delivery_address_text','Rua da Garantia, 10');assert.equal(x.state.step,'awaiting_delivery_address_confirmation');
 for(const text of ['Aceita cartão','Qual o preço','Tem garantia?','Me manda a lista de modelos','Lista de modelos']){const x=await run('awaiting_delivery_neighborhood',text);assert.equal(x.result.salesPostListHandled,false,text);assert.equal(x.state.step,'awaiting_delivery_neighborhood');}
});
