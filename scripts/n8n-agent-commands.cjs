'use strict';

// agent-commands-v1 (21/11/2026, v1.2.881) — o admin fala com os agentes do servidor de casa pelo WhatsApp:
// "agentes", "agentes pausar alertas", "agentes aprovar 3"... No nó "Controle Bot - Comando Admin" a mensagem
// do admin que começa com "agentes" passa a contar como comando admin (vai para /n8n-bot/admin-command, que põe
// na fila dos agentes e responde). Só muda esse Code node; o grafo fica igual. Cliente comum não é afetado.

const MARK = 'agent-commands-v1';
const NODE = 'Controle Bot - Comando Admin';
const NODES = [NODE];
const AGENT_RE = '/^agentes?(?:\\s+(?:status|pausar|reativar|rodar|aprovar|recusar|ajuda)(?:\\s+[\\s\\S]{1,80})?)?\\s*$/i';

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

function patchComando(code) {
  if (code.includes(MARK)) return code;
  let next = once(code,
    "const normalizeTarget = (value) => {",
    `// ${MARK}: "agentes ..." do admin vai para os agentes do servidor de casa.\n`
    + `const agentMatchV1 = String(source.conversation || source.text || '').trim().match(${AGENT_RE});\n`
    + "const normalizeTarget = (value) => {",
    'normalizeTarget');
  next = once(next,
    "n8nBotAdminCommand: Boolean(isAdmin && ((match && (!match[2] || target.remoteJid)) || relayMatchV373)),",
    "n8nBotAdminCommand: Boolean(isAdmin && ((match && (!match[2] || target.remoteJid)) || relayMatchV373 || agentMatchV1)),",
    'n8nBotAdminCommand');
  return next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((item) => item.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${NODE}`);
  node.parameters.jsCode = patchComando(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchComando };
