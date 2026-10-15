'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchNodes}=require('./n8n-fix-generic-photo-catalog.cjs');
assert.ok(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'Provide the current workflow snapshot');
const workflow=JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'utf8'));
const nodes=patchNodes(workflow.nodes);
const code=name=>nodes.find(n=>n.name===name).parameters.jsCode;
test('only the existing all-photo reply changes and patch is idempotent',()=>{
 const before=structuredClone(workflow.nodes);
 assert.deepEqual(patchNodes(nodes),nodes);
 assert.deepEqual(workflow.nodes,before);
 const changed=nodes.filter((n,i)=>JSON.stringify(n)!==JSON.stringify(workflow.nodes[i])).map(n=>n.name);
 if(process.env.MDV_PHOTO_SPLIT_EXACT==='1')assert.deepEqual(changed,[],'Candidate must already contain the split before testing');
 else assert.deepEqual(changed,['Vendas - Verificar Pos Lista']);
});
test('all-model photo request emits the exact three messages through the production splitter',async()=>{
 const source={remoteJid:'synthetic-photo-split',Instancia:'synthetic',conversation:'Todos',salesFlowAction:'nova_busca',saudacaoDetectada:false};
 const state={salesPostList:{[source.remoteJid]:{flow:'sales_post_list',step:'awaiting_product_choice',expiresAt:Date.now()+60000,photoChoiceOfferedV1:true,options:[{number:1,name:'Modelo de teste',colors:[]}]}}};
 const lookup=()=>({first:()=>({json:source}),all:()=>[{json:source}]});
 const output=(await new Function('$json','$input','$getWorkflowStaticData','$','$env','helpers',code('Vendas - Verificar Pos Lista'))({}, {},()=>state,lookup,{}, {httpRequest:async()=>{throw Error('Unexpected external call');}}))[0].json;
 const messages=new Function('$json','$',code('Dividir mensagens'))(output,lookup).map(x=>x.json);
 assert.deepEqual(messages.map(x=>x.message),[
  'Como são muitos modelos, não consigo mandar todas as fotos de uma vez pelo WhatsApp. 😊',
  'Você pode ver todos com fotos aqui: https://www.mercadodovale.com.br/?categoria=Smartphones',
  'Se quiser fotos de algum modelo específico, me diga o número ou nome dele que envio por aqui.',
 ]);
 assert.ok(messages.every((x,i)=>x.totalMessages===3&&x.messageIndex===i+1&&x.remoteJid===source.remoteJid));
 assert.equal(state.salesPostList[source.remoteJid].photoChoiceOfferedV1,false);
 assert.equal(state.salesPostList[source.remoteJid].step,'awaiting_product_choice');
});
