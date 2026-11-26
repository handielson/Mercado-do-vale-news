'use strict';

// selected-item-question-v1 + card-interest-answer-v1 — conversas de 26/11:
// - 558781242854: depois do card do Redmi Note 17 4/128, "Aí não é o pro" virou buscar_produto ("Não encontrei esse
//   modelo" + lista completa) e "Quanto tem de ram" virou listar_catalogo (lista completa de novo).
//   Agora, com um aparelho escolhido no card (orderDraft do pós-lista), pergunta de RAM/memória/armazenamento ou de
//   outra versão ("pro", "plus", "max"…) é respondida sobre o próprio aparelho, com as outras memórias do mesmo
//   modelo que estavam na lista, sem reenviar a lista.
// - 558791545841: "Tem juros a maquineta?" + "Quero" (oferta PayJoy pendente) respondeu só o "Quero".
//   Agora pergunta de juros/taxa no cartão tem resposta fixa, na linha do que a equipe respondeu
//   ("temos o valor de à vista com desconto e no cartão sem desconto"); se havia oferta PayJoy pendente,
//   o aceite segue (link) ou a pergunta da PayJoy é refeita.
const MARK_ITEM = 'selected-item-question-v1';
const MARK_CARD = 'card-interest-answer-v1';
const RESOLVER = 'Resolver Acao de Conversacao';
const POS_LISTA = 'Vendas - Verificar Pos Lista';
const PAGAMENTO = 'Pagamento - Politica';
const CHANGED = [RESOLVER, POS_LISTA, PAGAMENTO];

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK_ITEM}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, () => replacement);
}

const RESOLVER_BLOCK = `// ${MARK_ITEM}: pergunta sobre o aparelho do card (RAM/memória ou outra versão) fica no pós-lista.
const selectedStateV1 = getActivePostList();
const selectedDraftV1 = selectedStateV1?.flow === 'sales_post_list' && selectedStateV1?.orderDraft?.productId && selectedStateV1?.orderDraft?.name
  && Array.isArray(selectedStateV1.options) && selectedStateV1.options.length ? selectedStateV1.orderDraft : null;
const selectedTextV1 = normalize(text);
const selectedFreshV1 = Boolean(selectedDraftV1) && Date.now() - (Date.parse(selectedStateV1.updatedAt || selectedStateV1.createdAt || '') || 0) <= 3 * 60 * 60 * 1000;
const selectedNameV1 = normalize(selectedDraftV1?.name || '');
const selectedMemoryAskV1 = /\\b(?:ram|memoria|memorias|armazenamento|giga|gigas|gb)\\b/.test(selectedTextV1)
  && !/\\b\\d{1,4}\\s*(?:gb|g|tb)\\b/.test(selectedTextV1) && !/\\b(?:celulares|lista|catalogo|opcoes|modelos)\\b/.test(selectedTextV1);
const selectedVersionV1 = (selectedTextV1.match(/\\b(pro|plus|max|ultra|lite)\\b/) || [])[1] || '';
const selectedOtherBrandV1 = /\\b(?:iphone|samsung|motorola|infinix|oukitel|realme|poco|redmi|xiaomi)\\b/.test(selectedTextV1)
  && !selectedNameV1.split(' ').filter((w) => w.length > 2).every((w) => selectedTextV1.includes(w));
const selectedVersionAskV1 = Boolean(selectedVersionV1) && !new RegExp('\\\\b' + selectedVersionV1 + '\\\\b').test(selectedNameV1)
  && !selectedOtherBrandV1 && selectedTextV1.split(' ').length <= 10;
const selectedItemQuestionV1 = selectedFreshV1 && (selectedVersionAskV1 || selectedMemoryAskV1)
  ? { acao: 'continuar_pedido', intencao: selectedVersionAskV1 ? 'pergunta_versao_item' : 'pergunta_memoria_item', versao: selectedVersionV1,
      confianca: 1, motivo: 'Pergunta sobre o aparelho mostrado no card (memória/versão).' }
  : null;
// ${MARK_CARD}: juros/taxa no cartão tem resposta fixa da loja.
const cardInterestTextV1 = normalize(text);
const cardInterestQuestionV1 = /\\b(?:juros|taxa|taxas|acrescimo)\\b/.test(cardInterestTextV1)
  && /\\b(?:cartao|credito|maquin\\w*|parcel\\w*|divid\\w*|divide|vezes|12x)\\b/.test(cardInterestTextV1)
  && !/\\b(?:payjoy|boleto|boletos)\\b/.test(cardInterestTextV1)
  ? { acao: 'responder_politica_pagamento', intencao: 'juros_cartao', confianca: 1, motivo: 'Pergunta de juros/taxa no cartão.' }
  : null;
`;

