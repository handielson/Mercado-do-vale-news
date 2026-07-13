const assert = require('node:assert/strict');
const { patchWorkflow } = require('./n8n-fix-persistent-handoff-context.cjs');

const nodes = [
  { name: 'Controle Bot - Aplicar Controle', parameters: { jsCode: 'old' } },
  { name: 'Handoff - Registrar manual', parameters: { jsCode: 'old' } },
  { name: 'Handoff - Verificar pausa', parameters: { jsCode: 'old' } },
  { name: 'Handoff ativo?', parameters: {} },
  { name: 'Dividir mensagens', parameters: { jsCode: "const shouldInviteName = Boolean(remoteJid) && !savedName;" } },
  { name: 'Agente Inicial - Classificador', parameters: { text: "={{'Mensagem: ' + $json.conversation}}" } },
  { name: 'Agente Geral - Atendimento', parameters: { text: "={{'Mensagem: ' + $json.conversation}}" } },
  { name: 'Especialista - Vendas', parameters: { text: "={{'Mensagem: ' + $json.conversation}}" } },
];
const connections = {
  'Handoff - Verificar pausa': { main: [[{ node: 'Handoff ativo?', type: 'main', index: 0 }]] },
  'Handoff ativo?': { main: [[], [{ node: 'Contato - Preparar', type: 'main', index: 0 }]] },
};

patchWorkflow(nodes, connections);

assert.equal(nodes.some((node) => node.name === 'Handoff - Verificar pausa'), false);
assert.equal(nodes.some((node) => node.name === 'Handoff ativo?'), false);
assert.equal(nodes.some((node) => node.name === 'Handoff - Persistir manual'), true);
assert.deepEqual(connections['Controle Bot - Bloqueado?'].main[1][0].node, 'Contato - Preparar');
assert.deepEqual(connections['Handoff - Registrar manual'].main[0][0].node, 'Handoff - Persistir manual');
assert.match(nodes.find((node) => node.name === 'Controle Bot - Aplicar Controle').parameters.jsCode, /control\.blocked \|\| baseOutput\.humanHandoffPaused/);
assert.match(nodes.find((node) => node.name === 'Dividir mensagens').parameters.jsCode, /alreadyInvitedInHistory/);
for (const name of ['Agente Inicial - Classificador', 'Agente Geral - Atendimento', 'Especialista - Vendas']) {
  assert.match(nodes.find((node) => node.name === name).parameters.text, /Historico recente da conversa/);
}

console.log('n8n persistent handoff and context graph checks passed');
