'use strict';
const assert = require('node:assert/strict');
const MARKER = 'sales-team-confirmation-contract-v1';
const once = (text, anchor, replacement) => {
  assert.equal(text.split(anchor).length - 1, 1, 'Missing/ambiguous order anchor: ' + anchor.slice(0, 90));
  return text.replace(anchor, replacement);
};
function patchWorkflow(input) {
  const w = structuredClone(input);
  const node = name => {const n=w.nodes.find(n=>n.name===name);assert(n,name);return n;};
  const post = node('Vendas - Verificar Pos Lista');
  if (!post.parameters.jsCode.includes(MARKER)) {
    let c = post.parameters.jsCode;
    c = once(c, "    'Resumo do pedido',", "    'Resumo para conferência da equipe',");
    c = once(c, "    ? 'Obrigado pela confirmacao! Vou cadastrar o pedido e avisaremos assim que o pedido sair para entrega.'\n    : 'Obrigado pela confirmacao! Vou cadastrar o pedido e deixar tudo encaminhado para retirada.';",
      "    ? 'Vou solicitar à equipe a confirmação da disponibilidade, do valor e do horário de entrega.'\n    : 'Vou solicitar à equipe a confirmação da disponibilidade, do valor e da retirada.';");
    const completion = `// ${MARKER}: no order exists until the existing team handoff is acknowledged.
const requestOrderReviewV1 = () => {
  const draft = activeState.orderDraft || {};
  if (!draft.productId || !draft.memory || draft.memory.includes(' / ')
      || !Number.isSafeInteger(draft.unitPriceCents) || draft.unitPriceCents <= 0) {
    activeState.step = 'awaiting_memory';
    delete activeState.selectedMemoryExactV1;
    activeState.selectedColor = '';
    activeState.orderDraft = { ...draft, productId:'', memory:'', price:'', unitPriceCents:0 };
    delete activeState.orderDraft.selectedCardInstallment;
    delete activeState.orderDraft.cardInstallmentOptions;
    return [{json:{...source,salesPostListHandled:true,salesPostListStep:activeState.step,
      output:'Preciso confirmar a versão e o valor corretos do aparelho antes de continuar. Qual memória você prefere?'}}];
  }
  activeState.step = 'awaiting_team_confirmation';
  activeState.updatedAt = new Date().toISOString();
  const summary = [draft.name, draft.memory, draft.color, 'Quantidade: '+(draft.quantity||1),
    'Valor à vista: '+draft.price, ...paymentLines(draft),
    draft.fulfillment === 'delivery' ? 'Entrega: confirmar horário com o cliente.' : 'Retirada: confirmar com o cliente.'].filter(Boolean).join(' | ');
  return [{json:{...source,salesPostListHandled:true,salesPostListStep:activeState.step,
    orderDraft:draft,salesOrderNeedsHandoff:true,requiresSpecialistHandoff:true,
    salesOrderSummary:summary,output:finalSummary()}}];
};
`;
    c = once(c, "if (activeState.step === 'awaiting_order_confirmation') {", completion+"\nif (activeState.step === 'awaiting_order_confirmation') {");
    const oldReturn = "return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: finalSummary() } }];";
    assert.equal(c.split(oldReturn).length-1, 2);
    c = c.replaceAll(oldReturn, 'return requestOrderReviewV1();');
    c = c.replaceAll("activeState.step = 'order_completed';", "activeState.step = 'awaiting_team_confirmation';");
    c = once(c, "if (activeState.step === 'order_completed') {\n  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: 'Seu pedido ja ficou encaminhado por aqui. Se precisar ajustar alguma coisa, me avisa.' } }];\n}",
      "if (['order_completed', 'awaiting_team_confirmation'].includes(activeState.step)) {\n  return requestOrderReviewV1();\n}");
    post.parameters.jsCode = c;
  }
  const attendant = node('Atendente - Horario');
  if (!attendant.parameters.jsCode.includes(MARKER)) {
    attendant.parameters.jsCode = once(attendant.parameters.jsCode, "const source = $json || {};", `const source = $json || {};
// ${MARKER}: preserve the reviewed summary; ordinary handoffs keep their wording.
if (source.salesOrderNeedsHandoff === true) return [{json:{...source,output:String(source.output || 'Vou solicitar à equipe a conferência dos dados da compra.')}}];`);
  }
  const handoff = node('Handoff - Persistir solicitado');
  if (!handoff.parameters.bodyParameters.parameters.some(p=>p.name==='contextSummary')) {
    handoff.parameters.bodyParameters.parameters.push({name:'contextSummary',value:"={{$('Atendente - Horario').first().json.salesOrderSummary || ''}}"});
  }
  const restore = node('Handoff - Retomar resposta solicitada');
  if (!restore.parameters.jsCode.includes(MARKER) || !restore.parameters.jsCode.includes('duplicateReceiptWordingV1')) {
    restore.parameters.jsCode = `// ${MARKER}: acknowledge only a real existing notification or deduplicated receipt.
const source = $('Atendente - Horario').first().json || {};
const notification = $json.adminNotification || {};
const confirmed = notification.notified === true || (notification.duplicate === true && notification.deliveryConfirmed === true && Boolean(notification.code));
let output = source.output;
if (source.salesOrderNeedsHandoff === true) {
  const duplicateReceiptWordingV1 = 'Nossa equipe já foi avisada sobre este atendimento. A disponibilidade, o valor e o horário ainda precisam de confirmação.';
  output = confirmed
    ? (notification.notified === true
      ? String(output || '').replace('Vou solicitar à equipe', 'Nossa equipe foi avisada para')
      : String(output || '').replace(/Vou solicitar à equipe[^.!?]*[.!?]?/u, duplicateReceiptWordingV1))
    : 'Conferi seus dados, mas ainda não consegui confirmar o aviso à equipe. A disponibilidade e o horário de entrega ainda precisam ser confirmados.';
}
return [{json:{...source,output,humanHandoffPaused:true,handoffRequested:true,
  ...(source.salesOrderNeedsHandoff === true ? {salesOrderHandoffConfirmed:confirmed} : {})}}];`;
  }
  const ifNode = (name,id,leftValue,position) => ({
    id,name,type:'n8n-nodes-base.if',typeVersion:2.2,position,
    parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},
      conditions:[{id:id+'-condition',leftValue,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},
  });
  const needsName='Vendas - Pedido precisa equipe?', persistedName='Handoff - Pedido ja persistido?';
  if (!w.nodes.some(n=>n.name===needsName)) {
    w.nodes.push(ifNode(needsName,'sales-order-team-check-v1','={{$json.salesOrderNeedsHandoff === true && $json.handoffRequested !== true}}',[3000,120]));
    w.nodes.push(ifNode(persistedName,'sales-order-persisted-check-v1','={{$json.salesOrderNeedsHandoff === true}}',[3400,120]));
    const rebase=w.connections['Estado Conversa - Rebase necessario?'];
    assert(rebase?.main?.[1]?.some(edge=>edge.node==='Dividir mensagens'),'Compose collection/rebase contract before order handoff');
    rebase.main[1]=rebase.main[1].map(edge=>edge.node==='Dividir mensagens'?{...edge,node:needsName}:edge);
    const edge=name=>({node:name,type:'main',index:0});
    w.connections[needsName]={main:[[edge('Atendente - Horario')],[edge('Dividir mensagens')]]};
    assert.deepEqual(w.connections['Handoff - Retomar resposta solicitada'].main,[[edge('Estado Conversa - Preparar')]]);
    w.connections['Handoff - Retomar resposta solicitada']={main:[[edge(persistedName)]]};
    w.connections[persistedName]={main:[[edge('Dividir mensagens')],[edge('Estado Conversa - Preparar')]]};
  }
  for(const n of [post,attendant,restore])new Function('$json','$','$getWorkflowStaticData',n.parameters.jsCode);
  return w;
}
module.exports={MARKER,patchWorkflow};