function patchResolver(code) {
  if (code.includes(MARK_ITEM)) return code;
  let next = once(code, 'const metaOrderStateV1 = source.metaAttendance ? getActivePostList() : null;',
    RESOLVER_BLOCK + 'const metaOrderStateV1 = source.metaAttendance ? getActivePostList() : null;', 'estado Meta');
  next = once(next, 'const decision = metaOrderPreferenceV1 || ', 'const decision = selectedItemQuestionV1 || cardInterestQuestionV1 || metaOrderPreferenceV1 || ', 'cadeia de decisão');
  return next;
}

const POS_BLOCK = `// ${MARK_ITEM}: RAM/memória ou outra versão do aparelho do card, respondida sem reenviar a lista.
let selectedQuestionIntentV1 = '';
let selectedQuestionVersionV1 = '';
try {
  const resolverV1 = $('Resolver Acao de Conversacao').first().json || {};
  selectedQuestionIntentV1 = String(resolverV1.conversationIntent || '');
  selectedQuestionVersionV1 = String(resolverV1.conversationDecision?.versao || '');
} catch (_) {}
if (['pergunta_memoria_item', 'pergunta_versao_item'].includes(selectedQuestionIntentV1) && activeState?.orderDraft?.name) {
  const draftQV1 = activeState.orderDraft;
  const baseQV1 = normalize(draftQV1.name);
  const configsQV1 = new Map();
  for (const option of (Array.isArray(activeState.options) ? activeState.options : [])) {
    if (normalize(option?.name) !== baseQV1) continue;
    for (const variant of variantsOf(option)) {
      const memory = String(variant.memory || option.memory || '').trim();
      if (!memory) continue;
      if (variant.stock !== undefined && variant.stock !== null && Number(variant.stock) <= 0) continue;
      const entry = configsQV1.get(memory) || { colors: [], price: String(variant.price || option.price || '') };
      if (variant.color && !entry.colors.includes(variant.color)) entry.colors.push(variant.color);
      configsQV1.set(memory, entry);
    }
  }
  const lineQV1 = ([memory, entry]) => '• ' + memory + (entry.colors.length ? ' (' + entry.colors.join(', ') + ')' : '') + (entry.price ? ' — ' + entry.price + ' no PIX' : '');
  const draftMemoryQV1 = String(draftQV1.memory || '');
  const partsQV1 = draftMemoryQV1.match(/(\\d+\\s*(?:GB|TB))\\s*\\/\\s*(\\d+\\s*(?:GB|TB))/i);
  const linesQV1 = [];
  if (selectedQuestionIntentV1 === 'pergunta_versao_item') {
    const versionQV1 = selectedQuestionVersionV1 ? ' ' + selectedQuestionVersionV1.charAt(0).toUpperCase() + selectedQuestionVersionV1.slice(1) : '';
    linesQV1.push('O ' + draftQV1.name + versionQV1 + ' não temos no momento. 😕');
    if (configsQV1.size) linesQV1.push('', 'Do ' + draftQV1.name + ' temos:', ...[...configsQV1.entries()].map(lineQV1));
  } else {
    linesQV1.push(partsQV1
      ? 'Esse ' + draftQV1.name + (draftQV1.color ? ' ' + draftQV1.color : '') + ' tem ' + partsQV1[1].replace(/\\s+/g, '') + ' de RAM e ' + partsQV1[2].replace(/\\s+/g, '') + ' de armazenamento.'
      : 'Esse ' + draftQV1.name + (draftMemoryQV1 ? ' é ' + draftMemoryQV1 : '') + '.');
    const othersQV1 = [...configsQV1.entries()].filter(([memory]) => memory !== draftMemoryQV1);
    if (othersQV1.length) linesQV1.push('', 'Também temos:', ...othersQV1.map(lineQV1));
  }
  linesQV1.push('', 'Qual você prefere? 😊');
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, needsPaymentOptionsLookup: false, salesPostListStep: activeState.step || '',
    selectedItemQuestionV1: selectedQuestionIntentV1, output: linesQV1.join(lineBreak) } }];
}
`;
const POS_ANCHOR = "const text = String(source.conversation || source.text || '').trim();\nconst normalized = normalize(text);\n";

