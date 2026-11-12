'use strict';

// Conversa real de 12/11/2026: "Qual celular mais em conta que você tem aí?" virou busca por texto
// ("celular mais em conta que") → search_inconclusive → o robô respondeu duas vezes "não consegui confirmar".
// Causa: o detector de "celular mais barato" (cheapest-promo-accessory-v1) exige que TODAS as palavras
// sejam de celular/preço; palavras de ligação comuns ("que", "aqui", "hoje", "vcs"…) quebravam o pedido.
// Correção (só no Code node "Vendas - Preparar Busca", sem mudar o grafo): essas palavras de ligação e
// valores ("até 1000") passam a ser aceitos no pedido genérico. A resposta continua sendo a lista padrão
// ("📱 Celulares mais em conta", mesmo formato da lista de celulares).

const MARK = 'cheapest-intent-fillers-v1';
const NODES = ['Vendas - Preparar Busca'];

const FILLERS = ['que', 'q', 'aqui', 'hoje', 'agora', 'ja', 'e', 'ou', 'com', 'loja', 'ter', 'tiver', 'tiverem', 'tenha', 'tenham',
  'tem', 'temos', 'esta', 'estao', 'sao', 'seria', 'ser', 'mesmo', 'bem', 'muito', 'ainda', 'la', 'ate', 'abaixo', 'menos', 'r', 'reais',
  'vcs', 'voces', 'vc', 'disponiveis', 'disponivel', 'estoque', 'vende', 'vendem', 'tipo', 'meu', 'minha', 'pro', 'filho', 'filha',
  'mae', 'pai', 'presente', 'pode', 'poderia', 'consegue', 'gostaria', 'saber', 'por', 'favor', 'tudo', 'certo', 'blz', 'beleza'];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

function patchPreparar(code) {
  if (code.includes(MARK)) return code;
  code = once(code,
    "const cheapIntentV1 = /",
    "// " + MARK + ": palavras de ligação e valores não descaracterizam o pedido genérico de celular barato.\n"
    + "const cheapFillerWordsV2 = new Set(" + JSON.stringify(FILLERS) + ");\n"
    + "const cheapIntentV1 = /",
    'Preparar Busca: antes do detector');
  code = once(code,
    "  && meaningfulTokens.every((token) => genericPhoneWords.has(token) || priceIntentWordsV1.has(token))\n",
    "  && meaningfulTokens.every((token) => genericPhoneWords.has(token) || priceIntentWordsV1.has(token)\n"
    + "    || cheapFillerWordsV2.has(token) || /^\\d+(?:[.,]\\d+)?$/.test(token))\n",
    'Preparar Busca: regra do pedido genérico');
  return code;
}

function patchWorkflow(workflow) {
  const next = structuredClone(workflow);
  const node = next.nodes.find((item) => item.name === NODES[0]);
  if (!node) throw new Error('Nó não encontrado: ' + NODES[0]);
  node.parameters.jsCode = patchPreparar(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODES, FILLERS, patchWorkflow };
