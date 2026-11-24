'use strict';

// sales-focus-product-v1 (nó "Vendas - Contexto Produtos"): "celular em foco" do robô.
// O dono escolhe UM produto pela estrela no card do produto (painel); a API marca esse produto com bot_focus:true na
// lista que o robô consulta (bot-focus-product-v1). Quando ele está na lista enviada, a pergunta final
// "Qual modelo voce quer ver em mais detalhes? 😊" vira a indicação desse aparelho, com o preço no mesmo padrão da lista.
// Sem estoque ele não vem na lista, e a pergunta normal continua. PayJoy e pedido de fotos não mudam.
const MARK = 'sales-focus-product-v1';
const NODE = 'Vendas - Contexto Produtos';
const NODES = [NODE];
const ANCHOR = "const directPriceQuestionText = normalize(base.conversation || base.productSearchOriginalText || '');";
const BLOCK = `// ${MARK}: a lista de celulares fecha com a indicação do celular em foco (estrela no painel).
const focusIdsV1 = new Set((Array.isArray(rows) ? rows : []).filter((row) => row && row.bot_focus === true).map((row) => String(row.id)));
const focusClosingV1 = 'Qual modelo voce quer ver em mais detalhes? 😊';
if (focusIdsV1.size && products.length > 1 && !base.payjoyApprovedListV1 && base.photoCatalogRequestedV1 !== true
  && quoteMessages.length && quoteMessages[quoteMessages.length - 1] === focusClosingV1) {
  const idsOfV1 = (item) => [item?.id, ...(item?.productIds || [])].filter(Boolean).map(String);
  const focusIndexV1 = products.findIndex((item) => idsOfV1(item).some((id) => focusIdsV1.has(id))
    || (item.memoryOptions || []).some((option) => idsOfV1(option).some((id) => focusIdsV1.has(id))));
  if (focusIndexV1 >= 0) {
    const focusProductV1 = products[focusIndexV1];
    const focusOptionV1 = (focusProductV1.memoryOptions || []).find((option) => idsOfV1(option).some((id) => focusIdsV1.has(id))) || focusProductV1;
    const focusLinesV1 = ['⭐ *Nossa indicação:* ' + (focusIndexV1 + 1) + '. ' + focusProductV1.name + (focusOptionV1.memory ? ' ' + focusOptionV1.memory : ''),
      pixPriceLineV826(focusOptionV1)];
    if (focusOptionV1.card) focusLinesV1.push('💳 Cartão: 12x de ' + focusOptionV1.card.installment + ' (' + focusOptionV1.card.total + ')');
    focusLinesV1.push('Quer ver esse em detalhes ou prefere outro da lista? 😊');
    quoteMessages[quoteMessages.length - 1] = focusLinesV1.join('[[BR]]');
  }
}
`;

function patchCode(code) {
  if (code.includes(MARK)) return code;
  if (code.split(ANCHOR).length !== 2) throw new Error(`${MARK}: âncora não encontrada`);
  if (!code.includes('let quoteMessages = buildQuoteMessages();')) throw new Error(`${MARK}: quoteMessages não encontrado`);
  return code.replace(ANCHOR, () => BLOCK + ANCHOR);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${NODE}`);
  node.parameters.jsCode = patchCode(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchCode, patchWorkflow };
