'use strict';

// payjoy-print-after-offer-v1 (nó "WhatsApp - Preparar print PayJoy"), caso 558781215720 (23/11 12h18):
// o robô ofereceu o link (estado awaiting_link_confirmation), a cliente disse "Fiz um cadastro na pay joy",
// o robô pediu o print e ela mandou a imagem. O print só era lido com estado awaiting_result/approved,
// e o histórico ("pode me enviar um print") só valia sem estado nenhum. Resultado: "Recebi sua imagem…
// Ela é o resultado da análise da PayJoy?" e o fluxo parou.
// Agora: imagem até 24 h depois da oferta do link também é lida como print; e o histórico recente da PayJoy
// vale sempre que o estado não estiver ativo.
const MARK = 'payjoy-print-after-offer-v1';
const NODE = 'WhatsApp - Preparar print PayJoy';
const NODES = [NODE];
const OLD_ACTIVE = "const active=state && ['awaiting_result','approved'].includes(state.status)";
const NEW_ACTIVE = `// ${MARK}: depois da oferta do link (24 h) a imagem também é o print da análise.
const offeredV1=state?.status==='awaiting_link_confirmation'&&Number.isFinite(updated)&&updated>0&&now>=updated&&now-updated<86400000;
const active=state && (['awaiting_result','approved'].includes(state.status)||offeredV1)`;
const OLD_RECENT = 'const recent=!state&&';
const NEW_RECENT = 'const recent=!active&&';

function patchCode(code) {
  if (code.includes(MARK)) return code;
  for (const anchor of [OLD_ACTIVE, OLD_RECENT]) {
    if (code.split(anchor).length !== 2) throw new Error(`${MARK}: âncora não encontrada: ${anchor}`);
  }
  return code.replace(OLD_ACTIVE, () => NEW_ACTIVE).replace(OLD_RECENT, () => NEW_RECENT);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  if (!node) throw new Error(`${MARK}: nó ${NODE} não existe`);
  node.parameters.jsCode = patchCode(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchCode, patchWorkflow };
