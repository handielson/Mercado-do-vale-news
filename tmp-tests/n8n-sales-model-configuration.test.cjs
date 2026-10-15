'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {extractCatalogPreferences}=require('../services/autoresponderCatalogPreferences.cjs');
const original=JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT||'.local/n8n-payjoy-continuity-active-readback.json','utf8'));
const migration=process.env.MDV_MODEL_CONFIGURATION_OLD==='1'?{patchWorkflow:x=>structuredClone(x),SCOPED_NODES:[],MARKER:'sales-model-configuration-v1'}:require('./n8n-sales-model-configuration.cjs');
const workflow=migration.patchWorkflow(original),nodes=new Map(workflow.nodes.map(n=>[n.name,n]));
if(process.env.MDV_MODEL_CONFIGURATION_EXACT==='1')assert.deepEqual(workflow,original,'Exact candidate must already include model/configuration patch');
const jid='fixture@s.whatsapp.net',category='8b7c4852-c195-4527-8fd7-c3cc2debda42';
const clone=x=>structuredClone(x);
function execute(name,input={},sources={},state={},all=[input]){
 const code=nodes.get(name)?.parameters.jsCode;assert.equal(typeof code,'string',name);
 const lookup=key=>{assert.ok(Object.hasOwn(sources,key),`Unmocked node ${key} from ${name}`);const items=Array.isArray(sources[key])?sources[key]:[sources[key]];return {first:()=>({json:items[0]}),all:()=>items.map(json=>({json})),item:{json:items[0]}};};
 return new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex','fetch',code)(input,{all:()=>all.map(json=>({json})),first:()=>({json:input})},lookup,()=>state,{id:'synthetic'},0,async()=>({ok:false,json:async()=>({})}));
}
function product(id,model,ram=6,storage=128,color='Preto',extra={}){
 return {id,model_id:model,model_name:model,name:model+' '+color,brand:'Xiaomi',category_id:category,status:'active',stock_quantity:1,price_retail:129900,specs:{ram:ram+'GB',storage:storage+'GB',color,network:/5G/i.test(model)?'5G':'4G',rede:/5G/i.test(model)?'5G':'4G'},slug:id,images:[],...extra};
}
const sameColors=['Preto','Azul','Verde','Roxo'];
const stock=()=>[
 ...sameColors.map((color,i)=>product('same-'+i,'Redmi Note 15 4G',6,128,color)),
 product('unavailable-256','Redmi Note 15 4G',8,256,'Preto',{stock_quantity:0}),
 product('other-pro','Redmi Note 15 Pro 4G',8,256),product('other-5g','Redmi Note 15 5G',8,256),
 product('other-14s','Redmi Note 14S',8,256),product('other-15','Redmi 15',8,256),
];
const semantic=(query,flow={})=>({intencao:'vendas_produtos',venda:{tipo:'busca',busca:query,categoria:'smartphones',categoria_id:category},fluxo_venda:{acao:'nova_busca',termo_nova_busca:query,...flow}});
async function turn(text,{state={},products=stock(),query='Redmi Note 15 4G 256GB 8GB RAM',preferences={},ai='Não temos esse modelo, posso mostrar outros?',semanticOutput}={}){
 const input={remoteJid:jid,conversation:text,n8nBotControl:{sales_preferences:{active:true,constraints:preferences}},recentMessages:[]};
 const context=(await execute('Vendas - Preparar Contexto IA',input,{},state))[0].json;
 const parsed=(await execute('Parse Classificacao',{output:JSON.stringify(semanticOutput||semantic(query))},{'Vendas - Preparar Contexto IA':context},state))[0].json;
 const post=(await execute('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':parsed},state))[0]?.json||parsed;
 const resolved=(await execute('Resolver Acao de Conversacao',post,{'Parse Classificacao':parsed,'switc Mensagens':input},state))[0].json;
 const prepared=(await execute('Vendas - Preparar Busca',resolved,{},state))[0].json;
 // The production HTTP node posts only message+remoteJid; the API owns this pure parser.
 const merged=extractCatalogPreferences(text,{active:true,constraints:preferences},['Xiaomi','Samsung','Realme','Motorola','Apple','Infinix','Oukitel']);
 const acknowledgment={ok:true,recognized:merged.recognized,patch:merged.patch,preferences:merged.state};
 const restored=(await execute('Vendas - Restaurar Preferencias',acknowledgment,{'Vendas - Preparar Busca':prepared},state))[0].json;
 const result=(await execute('Vendas - Contexto Produtos',{}, {'Vendas - Preparar Busca':restored,'Vendas - Buscar Produtos':clone(products),'switc Mensagens':input},state,[{channel:'presencial',installments:12,applied_fee_pct:11.9}]))[0].json;
 const composed=(await execute('Vendas - Compor Resposta IA',{output:ai},{'Vendas - Contexto Produtos':result},state))[0].json;
 const split=await execute('Dividir mensagens',composed,{'Resolver Acao de Conversacao':resolved,'switc Mensagens':input,'Contato - Resolver':{},'Contato - Preparar':{}},state);
 return {state,context,parsed,post,resolved,prepared,acknowledgment,restored,result,composed,split,text:split.map(x=>x.json.message||'').join('\n')};
}
const ids=result=>(result.productsInStock||[]).flatMap(p=>(p.variants||[]).map(v=>v.productId));

