'use strict';

const assert = require('node:assert/strict');

const MARKER = 'missing-prices-sequence-v1';
const NAMES = [
  'Controle Bot - Aplicar mensagem atual',
  'Vendas - Preparar Busca',
  'Vendas - Contexto Produtos',
  'Resolver Acao de Conversacao',
  'Handoff - Registrar bot enviado',
  'Vendas - Verificar Pos Lista',
  'Dividir mensagens',
];

function replaceOnce(code, oldText, newText) {
  assert.equal(code.split(oldText).length, 2, `Missing or ambiguous anchor: ${oldText.slice(0, 90)}`);
  return code.replace(oldText, newText);
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = (name) => {
    const matches = workflow.nodes.filter((item) => item.name === name);
    assert.equal(matches.length, 1, `Expected one node named ${name}`);
    return matches[0];
  };
  if (NAMES.every((name) => node(name).parameters.jsCode.includes(MARKER))) return workflow;

  {
    const target = node(NAMES[0]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      'const continuesPhoneShoppingV344 = /\\b(?:foto|fotos|imagem|imagens|preco|precos|valor|valores|celular|smartphone|redmi|xiaomi|poco|realme|iphone|samsung|note)\\b/.test(latestTextV344);',
      `// ${MARKER}: a shorter follow-up catalog question is still the same phone-shopping request.\n` +
      'const continuesPhoneShoppingV344 = /\\b(?:foto|fotos|imagem|imagens|preco|precos|valor|valores|celular|celulares|smartphone|smartphones|modelo|modelos|lista|catalogo|opcoes|redmi|xiaomi|poco|realme|iphone|samsung|note)\\b/.test(latestTextV344)\n' +
      '      || /\\bquais?\\b.{0,30}\\b(?:voce|vc|vcs)?\\s*tem\\b/.test(latestTextV344);');
    target.parameters.jsCode = code;
  }

  {
    const target = node(NAMES[1]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      "  const ram = new Set();\n  const storage = new Set();",
      `  // ${MARKER}: normalize spoken Portuguese units before the existing RAM/storage parser.\n` +
      "  working = working.replace(/\\b(\\d{1,4})\\s*gigas?\\b/g, '$1gb');\n" +
      '  const ram = new Set();\n  const storage = new Set();');
    code = replaceOnce(code,
      '  collect(/\\b(\\d{1,4})\\s*(gb|g|tb|t)\\s*(?:de\\s*)?(?:armazenamento|memoria\\s+interna|storage)\\b/gi, storage);',
      `  // ${MARKER}: "128 de armazenamento" supplies a storage unit in phone context.\n` +
      "  working = working.replace(/\\b(\\d{2,4})\\s+de\\s+(?:armazenamento|memoria\\s+interna|storage)\\b/gi, (matched, value) => {\n" +
      "    const storageGb = capacityToGb(value, 'gb');\n" +
      "    if (storageGb >= 32) storage.add(storageGb);\n" +
      "    return mask(matched);\n" +
      '  });\n' +
      '  collect(/\\b(\\d{1,4})\\s*(gb|g|tb|t)\\s*(?:de\\s*)?(?:armazenamento|memoria\\s+interna|storage)\\b/gi, storage);');
    code = replaceOnce(code,
      'const accessoryRequest = accessoryRequestWords.some((word) => normalized.includes(word));',
      `// ${MARKER}: "telefone" contains "fone" as a substring, but is not an accessory.\n` +
      "const accessoryRequest = accessoryRequestWords.some((word) => new RegExp('\\\\b' + word + '\\\\b').test(normalized));");
    target.parameters.jsCode = code;
  }

  {
    const target = node(NAMES[2]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      "    return Boolean(state\n      && state.flow === 'sales_post_list'\n      && state.step === 'awaiting_product_choice'\n      && new Date(state.expiresAt || 0).getTime() > Date.now());",
      `    // ${MARKER}: preparing a list before the send is not evidence the customer saw it.\n` +
      "    const currentInboundId = String(base.messageId || base.inboundWaMessageId || '').trim();\n" +
      "    const preparedInboundId = String(state?.preparedForInboundWaMessageId || '').trim();\n" +
      "    const catalogSent = Boolean(preparedInboundId && staticData.catalogDeliveryAcceptedV1?.[remoteJid]?.[preparedInboundId]);\n" +
      "    const concurrentCatalogSent = base.conversationStateRebase === true && Object.entries(staticData.catalogDeliveryAcceptedV1?.[remoteJid] || {})\n" +
      "      .some(([id, acceptedAt]) => id !== currentInboundId && Number(acceptedAt) >= new Date(state?.createdAt || 0).getTime());\n" +
      "    return Boolean(state && state.flow === 'sales_post_list'\n" +
      "      && state.step === 'awaiting_product_choice'\n" +
      "      && new Date(state.expiresAt || 0).getTime() > Date.now()\n" +
      "      && (catalogSent || concurrentCatalogSent));");
    code = replaceOnce(code,
      "      && !input.explicitCatalogRequest)",
      "      && (!input.explicitCatalogRequest || input.conversationStateRebase === true))");
    code = replaceOnce(code,
      '  return Boolean(input.catalogAlreadyPresented && (\n    input.unavailableRequestedDevice',
      '  return Boolean(input.catalogAlreadyPresented && (\n    input.confirmedPriorCatalog || input.unavailableRequestedDevice');
    code = replaceOnce(code,
      '  explicitCatalogRequest: explicitlyRequestsCatalogV342,',
      `  explicitCatalogRequest: explicitlyRequestsCatalogV342,
  conversationStateRebase: base.conversationStateRebase === true,
  confirmedPriorCatalog: base.conversationStateRebase === true
    && /^(?:quais? (?:voce |vc |vcs )?tem|me (?:manda|envia) (?:a )?lista)[?!. ]*$/.test(normalize(base.conversation || ''))
    && Object.entries($getWorkflowStaticData('global').catalogDeliveryAcceptedV1?.[String(base.remoteJid || '')] || {})
    .some(([id, acceptedAt]) => id !== String(base.messageId || base.inboundWaMessageId || '')
      && Number(acceptedAt) >= new Date($getWorkflowStaticData('global').salesPostList?.[String(base.remoteJid || '')]?.createdAt || 0).getTime()),`);
    code = replaceOnce(code,
      "      flow: 'sales_post_list',\n      step: 'awaiting_product_choice',",
      "      flow: 'sales_post_list',\n      step: 'awaiting_product_choice',\n      preparedForInboundWaMessageId: String(base.messageId || base.inboundWaMessageId || '').trim(),");
    code = replaceOnce(code,
      '      options: products.map((product, index) => ({\n        number: index + 1,\n        name: product.name,',
      '      options: products.map((product, index) => ({\n        number: index + 1,\n        name: product.name,\n        featureSummary: buildFeatureSummaryV365(product),');
    target.parameters.jsCode = code;
  }

  {
    const target = node(NAMES[3]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      'const decision = birthdayCorrectionV372 || deterministicStoreVisitV638 ||',
      `// ${MARKER}: a Pix lowest-price follow-up is a product quote question, not a payment-method list.\n` +
      "const pixLowestPriceV1 = /\\b(?:pix)\\b/.test(normalize(text)) && /\\b(?:menor\\s+valor|menor\\s+preco|melhor\\s+valor|melhor\\s+preco|desconto)\\b/.test(normalize(text));\n" +
      "const contextPriceOnlyV1 = /^(?:qual(?:is)?\\s+(?:os\\s+)?(?:valores?|precos?)|valores?|precos?)\\s*$/.test(normalize(text));\n" +
      "const contextualPricesV1 = (pixLowestPriceV1 || contextPriceOnlyV1) && Boolean(getActivePostList()?.options?.length);\n" +
      "const contextualPriceDecisionV1 = contextualPricesV1\n" +
      "  ? { acao: 'calcular_parcelamento', intencao: pixLowestPriceV1 ? 'negociacao_preco_pix' : 'preco_catalogo', confianca: 1, motivo: 'Usar a rota pos_lista para cotar os modelos e configuracoes em contexto.' } : null;\n" +
      "const pixPriceWithoutCatalogV1 = pixLowestPriceV1 && !contextualPricesV1\n" +
      "  ? { acao: 'perguntar_esclarecimento', intencao: 'negociacao_preco_pix_sem_contexto', confianca: 1, motivo: 'Pedir o modelo sem inventar cotacao ou desconto.' } : null;\n" +
      'const decision = birthdayCorrectionV372 || deterministicStoreVisitV638 || contextualPriceDecisionV1 || pixPriceWithoutCatalogV1 ||');
    code = replaceOnce(code,
      'aiResponseGuidance: metaSmartphoneIntroGuidanceV167 || fiscalDocumentGuidanceV164 || String($json.aiResponseGuidance || \'\'),',
      "aiResponseGuidance: pixLowestPriceV1 ? (contextualPricesV1 ? 'O cliente perguntou pelo menor valor no Pix dos modelos mencionados imediatamente antes. O no de pos-lista deve citar os valores cadastrados e identificar o menor. Nao apresente formas gerais de pagamento nem invente desconto adicional.' : 'Pergunte qual modelo o cliente deseja cotar no Pix. Nao cite valores ou desconto sem consulta ao cadastro e nao liste formas gerais de pagamento.') : metaSmartphoneIntroGuidanceV167 || fiscalDocumentGuidanceV164 || String($json.aiResponseGuidance || ''),");
    target.parameters.jsCode = code;
  }

  {
    const target = node(NAMES[4]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      'return items;',
      `// ${MARKER}: only the Evolution response after the final catalog message confirms presentation.\n` +
      "let sentItem = {};\n" +
      "try { sentItem = $('Loop - Enviar mensagens em ordem').first().json || {}; } catch (error) {}\n" +
      "const jid = String(sentItem.remoteJid || '');\n" +
      "const inboundId = String(sentItem.inboundWaMessageId || '');\n" +
      "const state = staticData.salesPostList?.[jid];\n" +
      "const accepted = items.some((item) => Boolean(item?.json?.key?.id || item?.json?.message?.key?.id || item?.json?.data?.key?.id || item?.json?.response?.key?.id || item?.json?.response?.message?.key?.id || item?.json?.id || item?.json?.messageId));\n" +
      "if (accepted && jid && inboundId && state?.flow === 'sales_post_list'\n" +
      "  && sentItem.catalogDeliveryCandidateV1 === true\n" +
      "  && Number(sentItem.messageIndex) === Number(sentItem.totalMessages)) {\n" +
      "  staticData.catalogDeliveryAcceptedV1 = staticData.catalogDeliveryAcceptedV1 || {};\n" +
      "  staticData.catalogDeliveryAcceptedV1[jid] = { [inboundId]: now };\n" +
      "}\n" +
      'return items;');
    target.parameters.jsCode = code;
  }

  {
    const target = node(NAMES[5]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      'if (promotionQuestion()) {',
      `// ${MARKER}: quote the selected catalog configurations instead of sending generic payment policy.\n` +
      "const asksPriceOnlyV1 = /^(?:qual(?:is)?\\s+(?:os\\s+)?(?:valores?|precos?)|valores?|precos?)\\s*[?!.]*$/.test(normalized);\n" +
      "const asksLowestPixV1 = /\\bpix\\b/.test(normalized) && /\\b(?:menor\\s+valor|menor\\s+preco|melhor\\s+valor|melhor\\s+preco|desconto)\\b/.test(normalized);\n" +
      "if ((asksPriceOnlyV1 || asksLowestPixV1) && activeState?.flow === 'sales_post_list') {\n" +
      "  const options = Array.isArray(activeState.options) ? activeState.options : [];\n" +
      "  const recentOutbound = [...(Array.isArray(source.recentMessages) ? source.recentMessages : [])].reverse()\n" +
      "    .find((row) => String(row?.direction || '') === 'outbound' && /\\b(?:redmi|poco|iphone|samsung|realme|motorola)\\b/i.test(String(row?.text || '')));\n" +
      "  const outboundText = normalize(recentOutbound?.text || '');\n" +
      "  const inRecentAnswer = (option) => outboundText.includes(normalize(option.name || ''));\n" +
      "  const quoted = options.length <= 5 ? options : options.filter(inRecentAnswer);\n" +
      "  if (quoted.length && quoted.length <= 5 && quoted.every((option) => option.name && (option.price || option.memoryOptions?.some((part) => part.price)))) {\n" +
      "    const priced = quoted.flatMap((option) => {\n" +
      "      const parts = Array.isArray(option.memoryOptions) && option.memoryOptions.length ? option.memoryOptions : [option];\n" +
      "      return parts.filter((part) => part.price).map((part) => ({ option, part, cents: Number(part.priceCents || parseMoneyToCents(part.price)) }));\n" +
      "    }).filter((item) => item.cents > 0);\n" +
      "    if (priced.length && priced.length <= 8) {\n" +
      "      const lines = priced.map(({ option, part }, index) => {\n" +
      "        const card = part.card || option.card;\n" +
      "        const rawColors = Array.isArray(part.colors) && part.colors.length ? part.colors\n" +
      "          : (Array.isArray(option.colors) ? option.colors.filter((variant) => variant.memory === (part.memory || option.memory)\n" +
      "            && (!variant.priceCents || Number(variant.priceCents) === Number(part.priceCents || parseMoneyToCents(part.price)))) : []);\n" +
      "        const colors = [...new Set(rawColors.map((item) => typeof item === 'string' ? item : item?.color).filter(Boolean))];\n" +
      "        return [(index + 1) + '. ' + option.name,\n" +
      "          option.featureSummary ? '   ' + option.featureSummary : '',\n" +
      "          '   📱 ' + (part.memory || option.memory || 'Configuração consultada'),\n" +
      "          '      💰 ' + part.price + ' à vista no PIX',\n" +
      "          card?.installment && card?.total ? '      💳 Cartão: 12x de ' + card.installment + ' (total ' + card.total + ')' : '',\n" +
      "          colors.length ? '      🎨 Cores: ' + colors.join(', ') : '',\n" +
      "        ].filter(Boolean).join(lineBreak);\n" +
      "      });\n" +
      "      const cheapest = priced.reduce((best, item) => item.cents < best.cents ? item : best, priced[0]);\n" +
      "      const conclusion = asksLowestPixV1 ? 'Entre esses modelos, o menor preço cadastrado no Pix é ' + cheapest.part.price + ' no ' + cheapest.option.name + '. Desconto adicional precisa ser confirmado pela equipe.' : '';\n" +
      "      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,\n" +
      "        output: withGreeting([lines.map((line) => line + lineBreak + '━━━━━━━━━━━━━━━━━━━━━━').join(lineBreak), conclusion].filter(Boolean).join('[[MSG]]')) } }];\n" +
      "    }\n" +
      "  }\n" +
      "}\n" +
      'if (promotionQuestion()) {');
    target.parameters.jsCode = code;
  }

  {
    const target = node(NAMES[6]);
    let code = target.parameters.jsCode;
    assert.ok(!code.includes(MARKER));
    code = replaceOnce(code,
      '      phoneCatalogFollowupToken: String($json.phoneCatalogFollowupToken || \'\'), totalMessages: all.length, remoteJid, instancia, inboundWaMessageId,',
      `      // ${MARKER}: carry catalog provenance through the sender loop, even if another run updates conversation state.\n` +
      "      catalogDeliveryCandidateV1: Boolean($json.deterministicCatalogOutput && String($json.output || '').includes(String($json.deterministicCatalogOutput).split('[[MSG]]')[0])),\n" +
      "      phoneCatalogFollowupToken: String($json.phoneCatalogFollowupToken || ''), totalMessages: all.length, remoteJid, instancia, inboundWaMessageId,");
    target.parameters.jsCode = code;
  }

  for (const name of NAMES) new Function(node(name).parameters.jsCode);
  return workflow;
}

module.exports = { patchWorkflow, NAMES, MARKER };
