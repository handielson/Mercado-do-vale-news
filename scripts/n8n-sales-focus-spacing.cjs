'use strict';

// sales-focus-product-v3 (nó "Vendas - Contexto Produtos"): linha em branco entre os preços (Pix/12x) e as
// características (NFC, cores, ✨) na indicação do celular em foco. Pedido do Handielson (24/11 15:57).
const MARK = 'sales-focus-product-v3';
const NODE = 'Vendas - Contexto Produtos';
const NODES = [NODE];
const CARD = "    if (focusOptionV1.card) focusLinesV1.push('💳 Cartão: 12x de ' + focusOptionV1.card.installment + ' (' + focusOptionV1.card.total + ')');\n    if (catalogNfcLineV1(focusOptionV1))";
const JOIN = "    if (focusFeaturesV2) focusLinesV1.push(focusFeaturesV2);\n    quoteMessages[quoteMessages.length - 1] = focusLinesV1.join('[[BR]]');";

function patchCode(code) {
  if (code.includes(MARK)) return code;
  if (!code.includes('sales-focus-product-v2') && !code.includes('focusTitleV2')) throw new Error(`${MARK}: precisa da v2`);
  for (const a of [CARD, JOIN]) if (code.split(a).length !== 2) throw new Error(`${MARK}: âncora não encontrada`);
  return code
    .replace(CARD, () => CARD.replace("\n    if (catalogNfcLineV1(focusOptionV1))", `\n    const focusPriceEndV3 = focusLinesV1.length; // ${MARK}\n    if (catalogNfcLineV1(focusOptionV1))`))
    .replace(JOIN, () => "    if (focusFeaturesV2) focusLinesV1.push(focusFeaturesV2);\n    if (focusLinesV1.length > focusPriceEndV3) focusLinesV1.splice(focusPriceEndV3, 0, '');\n    quoteMessages[quoteMessages.length - 1] = focusLinesV1.join('[[BR]]');");
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchCode(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchCode, patchWorkflow };