test('model/configuration patch is pure/idempotent and preserves credentials, graph and unrelated nodes',()=>{
 const before=clone(original),updated=migration.patchWorkflow(original);assert.deepEqual(original,before);assert.deepEqual(migration.patchWorkflow(updated),updated);assert.deepEqual(updated.connections,original.connections);
 assert.equal(migration.MARKER,'sales-model-configuration-v1');
 if(process.env.MDV_MODEL_CONFIGURATION_OLD!=='1')assert.deepEqual([...migration.SCOPED_NODES].sort(),['Vendas - Preparar Busca','Vendas - Contexto Produtos','Vendas - Compor Resposta IA'].sort());
 assert.equal(updated.nodes.length,original.nodes.length);const {nodes:a,...metaA}=updated,{nodes:b,...metaB}=original;assert.deepEqual(metaA,metaB);
 for(const old of original.nodes){const current=updated.nodes.find(n=>n.id===old.id);assert.ok(current);assert.deepEqual(current.credentials,old.credentials);if(!migration.SCOPED_NODES.includes(old.name))assert.deepEqual(current,old);}
});

test('network notation does not become RAM, while explicit small RAM values remain meaningful',async()=>{
 for(const network of ['4g','5g']){
  const r=await turn(`Tem Redmi Note 15 ${network} 256GB 8GB RAM?`,{query:`Redmi Note 15 ${network} 256GB 8GB RAM`});assert.deepEqual(r.prepared.requestedRamGb,[8],network);assert.deepEqual(r.prepared.requestedStorageGb,[256],network);
 }
 for(const ram of [4,5]){const r=await turn(`Redmi Note 15 com ${ram}GB de RAM e 128GB`,{query:`Redmi Note 15 ${ram}GB RAM 128GB`});assert.deepEqual(r.prepared.requestedRamGb,[ram]);assert.deepEqual(r.prepared.requestedStorageGb,[128]);}
});

test('explicit lowercase g RAM is memory rather than a mobile network',async()=>{
 for(const [query,ram]of [['Redmi Note 15 com 4g de RAM e 128GB',4],['Redmi Note 15 RAM 5g 128GB',5],['Redmi Note 15 4GB RAM 128GB',4],['Redmi Note 15 5GB de RAM 128GB',5]]){
  const r=await turn(query,{query});assert.deepEqual(r.prepared.requestedRamGb,[ram],query);assert.deepEqual(r.prepared.requestedStorageGb,[128],query);assert.equal(r.prepared.requestedNetwork,'',query);
 }
});

test('unavailable exact memory offers in-stock same model before unrelated models without inventing requested availability',async()=>{
 const r=await turn('Oi bom dia\nVcs tem o redimi note 15 4g 256gb 8gb ram');
 assert.equal(r.result.salesAvailabilityStatus,'requested_configuration_unavailable_with_same_model');
 assert.ok(ids(r.result).some(id=>id.startsWith('same-')));assert.ok(!ids(r.result).includes('unavailable-256'));
 assert.match(r.text,/6\s*GB\s*\/\s*128\s*GB/i);assert.ok(!/^Não temos esse modelo/.test(r.text));
 assert.match(r.text,/📱 Orçamento(?:\n|$)/,'Fallback title must not label the offered 6GB/128GB as requested 8GB/256GB');
 assert.equal(r.state.salesPostList[jid].orderDraft,undefined);
 const options=r.state.salesPostList[jid].options;assert.ok(options[0].name.includes('Note 15'));assert.ok(options[0].colors.every(x=>x.productId.startsWith('same-')));
});

