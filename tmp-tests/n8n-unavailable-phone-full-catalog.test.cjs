'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARKER, NODES } = require('../scripts/n8n-unavailable-phone-full-catalog.cjs');

const original = JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT || '.local/7047-active-workflow-private.json', 'utf8'));
const candidate = patchWorkflow(original);
const nodes = new Map(candidate.nodes.map(node => [node.name, node]));
const jid = '5587990000000@s.whatsapp.net';
const category = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
function run(name, input={}, sources={}, state={}, all=[input]) {
  const code = nodes.get(name)?.parameters?.jsCode;
  assert.equal(typeof code, 'string');
  const lookup = key => {
    assert.ok(Object.hasOwn(sources,key),`Upstream não preparado: ${key}`);
    const values = Array.isArray(sources[key]) ? sources[key] : [sources[key]];
    return { first:()=>({json:values[0]}), all:()=>values.map(json=>({json})), item:{json:values[0]} };
  };
  return new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex','fetch',code)(input,{all:()=>all.map(json=>({json})),first:()=>({json:input})},lookup,()=>state,{id:'synthetic'},0,async()=>({ok:false,json:async()=>({})}));
}
function product(index,name,{stock=1,network='4G'}={}) {
  return { id:`fixture-${index}`, model_id:`model-${index}`, name, brand:/poco/i.test(name)?'Xiaomi':'Xiaomi', status:'active', stock_quantity:stock, price_retail:100000+index*10000, category_id:category, specs:{ram:'8GB',storage:'256GB',color:'Preto',network,rede:network}, slug:`fixture-${index}`, images:[] };
}
function inventory({targetStock=0}={}) {
  return [
    product(0,'Redmi Note 15 5G',{stock:targetStock,network:'5G'}),
    product(1,'Redmi Note 15 4G',{network:'4G'}),
    ...Array.from({length:18},(_,i)=>product(i+2,`Poco Test ${i+1} ${i%3===0?'5G':'4G'}`,{network:i%3===0?'5G':'4G'})),
  ];
}
function preparedFor(text) {
  const input={remoteJid:jid,conversation:text,intencao:'vendas_produtos',salesCategoryId:category,salesCategoryName:'smartphones',salesRequestKind:'categoria',salesFilters:{network:'5g'}};
  return run('Vendas - Preparar Busca',input)[0].json;
}
function catalog(prepared,products) {
  const state={};
  const result=run('Vendas - Contexto Produtos',{}, {'Vendas - Preparar Busca':prepared,'Vendas - Buscar Produtos':products,'switc Mensagens':prepared},state,[{channel:'presencial',installments:12,applied_fee_pct:11.9}])[0].json;
  return {result,state,parts:String(result.deterministicCatalogOutput||'').split('[[MSG]]').map(x=>x.replace(/\[\[BR\]\]/g,'\n'))};
}

test('patch is scoped and idempotent',()=>{
  assert.deepEqual(patchWorkflow(candidate),candidate);
  assert.deepEqual(candidate.connections,original.connections);
  assert.equal(candidate.nodes.length,original.nodes.length);
  const changed=candidate.nodes.filter((node,i)=>node.parameters?.jsCode!==original.nodes[i].parameters?.jsCode).map(node=>node.name);
  assert.deepEqual(changed,NODES);
  assert.ok(NODES.every(name=>nodes.get(name).parameters.jsCode.includes(MARKER)));
});

test('unavailable requested 5G model offers every available phone in groups of at most three, then a separate question',()=>{
  const prepared=preparedFor('Gostaria de saber se tem o Xiaomi Redmi Note 15 5g?');
  assert.equal(prepared.requestedDeviceModelQuery,'xiaomi redmi note 15 5g');
  const {result,state,parts}=catalog(prepared,inventory());
  assert.equal(result.salesAvailabilityStatus,'requested_model_not_confirmed_with_alternatives');
  assert.equal(result.productLookupCount,19);
  assert.equal(state.salesPostList[jid].options.length,19);
  assert.equal(state.salesPostList[jid].filters.network,'');
  assert.match(parts.join('\n'),/Redmi Note 15 4G/);
  assert.match(parts.join('\n'),/Poco Test 2 4G/);
  assert.ok(parts.slice(0,-1).every(part=>[...part.matchAll(/^\d+\.\s/gm)].length<=3));
  assert.match(parts.at(-1),/Qual modelo/i);
  assert.equal([...parts.join('\n').matchAll(/^\d+\.\s/gm)].length,19);
});

test('in-stock requested 5G model stays specific and excludes unrelated 4G models',()=>{
  const prepared=preparedFor('Gostaria de saber se tem o Xiaomi Redmi Note 15 5g?');
  const {result,parts}=catalog(prepared,inventory({targetStock:1}));
  assert.equal(result.salesAvailabilityStatus,'confirmed_products_available');
  assert.equal(result.productLookupCount,1);
  assert.match(parts.join('\n'),/Redmi Note 15 5G/);
  assert.doesNotMatch(parts.join('\n'),/Redmi Note 15 4G|Poco Test/);
});
