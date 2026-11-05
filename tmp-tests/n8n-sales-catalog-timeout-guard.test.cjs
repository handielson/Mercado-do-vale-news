'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {patchWorkflow,patchDirectCatalogPrompt,validate,DIRECT_CODE,DIRECT_CODE_V1,BRAND_CHUNKS_MARKER,hasDirectCatalog,GATE,DIRECT}=require('./n8n-sales-catalog-timeout-guard.cjs');

const category='8b7c4852-c195-4527-8fd7-c3cc2debda42';
const catalog=Array.from({length:9},(_,i)=>`🏷️ *Marca*[[BR]]${i+1}. Modelo ${i+1}[[BR]]   📱 4GB/128GB[[BR]]      💰 R$ ${900+i},00 à vista no PIX[[BR]]      💳 Cartão: 12x de R$ 90,00[[BR]]      🎨 Cores: Preto`).join('[[MSG]]');
function workflow(){return{nodes:[
 {id:'s',name:'Vendas - Contexto Produtos',type:'n8n-nodes-base.code',position:[0,0]},
 {id:'a',name:'Especialista - Vendas',type:'@n8n/n8n-nodes-langchain.agent',position:[500,0]},
 {id:'c',name:'Vendas - Compor Resposta IA',type:'n8n-nodes-base.code',position:[750,0]},
 {id:'n',name:'Vendas - Precisa Handoff?',type:'n8n-nodes-base.if',position:[1000,0]},
 ],connections:{'Vendas - Contexto Produtos':{main:[[{node:'Especialista - Vendas',type:'main',index:0}]]},'Especialista - Vendas':{main:[[{node:'Vendas - Compor Resposta IA',type:'main',index:0}]]}}}}