test('second model-only message retains exact identity and offers its alternative configuration',async()=>{
 const first=await turn('Tem Redmi Note 15 4g 256GB 8GB RAM?');
 assert.equal(first.state.salesPostList[jid].filters.network,'4g');
 const second=await turn('Eu qra msm o redmi note 15',{state:first.state,query:'Redmi Note 15',preferences:first.acknowledgment.preferences.constraints});
 assert.equal(second.prepared.requestedNetwork,'4g');assert.deepEqual(second.prepared.requestedRamGb,[]);assert.deepEqual(second.prepared.requestedStorageGb,[]);
 assert.equal(second.result.salesAvailabilityStatus,'confirmed_products_available');
 assert.ok(ids(second.result).some(id=>id.startsWith('same-')));assert.match(second.text,/6\s*GB\s*\/\s*128\s*GB/i);
 assert.doesNotMatch(second.text,/não temos esse modelo|nao temos esse modelo/i);assert.ok(!ids(second.result).some(id=>['other-pro','other-5g','other-14s','other-15'].includes(id)));
});

test('preference acknowledgment follows the actual API parser rather than copying preparation fields',async()=>{
 const params=nodes.get('Vendas - Persistir Preferencias').parameters.bodyParameters.parameters;
 assert.deepEqual(params.map(p=>p.name).sort(),['message','remoteJid']);
 const first=await turn('Tem Redmi Note 15 4g 256GB 8GB RAM?');
 assert.equal(first.acknowledgment.preferences.constraints.ramMinGb,8);
 assert.equal(first.acknowledgment.preferences.constraints.storageMinGb,null);
 assert.equal(Object.hasOwn(first.acknowledgment.preferences.constraints,'ramGb'),false);
 const second=await turn('Eu qra msm o redmi note 15',{state:first.state,query:'Redmi Note 15',preferences:first.acknowledgment.preferences.constraints});
 assert.equal(second.acknowledgment.preferences.constraints.ramMinGb,8);
 assert.equal(second.prepared.requestedNetwork,'4g');
 assert.match(second.text,/6\s*GB\s*\/\s*128\s*GB/i);assert.doesNotMatch(second.text,/não temos esse modelo|nao temos esse modelo/i);
});

test('available exact configuration takes priority and never substitutes a different model suffix',async()=>{
 const products=stock().map(p=>p.id==='unavailable-256'?{...p,stock_quantity:1}:p);
 const r=await turn('Tem Redmi Note 15 4G 8GB 256GB?',{products});
 assert.ok(ids(r.result).includes('unavailable-256'));assert.ok(!ids(r.result).some(id=>id.startsWith('other-')));assert.notEqual(r.result.salesAvailabilityStatus,'requested_configuration_unavailable_with_same_model');
});

test('distinct Pro, 5G, 14S and Redmi 15 identities resolve to their own stocked SKU',async()=>{
 for(const [query,id]of [['Redmi Note 15 Pro 4G 8GB 256GB','other-pro'],['Redmi Note 15 5G 8GB 256GB','other-5g'],['Redmi Note 14S 8GB 256GB','other-14s'],['Redmi 15 8GB 256GB','other-15']]){
  const r=await turn(query,{query});assert.ok(ids(r.result).includes(id),query);assert.deepEqual([...new Set(ids(r.result))],[id],query);
 }
});

test('same-model fallback uses product name and registered color when model metadata is absent',async()=>{
 const products=stock().map(p=>{const result={...p};delete result.model_name;delete result.model_id;return result;});
 const r=await turn('Redmi Note 15 4G 8GB 256GB',{products});
 assert.equal(r.result.salesAvailabilityStatus,'requested_configuration_unavailable_with_same_model');assert.deepEqual(new Set(ids(r.result)),new Set(['same-0','same-1','same-2','same-3']));assert.match(r.text,/6\s*GB\s*\/\s*128\s*GB/i);
});

