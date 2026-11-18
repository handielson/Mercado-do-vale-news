'use strict';

// conversation-state-rebase-revision-v1 (18/11/2026): depois de um conflito de revisão (outra mensagem do mesmo
// cliente gravou o estado antes), "Estado Conversa - Restaurar" refaz a resposta com a revisão nova. O
// "Estado Conversa - Preparar" juntava { ...contexto da retentativa, ...$json }, e especialistas que reconstroem
// os dados a partir do "Parse Classificacao" (ex.: "Loja - Localizacao") devolviam a revisão VELHA, que
// sobrescrevia a nova. Resultado: as 3 tentativas eram recusadas e a resposta era descartada sem enviar nada.
// Agora, na retentativa, revisão, contador, marca de rebase e controle vêm sempre do contexto da retentativa.
// Grafo do workflow não muda; só o nó "Estado Conversa - Preparar".

const MARK = 'conversation-state-rebase-revision-v1';
const NODE = 'Estado Conversa - Preparar';
const NODES = [NODE];
const ANCHOR = 'const source = { ...persistenceContextV1, ...($json || {}) };';
const ADDITION = `
// ${MARK}: na retentativa, a revisão nova vence a cópia velha que o especialista possa devolver.
if (persistenceContextV1.conversationStateRebase === true) {
  for (const key of ['conversationStateRevision', 'conversationStateRetryCount', 'conversationStateRebase', 'n8nBotControl']) {
    if (persistenceContextV1[key] !== undefined) source[key] = persistenceContextV1[key];
  }
}`;

function patchCode(code) {
  if (code.includes(MARK)) return code;
  const count = code.split(ANCHOR).length - 1;
  if (count !== 1) throw new Error(`${NODE}: âncora encontrada ${count} vezes`);
  return code.replace(ANCHOR, () => ANCHOR + ADDITION);
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find(item => item.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Nó ausente: ${NODE}`);
  node.parameters.jsCode = patchCode(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchCode };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
