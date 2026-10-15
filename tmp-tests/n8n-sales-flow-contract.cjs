'use strict';
// One composition owner; individual transforms remain separately testable.
const assert=require('node:assert/strict');
const transforms=[require('./n8n-sales-variant-contract.cjs'),require('./n8n-sales-conversation-contract.cjs'),require('./n8n-sales-order-contract.cjs')];
const SCOPED_NODES=new Set(['Dados','Vendas - Contexto Produtos','Vendas - Verificar Pos Lista','Vendas - Compor Resposta IA',
  'Agente Inicial - Classificador','Parse Classificacao','Resolver Acao de Conversacao',
  'Estado Conversa - Preparar','Estado Conversa - Persistir','Estado Conversa - Restaurar',
  'Estado Conversa - Rebase necessario?','Atendente - Horario','Handoff - Persistir solicitado',
  'Handoff - Retomar resposta solicitada','Vendas - Pedido precisa equipe?','Handoff - Pedido ja persistido?']);
function patchWorkflow(input){
  const result=transforms.reduce((w,transform)=>transform.patchWorkflow(w),input);
  for(const original of input.nodes)if(!SCOPED_NODES.has(original.name))assert.deepEqual(result.nodes.find(n=>n.name===original.name),original,'Unscoped node changed: '+original.name);
  const graphScope=new Set(['Estado Conversa - Restaurar','Estado Conversa - Rebase necessario?',
    'Handoff - Retomar resposta solicitada','Vendas - Pedido precisa equipe?','Handoff - Pedido ja persistido?']);
  for(const name of new Set([...Object.keys(input.connections),...Object.keys(result.connections)]))
    if(!graphScope.has(name))assert.deepEqual(result.connections[name],input.connections[name],'Unscoped connections changed: '+name);
  for(const node of result.nodes)if(node.parameters?.jsCode)new Function('$json','$input','$','$getWorkflowStaticData','$runIndex',node.parameters.jsCode);
  return result;
}
module.exports={patchWorkflow,SCOPED_NODES};
