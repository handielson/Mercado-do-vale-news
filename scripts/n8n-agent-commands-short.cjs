'use strict';

// agent-commands-v2: além de "agentes aprovar 17", o admin pode mandar "17 aprovar", "aprovar 17",
// "16 reprovar, motivo…" (22/11: "16 reprovar, se o cliente pediu celular não vamos mostrar capas" foi parar na IA).
// Só troca a expressão do agent-commands-v1 no nó "Controle Bot - Comando Admin"; a API (bot-monitor-commands-v2) interpreta.
const MARK = 'agent-commands-v2';
const NODE = 'Controle Bot - Comando Admin';
const NODES = [NODE];
const OLD = "const agentMatchV1 = String(source.conversation || source.text || '').trim().match(/^agentes?(?:\\s+(?:status|pausar|reativar|rodar|aprovar|recusar|ajuda)(?:\\s+[\\s\\S]{1,80})?)?\\s*$/i);";
const DEC = '(?:aprovar|aprova|aprovo|aprovado|aprovada|recusar|recusa|recuso|recusado|recusada|reprovar|reprova|reprovo|reprovado|reprovada)';
const NEW = `// ${MARK}: formas curtas ("17 aprovar", "aprovar 17", "16 reprovar, motivo").\n`
  + "const agentTextV2 = String(source.conversation || source.text || '').trim();\n"
  + "const agentMatchV1 = agentTextV2.match(/^agentes?(?:\\s+(?:status|pausar|reativar|rodar|aprovar|recusar|reprovar|ajuda)(?:\\s+[\\s\\S]{1,300})?)?\\s*$/i)\n"
  + `  || agentTextV2.match(/^#?\\d{1,4}\\s*[-:,.]?\\s*${DEC}\\b[\\s,.:;-]*[\\s\\S]{0,300}$/i)\n`
  + `  || agentTextV2.match(/^${DEC}\\s*#?\\d{1,4}\\b[\\s,.:;-]*[\\s\\S]{0,300}$/i);`;

function patchComando(code) {
  if (code.includes(MARK)) return code;
  if (code.split(OLD).length !== 2) throw new Error(`${MARK}: expressão do agent-commands-v1 não encontrada`);
  return code.replace(OLD, () => NEW);
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((item) => item.name === NODE);
  node.parameters.jsCode = patchComando(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchComando };
