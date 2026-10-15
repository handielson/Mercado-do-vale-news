const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const input=JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT || '.local/n8n-sales-current.json','utf8'));
const variant=require('./n8n-sales-variant-contract.cjs'),conversation=require('./n8n-sales-conversation-contract.cjs'),order=require('./n8n-sales-order-contract.cjs');
const w=order.patchWorkflow(conversation.patchWorkflow(variant.patchWorkflow(input)));
const code=name=>w.nodes.find(n=>n.name===name).parameters.jsCode;
const jid='fixture@s.whatsapp.net';
const draft=()=>({productId:'fixture-purple',name:'Modelo de teste',memory:'8GB/256GB',color:'Roxo',price:'R$ 1.224,00',unitPriceCents:122400,quantity:1,fulfillment:'delivery',customer:{fullName:'Cliente Teste',cpf:'fixture-sensitive',birthdate:'01/01/1990'}});
async function finish(step='awaiting_customer_phone_confirm',data=draft()) {
  const option={number:1,name:'Modelo de teste',memory:'8GB/256GB',price:'R$ 1.224,00',colors:[{productId:'fixture-purple',color:'Roxo',memory:'8GB/256GB',price:'R$ 1.224,00',priceCents:122400}]};
  const state={salesPostList:{[jid]:{flow:'sales_post_list',step,expiresAt:Date.now()+60000,options:[option],orderDraft:data}}};
  const source={remoteJid:jid,conversation:'Sim'};
  return (await new Function('$json','$','$getWorkflowStaticData',code('Vendas - Verificar Pos Lista'))({},()=>({first:()=>({json:source})}),()=>state))[0].json;
}
test('registration prepares a team review, not an order, and keeps private fields out of admin summary',async()=>{
  const result=await finish();
  assert.equal(result.salesPostListStep,'awaiting_team_confirmation');
  assert.equal(result.salesOrderNeedsHandoff,true);
  assert.match(result.output,/Vou solicitar à equipe/);
  assert.doesNotMatch(result.output,/pedido.*(?:sair|encaminhado|cadastrar)/i);
  assert.doesNotMatch(result.salesOrderSummary,/fixture-sensitive|1990/);
  assert.match(result.salesOrderSummary,/8GB\/256GB.*Roxo.*1.224,00/);
});
test('legacy ambiguous draft must reconfirm configuration and discard invalid installment quote',async()=>{
  const result=await finish('order_completed',{...draft(),memory:'6GB/128GB / 8GB/256GB',selectedCardInstallment:{totalCents:111788}});
  assert.equal(result.salesPostListStep,'awaiting_memory');
  assert.notEqual(result.salesOrderNeedsHandoff,true);
  assert.equal(result.orderDraft,undefined);
  assert.match(result.output,/confirmar a versão e o valor/);
});
test('customer acknowledgment depends on a real administrator receipt, including deduplication',async()=>{
  const source=await finish();
  const run=notification=>new Function('$json','$',code('Handoff - Retomar resposta solicitada'))({adminNotification:notification},()=>({first:()=>({json:source})}))[0].json;
  for(const notification of [{notified:true,code:'TEST'},{duplicate:true,deliveryConfirmed:true,code:'TEST'}]) {
    const result=run(notification);assert.equal(result.salesOrderHandoffConfirmed,true);
    assert.match(result.output,notification.notified ? /equipe foi avisada/ : /equipe já foi avisada sobre este atendimento/);
    assert.match(result.output,/8GB\/256GB/);
    if(notification.duplicate)assert.match(result.output,/ainda precisam de confirmação/);
  }
  for(const notification of [{},{notified:false,error:true},{duplicate:true},{notified:false,duplicate:true,code:'TEST'},{duplicate:true,deliveryConfirmed:false,code:'TEST'}]) {
    const result=run(notification);assert.equal(result.salesOrderHandoffConfirmed,false);assert.match(result.output,/não consegui confirmar/);
  }
});
test('handoff follows accepted persistence, then bypasses duplicate state write and preserves generic flow',()=>{
  const edge=name=>w.connections[name].main;
  assert.equal(edge('Estado Conversa - Rebase necessario?')[1][0].node,'Vendas - Pedido precisa equipe?');
  assert.equal(edge('Vendas - Pedido precisa equipe?')[0][0].node,'Atendente - Horario');
  assert.equal(edge('Atendente - Horario')[0][0].node,'Handoff - Persistir solicitado');
  assert.equal(edge('Handoff - Retomar resposta solicitada')[0][0].node,'Handoff - Pedido ja persistido?');
  assert.equal(edge('Handoff - Pedido ja persistido?')[0][0].node,'Dividir mensagens');
  assert.equal(edge('Handoff - Pedido ja persistido?')[1][0].node,'Estado Conversa - Preparar');
});