function patchPosLista(code) {
  if (code.includes(MARK_ITEM)) return code;
  return once(code, POS_ANCHOR, POS_ANCHOR + POS_BLOCK, 'texto do pós-lista');
}

const LINK_TEXT = "'Claro! 😊 Você faz a análise diretamente com a PayJoy e preenche seus dados no site deles, pelo link abaixo: 👇||' + officialLink + '|||Quando sua análise for aprovada, a PayJoy mostra o valor aprovado e o percentual de entrada. 😊|||Envie um print desse resultado ou me informe o valor aprovado e o percentual de entrada. Com essas informações, calculo quanto você precisa ter de entrada sobre o valor aprovado pela PayJoy.||Se a página mostrar outra loja, fale comigo antes de prosseguir.'";
const CARD_BLOCK = `// ${MARK_CARD}: resposta da equipe — à vista com desconto, cartão sem desconto.
if (String(source.conversationIntent || '') === 'juros_cartao') {
  output = 'No cartão o valor é sem desconto. 💳||O preço à vista (Pix ou dinheiro) já vem com desconto e, no cartão de crédito, vale o valor sem o desconto, em até 12x. O pagamento no cartão é presencial.';
  if (payjoyPendingV5 && payjoyAcceptV5 && officialLink && !approved && !denied) {
    remember('awaiting_result');
    output += '|||' + ${LINK_TEXT};
    payjoyFollowupKind = 'analysis_check';
  } else if (payjoyPendingV5 && !approved && !denied) {
    output += '|||E sobre a PayJoy: quer que eu envie o link para você fazer a análise? 😊';
  }
} else `;

function patchPagamento(code) {
  if (code.includes(MARK_CARD)) return code;
  return once(code, '\nif (usedPhonePolicyV529) {\n', '\n' + CARD_BLOCK + 'if (usedPhonePolicyV529) {\n', 'início da política');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  for (const node of next.nodes) {
    if (node.name === RESOLVER) node.parameters.jsCode = patchResolver(node.parameters.jsCode);
    if (node.name === POS_LISTA) node.parameters.jsCode = patchPosLista(node.parameters.jsCode);
    if (node.name === PAGAMENTO) node.parameters.jsCode = patchPagamento(node.parameters.jsCode);
  }
  return next;
}

function assertExpectedGraph(before, after) {
  if (JSON.stringify(before.connections) !== JSON.stringify(after.connections)) throw new Error(`${MARK_ITEM}: ligações mudaram`);
  if (before.nodes.length !== after.nodes.length) throw new Error(`${MARK_ITEM}: quantidade de nós mudou`);
}

module.exports = { MARK_ITEM, MARK_CARD, RESOLVER, POS_LISTA, PAGAMENTO, CHANGED, ADDED: [], APPLY: RESOLVER, patchResolver, patchPosLista, patchPagamento, patchWorkflow, assertExpectedGraph };