test('catálogo pronto segue sem agente e mantém o outro caminho',()=>{const w=workflow();assert.equal(patchWorkflow(w).changed,true);validate(w);assert.equal(w.nodes.length,6);assert.equal(patchWorkflow(w).changed,false);assert.equal(w.nodes.filter(n=>n.name===GATE).length,1);assert.equal(w.nodes.filter(n=>n.name===DIRECT).length,1)});
test('somente a lista completa confirmada de smartphones desvia da IA',()=>{const base={productSearchKind:'categoria',productCategoryId:category,salesAvailabilityStatus:'confirmed_products_available',deterministicCatalogOutput:catalog};assert.equal(hasDirectCatalog(base),true);for(const delta of [{productSearchKind:'modelo'},{productCategoryId:'outro'},{salesAvailabilityStatus:'unknown'},{deterministicCatalogOutput:''},{requiresSpecialistHandoff:true},{specificDeviceModelRequest:true},{structuredPhoneComparison:true}])assert.equal(hasDirectCatalog({...base,...delta}),false,JSON.stringify(delta))});
test('lista oficial preserva números, preços, parcelas e um bloco por mensagem (catalog-brand-chunks-v1)',()=>{const source={salesAvailabilityStatus:'confirmed_products_available',deterministicCatalogOutput:catalog};const result=vm.runInNewContext(`(function($json){${DIRECT_CODE}})`,{}) (source)[0].json;const parts=result.output.split('[[MSG]]');assert.equal(parts.length,9);assert.ok(DIRECT_CODE.includes(BRAND_CHUNKS_MARKER));assert.match(parts[0],/lista atualizada/);for(let i=1;i<=9;i++)assert.match(result.output,new RegExp(`${i}\\. Modelo ${i}`));assert.match(result.output,/R\$ 900,00/);assert.match(result.output,/12x de R\$ 90,00/);assert.equal(result.deterministicCatalogOutput,catalog);assert.equal(result.requiresSpecialistHandoff,false)});
test('blocos maiores que o limite permanecem separados',()=>{const large=Array.from({length:6},(_,i)=>`${i+1}. Modelo ${'x'.repeat(1800)}`).join('[[MSG]]');const result=vm.runInNewContext(`(function($json){${DIRECT_CODE}})`,{})({salesAvailabilityStatus:'confirmed_products_available',deterministicCatalogOutput:large})[0].json;assert.equal(result.output.split('[[MSG]]').length,6)});
test('pergunta de escolha sai como mensagem separada após os blocos da lista',()=>{
  const question='Qual modelo voce quer ver em mais detalhes? 😊';
  const result=vm.runInNewContext(`(function($json){${DIRECT_CODE}})`,{})({salesAvailabilityStatus:'confirmed_products_available',deterministicCatalogOutput:catalog+'[[MSG]]'+question})[0].json;
  const parts=result.output.split('[[MSG]]');
  assert.equal(parts.length,10);
  assert.equal(parts[9],question);
  assert.ok(parts.slice(0,9).every(part=>!part.includes(question)));
  assert.match(parts[8],/9\. Modelo 9/);
  assert.equal((result.output.match(/Qual modelo voce quer ver em mais detalhes/g)||[]).length,1);
});
test('pergunta sobre fotos também fica isolada, inclusive com poucos modelos',()=>{
  const question='De qual modelo você quer ver fotos? Pode me dizer o número ou o nome. 😊';
  const result=vm.runInNewContext(`(function($json){${DIRECT_CODE}})`,{})({salesAvailabilityStatus:'confirmed_products_available',deterministicCatalogOutput:'1. Modelo A[[MSG]]2. Modelo B[[MSG]]'+question})[0].json;
  assert.deepEqual(result.output.split('[[MSG]]'),['Segue a lista atualizada de celulares disponíveis. 📱[[BR]][[BR]]1. Modelo A','2. Modelo B',question]);
});
test('mutação local é mínima e idempotente',()=>{
  const w=workflow();patchWorkflow(w);
  const node=w.nodes.find(item=>item.name===DIRECT);
  const expected=DIRECT_CODE_V1;
  node.parameters.jsCode=expected
    .replace(expected.slice(expected.indexOf('// catalog-choice-separate-message-v1:'),expected.indexOf('const desired =')), '')
    .replace("const body = [...(bounded ? groups : parts), ...(choicePrompt ? [choicePrompt] : [])].join('[[MSG]]');","const body = (bounded ? groups : parts).join('[[MSG]]');");
  const old=node.parameters.jsCode;
  assert.equal(patchDirectCatalogPrompt(w).changed,true);
  assert.equal(node.parameters.jsCode,expected);
  assert.equal(patchDirectCatalogPrompt(w).changed,true,'v1 sobe para o bloco por mensagem');
  assert.equal(node.parameters.jsCode,DIRECT_CODE);
  assert.equal(patchDirectCatalogPrompt(w).changed,false);
  assert.notEqual(old,expected);
});
test('candidato de produção gera um item por bloco para o emissor do WhatsApp', {skip:!process.env.MDV_N8N_SALES_SNAPSHOT},()=>{
  const candidate=JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT,'utf8'));
  const direct=candidate.nodes.find(node=>node.name===DIRECT)?.parameters?.jsCode;
  const splitter=candidate.nodes.find(node=>node.name==='Dividir mensagens')?.parameters?.jsCode;
  assert.equal(direct,DIRECT_CODE);
  assert.ok(splitter);
  const question='Qual modelo voce quer ver em mais detalhes? 😊';
  const source={remoteJid:'fixture@s.whatsapp.net',Instancia:'fixture',messageId:'INBOUND-FIXTURE',salesAvailabilityStatus:'confirmed_products_available',deterministicCatalogOutput:catalog+'[[MSG]]'+question};
  const output=new Function('$json',direct)(source)[0].json;
  const lookup=()=>({first:()=>({json:source})});
  const sent=new Function('$json','$',splitter)(output,lookup).map(item=>item.json);
  assert.equal(sent.length,10);
  assert.equal(sent[9].message,question);
  assert.ok(sent.slice(0,9).every(item=>!item.message.includes(question)));
  assert.ok(sent.slice(0,9).every(item=>item.message.includes('R$ ')));
  assert.deepEqual(sent.map(item=>item.messageIndex),[1,2,3,4,5,6,7,8,9,10]);
  assert.ok(sent.every(item=>item.totalMessages===10));
});
// catalog-brand-chunks-v1: ponta a ponta no candidato (Contexto Produtos -> Catalogo sem IA -> Dividir mensagens).
test('lista real: no máximo 3 celulares por mensagem e nunca duas marcas juntas', {skip:!process.env.MDV_N8N_SALES_SNAPSHOT},()=>{
  const candidate=JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT,'utf8'));
  const code=name=>candidate.nodes.find(node=>node.name===name)?.parameters?.jsCode;
  const mk=(i,brand,model)=>({id:'p'+i,model_id:'m'+i,model_name:model,name:model+' Preto',brand,status:'active',stock_quantity:1,price_cents:100000+i*1000,specs:{ram:'8GB',storage:'256GB',color:'Preto'},category_id:category});
  const rows=[mk(1,'Xiaomi','Redmi 15'),mk(2,'Xiaomi','Redmi Note 15'),mk(3,'Xiaomi','POCO X8'),mk(4,'Xiaomi','Redmi 15C'),mk(5,'Xiaomi','POCO M8'),mk(6,'Realme','Realme C75'),mk(7,'Realme','Realme Note 70'),mk(8,'Samsung','Galaxy A17'),mk(9,'Xiaomi','Redmi A5'),mk(10,'Xiaomi','Redmi 15 5G')];
  const base={conversation:'Quais celulares disponíveis?',productCategoryId:category,productSearchKind:'categoria',remoteJid:'fixture@s.whatsapp.net',Instancia:'fixture',messageId:'INBOUND-FIXTURE'};
  const sources={'Vendas - Preparar Busca':[base],'Vendas - Buscar Produtos':rows,'switc Mensagens':[base]};
  const lookup=name=>({first:()=>({json:(sources[name]||[{}])[0]}),all:()=>(sources[name]||[]).map(json=>({json}))});
  const ctxOut=new Function('$json','$input','$getWorkflowStaticData','$',code('Vendas - Contexto Produtos'))({}, {all:()=>[{json:{channel:'presencial',installments:12,applied_fee_pct:11.9}}]}, ()=>({}), lookup);
  const ctx={...base,...(Array.isArray(ctxOut)?ctxOut[0].json:ctxOut),salesAvailabilityStatus:'confirmed_products_available'};
  const direct=new Function('$json',code(DIRECT))(ctx)[0].json;
  const sent=new Function('$json','$',code('Dividir mensagens'))(direct,()=>({first:()=>({json:base})})).map(item=>item.json.message);
  const lists=sent.filter(message=>/^\d+\. /m.test(message));
  assert.ok(lists.length>=4,'blocos separados');
  for(const message of lists){
    assert.ok((message.match(/^\d+\. /gm)||[]).length<=3,'até 3 aparelhos: '+message.slice(0,80));
    assert.ok((message.match(/🏷️/g)||[]).length<=1,'uma marca por mensagem: '+message.slice(0,80));
  }
  for(let i=1;i<=10;i++)assert.ok(sent.some(message=>new RegExp('^'+i+'\\. ','m').test(message)),'item '+i);
  assert.match(sent.at(-1),/Qual modelo voce quer ver em mais detalhes/);
});
