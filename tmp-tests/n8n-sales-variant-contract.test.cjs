'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, resolveVariant } = require('./n8n-sales-variant-contract.cjs');
const snapshot = process.env.MDV_SALES_VARIANT_SNAPSHOT || '.local/91688751/workflow-41075.json';
const before = JSON.parse(fs.readFileSync(snapshot));
const after = patchWorkflow(before);
const code = name => after.nodes.find(n => n.name === name).parameters.jsCode;
const jid = 'fixture@s.whatsapp.net';
const product = (id, ram, storage, color, price) => ({id, model_id:'redmi15', model_name:'Redmi 15', name:'Redmi 15 '+color, brand:'Xiaomi', status:'active',stock_quantity:1,price_retail:price,specs:{ram,storage,color},slug:id,images:[]});
function context(rows) {
  const base = {conversation:'Quais celulares disponíveis?',productCategoryId:'smartphones',productSearchKind:'categoria',remoteJid:jid};
  const state = {};
  const sources = {'Vendas - Preparar Busca':[base],'Vendas - Buscar Produtos':rows,'switc Mensagens':[base]};
  const lookup = name => { assert(sources[name],name); return {first:()=>({json:sources[name][0]}),all:()=>sources[name].map(json=>({json}))}; };
  const result = new Function('$json','$input','$getWorkflowStaticData','$',code('Vendas - Contexto Produtos'))({}, {all:()=>[{json:{channel:'presencial',installments:12,applied_fee_pct:11.9}}]},()=>state,lookup)[0].json;
  return {result,state};
}
const rows = [product('black128','6GB','128GB','Preto',99900),product('purple256','8GB','256GB','Roxo',122400),product('black256','8GB','256GB','Preto',122400)];
async function select(state,text,extra={}) {
  state.salesPostList[jid].selectedOptionNumber ||= 1;
  const source = {remoteJid:jid,conversation:text,salesFlowAction:'indefinido',...extra};
  const result = (await new Function('$json','$input','$getWorkflowStaticData','$',code('Vendas - Verificar Pos Lista'))({}, {},()=>state,name=>{assert.equal(name,'Parse Classificacao');return {first:()=>({json:source})}}))[0].json;
  return result;
}
test('context keeps family visual grouping and exposes one memory/price/color relation per AI line',()=>{
  const {result,state} = context(rows);
  assert.equal(result.productsInStock.length,1);
  assert.equal(result.productsInStock[0].memoryOptions.length,2);
  const lines=result.productsContext.split('\n');
  assert.equal(lines.length,2);
  assert.match(lines[0],/6GB\/128GB.*999,00/);
  assert.match(lines[1],/8GB\/256GB.*1.224,00/);
  assert.doesNotMatch(lines[0],/Roxo/);
  const option=state.salesPostList[jid].options[0];
  const purple=resolveVariant(option,'Roxo','Roxo').selected;
  assert.equal(purple.productId,'purple256'); assert.equal(purple.memory,'8GB/256GB'); assert.equal(purple.priceCents,122400);
});
test('runtime purple selection creates an exact identity and correct unit price',async()=>{
  const {state}=context(rows);
  const result=await select(state,'Roxo',{salesFlowAction:'escolher_cor',salesFlowItemNumber:1,salesFlowColor:'Roxo'});
  assert.equal(result.salesPostListStep,'awaiting_purchase_confirmation');
  assert.equal(result.orderDraft.productId,'purple256');
  assert.equal(result.orderDraft.memory,'8GB/256GB');
  assert.equal(result.orderDraft.unitPriceCents,122400);
});
test('shared color asks memory, then resolves selected memory rather than first same-color ID',async()=>{
  const {state}=context(rows);
  const first=await select(state,'Preto',{salesFlowAction:'escolher_cor',salesFlowItemNumber:1,salesFlowColor:'Preto'});
  assert.equal(first.salesPostListStep,'awaiting_memory');
  assert.equal(first.orderDraft,undefined);
  const second=await select(state,'256');
  assert.equal(second.orderDraft.productId,'black256');
  assert.equal(second.orderDraft.memory,'8GB/256GB');
  assert.equal(second.orderDraft.unitPriceCents,122400);
});
test('unavailable memory/color never prepares wrong cheaper draft',async()=>{
  const {state}=context(rows);
  const result=await select(state,'128 roxo',{salesFlowAction:'escolher_cor',salesFlowItemNumber:1,salesFlowColor:'Roxo'});
  assert.equal(result.salesPostListStep,'awaiting_memory');
  assert.equal(result.orderDraft,undefined);
  assert.match(result.output,/não está disponível/);
});
test('legacy state derives exact configuration from product ID membership',()=>{
  const option=context(rows).state.salesPostList[jid].options[0];
  for(const v of option.colors)for(const k of ['memory','price','priceCents','card'])delete v[k];
  assert.equal(resolveVariant(option,'Roxo','Roxo').selected.memory,'8GB/256GB');
  assert.match(resolveVariant(option,'Roxo','Roxo').selected.price,/1.224,00/);
});
test('a previously rejected color cannot silently select another color after memory answer',async()=>{
  const {state}=context(rows);
  await select(state,'128 roxo',{salesFlowAction:'escolher_cor',salesFlowItemNumber:1});
  const result=await select(state,'128',{salesFlowAction:'nova_busca',salesFlowItemNumber:128});
  assert.equal(result.salesPostListStep,'awaiting_color');
  assert.equal(result.orderDraft,undefined);
  assert.match(result.output,/Preto/);
  const confirmed=await select(state,'Preto',{salesFlowAction:'escolher_cor',salesFlowColor:'Preto'});
  assert.equal(confirmed.orderDraft.productId,'black128');
});
test('installment lookup uses exact variant facts and asks when configuration ambiguous',async()=>{
  const {state}=context(rows);
  state.salesPostList[jid].selectedOptionNumber=1;
  let result=await select(state,'Quanto fica em 12x no cartão?');
  assert.equal(result.needsPaymentOptionsLookup,undefined);
  state.salesPostList[jid].orderDraft={productId:'purple256'};
  result=await select(state,'Quanto fica em 12x no cartão?');
  assert.equal(result.orderDraft.memory,'8GB/256GB');
  assert.equal(result.orderDraft.unitPriceCents,122400);
});
test('composer suppresses model-generated prices when official catalog is present',()=>{
  const source={productsInStock:[{},{}],deterministicCatalogOutput:'OFFICIAL'};
  const run=output=>new Function('$json','$',code('Vendas - Compor Resposta IA'))({output},()=>({first:()=>({json:source})}))[0].json.output;
  assert.equal(run('O Redmi 15 8/256 custa R$ 1.132,00'),'OFFICIAL');
  assert.match(run('Aqui estão as opções disponíveis.'),/Aqui estão/);
});
test('patch changes only three existing nodes, preserves graph and is idempotent',()=>{
  assert.deepEqual(patchWorkflow(after),after);
  assert.deepEqual(after.connections,before.connections);
  const scope=new Set(['Vendas - Contexto Produtos','Vendas - Verificar Pos Lista','Vendas - Compor Resposta IA']);
  for(const n of before.nodes)if(!scope.has(n.name))assert.deepEqual(after.nodes.find(x=>x.id===n.id),n);
});
