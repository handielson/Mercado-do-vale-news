'use strict';
// nfc-emoji-v1 (nó "Vendas - Contexto Produtos"): "📲 NFC: Sim/Não" na lista de celulares e na indicação do celular em foco.
const MARK = 'nfc-emoji-v1';
const NODE = 'Vendas - Contexto Produtos';
const NODES = [NODE];
const OLD = 'const catalogNfcLineV1 = product => ({ sim: "NFC: Sim", nao: "NFC: Não" })[product.catalogNfcV1] || "";';
const NEW = `const catalogNfcLineV1 = product => ({ sim: "📲 NFC: Sim", nao: "📲 NFC: Não" })[product.catalogNfcV1] || ""; // ${MARK}`;
function patchCode(code) {
  if (code.includes(MARK)) return code;
  if (code.split(OLD).length !== 2) throw new Error(`${MARK}: âncora não encontrada`);
  return code.replace(OLD, () => NEW);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchCode(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchCode, patchWorkflow };