test('Plus, Ultra and Note 15C suffixes never replace plain Note 15 as the same model',async()=>{
 const impostors=[product('plus','Redmi Note 15 Plus 4G',6,128),product('ultra','Redmi Note 15 Ultra 4G',6,128),product('15c','Redmi Note 15C 4G',6,128)];
 const r=await turn('Redmi Note 15 4G 8GB 256GB',{products:[...stock(),...impostors]});
 assert.equal(r.result.salesAvailabilityStatus,'requested_configuration_unavailable_with_same_model');for(const id of ['plus','ultra','15c'])assert.ok(!ids(r.result).includes(id),id);
 for(const [query,id]of [['Redmi Note 15 Plus 4G 6GB 128GB','plus'],['Redmi Note 15 Ultra 4G 6GB 128GB','ultra'],['Redmi Note 15C 4G 6GB 128GB','15c']]){
  const exact=await turn(query,{products:[...stock(),...impostors],query});assert.deepEqual([...new Set(ids(exact.result))],[id],query);
 }
});

test('alphanumeric model aliases retain their exact branded identity without accepting Pro suffixes',async()=>{
 const products=[
  product('poco-c71','Poco C71',4,128,'Preto'),product('poco-c71-pro','Poco C71 Pro',4,128,'Preto'),
  product('galaxy-a15','Galaxy A15',4,128,'Preto',{brand:'Samsung'}),product('galaxy-a15-pro','Galaxy A15 Pro',4,128,'Preto',{brand:'Samsung'}),
  product('realme-c71','Realme C71',4,128,'Preto',{brand:'Realme'}),product('realme-c71-pro','Realme C71 Pro',4,128,'Preto',{brand:'Realme'}),
  product('poco-m6-pro','Poco M6 Pro',8,256,'Preto'),product('poco-m6-pro-plus','Poco M6 Pro Plus',8,256,'Preto'),
 ];
 for(const [text,query,id]of [
  ['Tem celular Poco C71?','Poco C71','poco-c71'],
  ['Tem celular Samsung A15?','Samsung A15','galaxy-a15'],
  ['Tem celular Realme C71?','Realme C71','realme-c71'],
  ['Tem M6 Pro?','M6 Pro','poco-m6-pro'],
 ]){
  const r=await turn(text,{query,products});assert.deepEqual([...new Set(ids(r.result))],[id],text);assert.equal(r.result.salesAvailabilityStatus,'confirmed_products_available',text);
 }
});

test('truly absent model may offer alternatives; zero stock, hidden and inactive SKUs are never offered',async()=>{
 const products=[...stock(),product('hidden','Redmi Note 15 4G',8,256,'Branco',{offer_visibility:'hidden'}),product('inactive','Redmi Note 15 4G',8,256,'Cinza',{status:'inactive'})];
 const absent=await turn('Tem Redmi Note 99 8GB 256GB?',{products,query:'Redmi Note 99 8GB 256GB'});assert.ok(ids(absent.result).length>0);assert.notEqual(absent.result.salesAvailabilityStatus,'requested_configuration_unavailable_with_same_model');
 for(const id of ['unavailable-256','hidden','inactive'])assert.ok(!ids(absent.result).includes(id),id);
 const none=await turn('Redmi Note 15 4G 8GB 256GB',{products:products.map(p=>({...p,stock_quantity:0}))});assert.equal(none.result.productLookupCount,0);assert.ok(!ids(none.result).length);
});

test('choosing alternative color retains SKU and requires explicit purchase acceptance before fulfillment',async()=>{
 const r=await turn('Redmi Note 15 4G 8GB 256GB');const state=r.state;
 const choice={remoteJid:jid,conversation:'1',salesFlowAction:'escolher_item',salesFlowItemNumber:1};
 await execute('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':choice},state);
 const source={remoteJid:jid,conversation:'Quero a opção 1 na cor Roxo',salesFlowAction:'escolher_cor',salesFlowItemNumber:1,salesFlowColor:'Roxo'};
 const selected=(await execute('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':source},state))[0].json;
 assert.equal(selected.orderDraft.productId,'same-3');assert.equal(selected.orderDraft.memory,'6GB/128GB');assert.equal(state.salesPostList[jid].step,'awaiting_purchase_confirmation');assert.notEqual(selected.salesOrderNeedsHandoff,true);
 const yes={remoteJid:jid,conversation:'Sim, pode separar',salesFlowAction:'confirmar_compra'};
 const confirmed=(await execute('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':yes},state))[0].json;
 assert.equal(confirmed.orderDraft.productId,'same-3');assert.equal(state.salesPostList[jid].step,'awaiting_fulfillment');
});
