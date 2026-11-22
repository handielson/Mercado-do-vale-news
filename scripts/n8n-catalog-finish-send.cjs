'use strict';

// catalog-finish-send-v1 (nó "Controle Bot - Aplicar mensagem atual"), caso 557488087672 (22/11 16h44):
// a lista de celulares (11 mensagens) parou na 2ª porque o cliente mandou "?" e depois "Por favor" enquanto ela saía.
// Agora: mensagem de catálogo continua saindo se a mensagem nova do cliente é curta (até 25 letras: "?", "por favor",
// "oi", "cadê", "manda") e não é cancelamento. Pedido novo de verdade (texto maior) continua interrompendo.
const MARK = 'catalog-finish-send-v1';
const NODE = 'Controle Bot - Aplicar mensagem atual';
const NODES = [NODE];
const OLD = '    return isPhoneCatalogV344 && continuesPhoneShoppingV344 && !cancelsV344;';
const NEW = `    // ${MARK}: lista em andamento não para por "?", "por favor", "cadê"…
    const catalogItemV1 = originalV344.catalogDeliveryCandidateV1 === true || /🏷️|💰 R\\$/.test(String(originalV344.message || originalV344.caption || ''));
    if (catalogItemV1 && !cancelsV344 && latestTextV344.replace(/[^a-z0-9]/g, '').length <= 25) return true;
${OLD}`;

function patchAtual(code) {
  if (code.includes(MARK)) return code;
  if (code.split(OLD).length !== 2) throw new Error(`${MARK}: retorno final não encontrado`);
  return code.replace(OLD, () => NEW);
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchAtual(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchAtual };
