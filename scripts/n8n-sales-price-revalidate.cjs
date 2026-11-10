'use strict';

const assert = require('node:assert/strict');
const MARK = 'sales-price-revalidate-v1';
const POST = 'Vendas - Verificar Pos Lista';
const INSTALLMENTS = 'Vendas - Resolver Parcelamento';
const AGENTS = ['Agente Geral - Atendimento', 'Especialista - Vendas'];
const NODES = [POST, INSTALLMENTS, ...AGENTS];

function once(code, anchor, replacement) {
  assert.equal(code.split(anchor).length - 1, 1, 'Âncora do n8n alterada: ' + anchor.slice(0, 85));
  return code.replace(anchor, () => replacement);
}

function extract(code, from, to) {
  assert.equal(code.split(from).length - 1, 1, 'Início da regra de preço alterado: ' + from);
  assert.equal(code.split(to).length - 1, 1, 'Fim da regra de preço alterado: ' + to);
  const end = code.indexOf(to);
  assert.ok(code.indexOf(from) < end, 'Regra de preço fora de ordem');
  return code.slice(code.indexOf(from), end);
}

// This function is embedded in both Code nodes. Its dependencies are extracted
// from the live catalog formatter, so there is only one definition of a group.
function createRevalidator(httpRequest, normalizeRow, groupKey, money, cardPlan) {
  const catalog = new Map();
  const optionResults = new WeakMap();
  let cardFee;

  const list = payload => {
    const rows = Array.isArray(payload) ? payload : payload?.rows;
    if (!Array.isArray(rows)) throw new Error('Resposta inválida do catálogo');
    return rows;
  };
  const request = path => httpRequest({
    method: 'GET', url: 'https://api.xiaomipetrolina.com.br' + path,
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    json: true, timeout: 3500,
  });

  async function load(ids) {
    const missing = ids.filter(id => !catalog.has(id));
    for (let offset = 0; offset < missing.length; offset += 100) {
      const batch = missing.slice(offset, offset + 100);
      const rows = list(await request('/products?status=active&compact=true&limit=100&in_ids=' + encodeURIComponent(batch.join(',')) + '&_t=' + Date.now()));
      const byId = new Map(rows.map(row => [String(row.id), row]));
      for (const id of batch) {
        const row = byId.get(id);
        const available = row && String(row.status).toLowerCase() === 'active' &&
          Number(row.stock_quantity) > 0 && Number(row.hide_from_catalog) !== 1 && row.hide_from_catalog !== true &&
          row.offer_visibility !== 'hidden';
        const current = available ? normalizeRow(row) : null;
        if (current && (!Number.isSafeInteger(current.priceCents) || current.priceCents <= 0)) {
          throw new Error('Preço atual inválido');
        }
        catalog.set(id, current);
      }
    }
  }

  function idsOf(part) {
    return [...new Set([part?.productId, ...(part?.productIds || []),
      ...(part?.colors || []).map(color => color?.productId)].filter(Boolean).map(String))];
  }

  function partsOf(option) {
    return option.memoryOptions?.length ? option.memoryOptions : [option];
  }

  async function card(cents) {
    cardFee ||= request('/payment-fees').then(payload => list(payload)
      .filter(row => row.channel === 'presencial' && Number(row.installments) === 12 &&
        row.applied_fee_pct != null && Number.isFinite(Number(row.applied_fee_pct)) && Number(row.applied_fee_pct) >= 0)
      .sort((a, b) => Number(a.applied_fee_pct) - Number(b.applied_fee_pct))[0] || null)
      .catch(() => null);
    return cardPlan(cents, await cardFee);
  }

  async function calculate(option) {
    const oldParts = partsOf(option);
    const ids = [...new Set(option.priceRevalidateIds || oldParts.flatMap(idsOf))];
    if (!ids.length) return { unavailable: true };
    await load(ids);
    const variants = (option.colors || []).filter(color => color && typeof color === "object");
    const oldById = new Map(variants.map(variant => [String(variant.productId), variant]));
    const oldPartById = new Map(oldParts.flatMap(part => idsOf(part).map(id => [id, part])));
    const groups = [];
    let changed = false;
    let structureChanged = false;
    const grouped = new Map();
    for (const id of ids) {
      const row = catalog.get(id);
      if (!row) continue;
      const key = groupKey(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    for (const rows of grouped.values()) {
      const winner = rows.reduce((best, row) => row.priceCents > best.priceCents ? row : best);
      const part = oldPartById.get(winner.id) || oldParts.find(item => item.memory === winner.memory) || option;
      const previousIds = idsOf(part);
      const sameGroup = rows.length === previousIds.length && rows.every(row => previousIds.includes(row.id));
      const priceChanged = rows.some(row => {
        const old = oldPartById.get(row.id) || part;
        return Number(old.priceCents || oldById.get(row.id)?.priceCents || 0) !== winner.priceCents;
      });
      const promoChanged = Boolean(part.promoActive) !== winner.promoActive ||
        String(part.promoEnd || "") !== String(winner.promoEnd || "");
      structureChanged ||= !sameGroup;
      changed ||= priceChanged || promoChanged;
      const fields = {
        priceCents: winner.priceCents, price: money(winner.priceCents),
        retailPrice: winner.retailPrice, promoActive: winner.promoActive, promoEnd: winner.promoEnd,
        card: priceChanged || !sameGroup ? await card(winner.priceCents) : part.card || option.card || null,
        promoQuoteRefreshedV826: priceChanged || !sameGroup || part.promoQuoteRefreshedV826 === true,
      };
      const colors = rows.map(row => ({
        ...oldById.get(row.id), ...fields, productId: row.id, sku: row.sku,
        color: row.color || oldById.get(row.id)?.color || "",
        memory: row.memory || part.memory, stock: row.stock,
      }));
      const { memoryOptions, priceRevalidateIds, priceRevalidateColors, ...prior } = part;
      groups.push({ ...prior, ...fields, memory: winner.memory || part.memory,
        productId: winner.id, sku: winner.sku, productIds: rows.map(row => row.id),
        colors: colors.map(row => row.color).filter(Boolean), variants: colors,
        physicalKey: groupKey({ ...winner, promoActive: false }) });
    }
    structureChanged ||= groups.length !== oldParts.length;
    if (!groups.length) return { unavailable: true };
    return { groups, changed, structureChanged, ids };
  }

  async function refresh(option) {
    if (!optionResults.has(option)) {
      optionResults.set(option, calculate(option).catch(() => ({ failed: true })));
    }
    return optionResults.get(option);
  }

  function save(option, result) {
    if (!result.changed && !result.structureChanged) return;
    const { groups } = result;
    option.priceRevalidateIds ||= result.ids;
    option.priceRevalidateColors ||= (option.colors || []).map(({productId, color, memory}) => ({productId, color, memory}));
    const representative = groups.reduce((best, group) => group.priceCents < best.priceCents ? group : best);
    const { variants, physicalKey, ...fields } = representative;
    Object.assign(option, {
      ...fields, number: option.number, name: option.name,
      memory: [...new Set(groups.map(group => group.memory))].join(" / "),
      colors: groups.flatMap(group => group.variants),
      memoryOptions: option.memoryOptions?.length || groups.length > 1
        ? groups.map(({ variants, physicalKey, ...group }) => group) : [],
    });
  }

  function unavailable(result, group) {
    if (result.failed) return 'Não consegui confirmar o valor agora. Posso te mostrar a lista atualizada?';
    if (group) {
      const colors = [...new Set(group.colors)];
      if (colors.length) return 'Essa cor não está mais disponível. As cores atuais são ' + colors.join(', ') + '. Qual você prefere?';
    }
    return 'Essa opção não está mais disponível. Posso te mostrar a lista atualizada?';
  }

  function splitText(option, groups, pix, lineBreak) {
    const lines = [...groups].sort((a, b) => a.priceCents - b.priceCents).map(group => {
      const end = group.promoActive && group.promoEnd &&
        String(group.promoEnd).match(/^\d{4}-(\d{2})-(\d{2})/);
      const parts = [group.colors.join(', ') + ': ' + group.price + ' à vista no PIX'];
      if (group.card) parts.push('💳 Cartão: 12x de ' + group.card.installment + ' (' + group.card.total + ')');
      if (end) parts.push('(promoção até ' + end[2] + '/' + end[1] + ')');
      return parts.join(' · ');
    });
    return [[option.name, groups[0].memory].filter(Boolean).join(' — '), ...lines, 'Valor atualizado hoje.', 'Qual cor você prefere?'].join(lineBreak);
  }

  function partFor(groups, id) {
    return groups?.find(part => part.productIds.some(productId => String(productId) === String(id)));
  }

  function priceChangedFor(option, group, id) {
    const variant = (option.colors || []).find(row => String(row.productId) === String(id));
    const part = partsOf(option).find(item => idsOf(item).includes(String(id)));
    return Number(variant?.priceCents || part?.priceCents || option.priceCents) !== group.priceCents;
  }

  async function draft(state, previous) {
    const id = String(previous?.productId || '');
    if (!id) return { unavailable: true };
    const option = (state.options || []).find(item => (item.priceRevalidateIds || partsOf(item).flatMap(idsOf)).includes(id));
    // A draft without its original list may still have the configuration IDs.
    const config = option || (previous.productIds?.length ? { ...previous, priceCents: previous.unitPriceCents } : null);
    if (!config) return { unavailable: true };
    const result = await refresh(config);
    if (!result.groups) return result;
    const group = partFor(result.groups, id);
    if (!group) {
      const colors = result.groups.filter(part => part.memory === previous.memory);
      return { unavailable: true, alternative: colors.length ? { colors: colors.flatMap(part => part.colors) } : null };
    }
    save(config, result);
    const oldCents = Number(previous.unitPriceCents) || Math.round(Number(String(previous.price || "").replace(/[^\d,]/g, "").replace(",", ".")) * 100);
    const changed = oldCents !== group.priceCents;
    if (!changed) return { value: previous, changed: false };
    const value = { ...previous, unitPriceCents: group.priceCents, price: group.price,
      promoEnd: group.promoEnd, promoActive: group.promoActive, retailPrice: group.retailPrice };
    for (const field of ['total', 'pricePix', 'cardBaseCents', 'cardInstallmentOptions', 'selectedCardInstallment']) delete value[field];
    return { value, changed, card: group.card };
  }

  return { refresh, save, unavailable, splitText, partFor, priceChangedFor, draft };
}


function sharedSource(context) {
  const normalize = extract(context, 'const normalize = (value)', 'const searchText =');
  const memory = extract(context, 'const normalizeMemoryLabel =', '// sales-model-configuration-v1');
  const configKey = extract(context, 'const quoteModelIdentityV2 =', 'const canonicalProductByConfigurationV248 =');
  const condition = extract(context, '    const conditionRawV1 =', '    const conditionNoteV1 =');
  const number = extract(context, 'const toNumber =', 'const pixPriceLineV826 =');
  const money = extract(context, 'const centsToBRL =', 'const normalizeMemoryLabel =');
  const card = extract(context, 'const buildCardPlan =', 'const normalize = (value)')
    .replace('(priceCents) =>', '(priceCents, selectedCardFee) =>');
  return [
    normalize, memory, configKey, number, money, card,
    extract(context, 'const normalizeKey =', 'const categoryText ='),
    'function normalizePriceRow(product) {',
    '  const variationSpecsV2 = product.specs || {};',
    condition,
    '  const physical = getPhysicalMemoryPartsV155(product);',
    '  const color = getColor(product);',
    "  const utcDate = value => {\n    const text = String(value || '').trim();\n    if (!text) return NaN;\n    return Date.parse(/^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?$/.test(text) ? text.replace(' ', 'T') + 'Z' : text);\n  };",
    '  const promoStart = utcDate(product.promo_start);',
    '  const promoEnd = utcDate(product.promo_end);',
    '  const retail = toNumber(product.price_retail);',
    '  const promo = toNumber(product.price_promo);',
    '  const hasEffective = product.price_effective != null && product.price_effective !== "";',
    '  const promoActive = hasEffective ? product.promo_active === true :',
    '    promo > 0 && promo < retail && (!product.promo_start || Number.isFinite(promoStart) && promoStart <= Date.now()) &&',
    '    (!product.promo_end || Number.isFinite(promoEnd) && Date.now() <= promoEnd);',
    '  return { id: String(product.id), sku: product.sku, color, stock: Number(product.stock_quantity),',
    '    modelId: String(product.model_id || "").trim(),',
    '    name: (String(product.model_name || "").replace(/\\s+/g, " ").trim() || withoutColorSuffix(product.name, color)) + (conditionLabelV1 ? " (" + conditionLabelV1 + ")" : ""),',
    '    condition: conditionV1, ramGb: physical.ramGb, storageGb: physical.storageGb,',
    '    memory: [physical.ramLabel, physical.storageLabel].filter(Boolean).join("/") || getMemory(product),',
    '    retailPrice: centsToBRL(retail), promoActive, promoEnd: promoActive ? product.promo_end || null : null,',
    '    priceCents: Math.round(hasEffective ? toNumber(product.price_effective) : promoActive ? promo : retail),',
    '  };',
    '}',
    'return (' + createRevalidator.toString() + ')((params) => helpers.httpRequest(params), normalizePriceRow, quoteConfigurationKeyV2, centsToBRL, buildCardPlan);',
  ].join('\n');
}

function patchPost(code, shared) {
  const old = extract(code, '// promo-period-v826:', 'const text = String(source.conversation');
  code = once(code, old, '// ' + MARK + '\nconst priceGuard = (() => {\n' + shared + '\n})();\n' + [
    'let revalidatedPriceChanged = false;',
    'const priceUpdateNotice = message => [message, revalidatedPriceChanged ? "Valor atualizado hoje." : ""].filter(Boolean).join(lineBreak);',
    'const quoteReply = message => [{json:{...source, salesPostListHandled:true, needsPaymentOptionsLookup:false,',
    '  salesPostListStep:activeState?.step || "", output:withGreeting(message)}}];',
    '',
  ].join('\n'));
  const draftFromList = '  const quoteDraftV1 = {';
  code = once(code, draftFromList, [
    '  const groupsNow = await priceGuard.refresh(quoteOptionV1);',
    '  if (!groupsNow.groups) return quoteReply(priceGuard.unavailable(groupsNow));',
    '  const groupsForMemory = groupsNow.groups.filter(group => group.memory === quoteResolvedExactV1.memory);',
    '  if (!preferredProductIdV1 && groupsForMemory.length > 1 && groupsForMemory.every(group => group.physicalKey === groupsForMemory[0].physicalKey)) {',
    '    priceGuard.save(quoteOptionV1, groupsNow);',
    '    activeState.step = "awaiting_color";',
    '    activeState.selectedOptionNumber = quoteOptionV1.number;',
    '    activeState.selectedMemoryExactV1 = quoteResolvedExactV1.memory;',
    '    activeState.updatedAt = new Date(now).toISOString();',
    '    return quoteReply(priceGuard.splitText(quoteOptionV1, groupsForMemory, lineBreak));',
    '  }',
    draftFromList,
  ].join('\n'));
  code = once(code, draftFromList, '  const quoteDraftV1 = {\n    productIds: (quoteOptionV1.memoryOptions || []).find(part => part.productIds?.includes(quoteVariantV1.productId))?.productIds || [quoteVariantV1.productId],');
  code = once(code, '    const priced = quoted.flatMap((option) => {', [
    '    for (const item of quoted) {',
    '      const current = await priceGuard.refresh(item);',
    '      if (!current.groups) return quoteReply(priceGuard.unavailable(current));',
    '      priceGuard.save(item, current);',
    '      revalidatedPriceChanged ||= current.changed;',
    '    }',
    '    const priced = quoted.flatMap((option) => {',
  ].join('\n'));
  code = once(code, 'conclusion].filter(Boolean).join(\'[[MSG]]\'))', 'conclusion, revalidatedPriceChanged ? "Valor atualizado hoje." : ""].filter(Boolean).join(\'[[MSG]]\'))');
  const draftGuard = [
    'const guardDraftQuote = async () => {',
    '  if (!activeState?.orderDraft?.productId) return null;',
    '  const current = await priceGuard.draft(activeState, activeState.orderDraft);',
    '  if (!current.value) return quoteReply(priceGuard.unavailable(current, current.alternative));',
    '  if (!current.changed) return null;',
    '  activeState.orderDraft = current.value;',
    '  activeState.step = "awaiting_purchase_confirmation";',
    '  activeState.updatedAt = new Date(now).toISOString();',
    '  const card = current.card && "💳 Cartão: 12x de " + current.card.installment + " (" + current.card.total + ")";',
    '  return quoteReply([pixPriceLineV826(current.value), card, "Valor atualizado hoje.", "Confirma que quer seguir com esse valor?"].filter(Boolean).join(lineBreak));',
    '};',
  ].join('\n');
  const draftAnchor = '// purchase-confirmation-before-fulfillment-v417:gate';
  code = once(code, draftAnchor, draftGuard + '\n' + draftAnchor);
  for (const anchor of [
    "  activeState.orderDraft = { ...activeState.orderDraft, deliveryNumberComplement: text };",
    "  activeState.orderDraft = { ...activeState.orderDraft, paymentMethod: method, paymentLabel: paymentMethodLabels[method] || method };",
    "  activeState.orderDraft = { ...activeState.orderDraft, selectedCardInstallment: selected };",
    "  const summary = [draft.name, draft.memory, draft.color, 'Quantidade: '+(draft.quantity||1),",
  ]) {
    code = once(code, anchor, '  const refreshedDraftQuote = await guardDraftQuote();\n  if (refreshedDraftQuote) return refreshedDraftQuote;\n' + anchor);
  }
  code = once(code, 'const requestOrderReviewV1 = () => {', 'const requestOrderReviewV1 = async () => {');
  const selection = 'let option = rawOptionExactV1;';
  code = once(code, selection, [
    selection,
    'if (option && !wantsProductLink) {',
    '  const current = await priceGuard.refresh(option);',
    '  if (!current.groups) return quoteReply(priceGuard.unavailable(current));',
    '  const knownColors = option.priceRevalidateColors || option.colors || [];\n  const oldColor = findMentionedColor(knownColors.map(row => row.color)) || aiColor || activeState.pendingColorExactV1 || "";',
    '  const previousColors = knownColors.filter(row => oldColor && normalize(row.color) === normalize(oldColor));\n  const previous = previousColors.find(row => priceGuard.partFor(current.groups, row.productId)) || previousColors[0];',
    '  const selectedGroup = previous && priceGuard.partFor(current.groups, previous.productId);',
    '  if (previous && !selectedGroup) {',
    '    const alternatives = current.groups.filter(group => group.memory === previous.memory).flatMap(group => group.colors);',
    '    return quoteReply(priceGuard.unavailable(current, { colors: alternatives }));',
    '  }',
    '  revalidatedPriceChanged ||= selectedGroup ? priceGuard.priceChangedFor(option, selectedGroup, previous.productId) : current.changed;',
    '  priceGuard.save(option, current);',
    '  const byMemory = current.groups.filter(group => !activeState.selectedMemoryExactV1 || group.memory === activeState.selectedMemoryExactV1);',
    '  const split = byMemory.filter(group => group.physicalKey === byMemory[0]?.physicalKey);',
    '  if (!selectedGroup && split.length > 1 && selectedNumber) {',
    '    activeState.step = "awaiting_color";',
    '    activeState.selectedOptionNumber = selectedNumber;',
    '    activeState.selectedMemoryExactV1 = split[0].memory;',
    '    activeState.updatedAt = new Date(now).toISOString();',
    '    return quoteReply(priceGuard.splitText(option, split, lineBreak));',
    '  }',
    '}',
  ].join('\n'));
  code = once(code, 'const configExactV1 = rawOptionExactV1.memoryOptions?.find(v => v.memory === resolvedExactV1.memory) || rawOptionExactV1;', [
    'const exactId = resolvedExactV1.candidates[0]?.productId;',
    '    const configExactV1 = rawOptionExactV1.memoryOptions?.find(v => v.productIds?.includes(exactId))',
    '      || rawOptionExactV1.memoryOptions?.find(v => v.memory === resolvedExactV1.memory) || rawOptionExactV1;',
  ].join('\n'));
  code = once(code, 'const selectedOptionSummaryV245 = [', 'const selectedOptionSummaryV245 = [\n  revalidatedPriceChanged ? "Valor atualizado hoje." : "",');
  code = once(code, 'const pendingSelectedOptionSummaryV245 = activeState?.selectedOptionSummarySentV245 === true', 'const pendingSelectedOptionSummaryV245 = !revalidatedPriceChanged && activeState?.selectedOptionSummarySentV245 === true');
  code = once(code, ' + detailsV1)}}];', ' + priceUpdateNotice(detailsV1))}}];');
  code = once(code, 'if (modelQuestionOptionsV345.length > 0) {', [
    'if (modelQuestionOptionsV345.length > 0) {',
    '  for (const item of modelQuestionOptionsV345) {',
    '    const current = await priceGuard.refresh(item);',
    '    if (!current.groups) return quoteReply(priceGuard.unavailable(current));',
    '    const modelColor = aiColor || findMentionedColor((item.colors || []).map(row => row.color));\n    const chosen = (item.colors || []).find(row => modelColor && normalize(row.color) === normalize(modelColor));',
    '    const group = chosen && priceGuard.partFor(current.groups, chosen.productId);',
    '    if (chosen && !group) return quoteReply(priceGuard.unavailable(current, {colors: current.groups.filter(part => part.memory === chosen.memory).flatMap(part => part.colors)}));',
    '    revalidatedPriceChanged ||= group ? priceGuard.priceChangedFor(item, group, chosen.productId) : current.changed;',
    '    priceGuard.save(item, current);',
    '    if (!group && current.groups.length > 1 && current.groups.every(part => part.physicalKey === current.groups[0].physicalKey)) {',
    '      activeState.step = "awaiting_color";',
    '      activeState.selectedOptionNumber = item.number;',
    '      activeState.selectedMemoryExactV1 = current.groups[0].memory;',
    '      activeState.updatedAt = new Date(now).toISOString();',
    '      return quoteReply(priceGuard.splitText(item, current.groups, lineBreak));',
    '    }',
    '    if (group && current.groups.length > 1) modelQuestionOptionsV345[modelQuestionOptionsV345.indexOf(item)] = {...item, ...group, colors:group.variants};',
    '  }',
  ].join('\n'));
  code = once(code, 'output: withGreeting(responseLinesV345.join(lineBreak + lineBreak)),', 'output: withGreeting(priceUpdateNotice(responseLinesV345.join(lineBreak + lineBreak))),');
  code = once(code, '  productId: item.productId,\n  sku: item.sku || option.sku', '  productId: item.productId,\n  productIds: option.productIds || [item.productId],\n  sku: item.sku || option.sku');
  return code;
}

function patchInstallments(code, shared) {
  const anchor = 'const draft = { ...(activeState.orderDraft || {}), ...(source.orderDraft || {}) };';
  code = once(code, anchor, [
    '// ' + MARK,
    'const priceGuard = (() => {',
    shared,
    '})();',
    'const priorDraft = { ...(activeState.orderDraft || {}), ...(source.orderDraft || {}) };',
    'const freshDraft = await priceGuard.draft(activeState, priorDraft);',
    'if (!freshDraft.value) {',
    '  return [{ json: { ...source, needsPaymentOptionsLookup: false, salesPostListHandled: true,',
    '    output: priceGuard.unavailable(freshDraft, freshDraft.alternative) } }];',
    '}',
    'const draft = freshDraft.value;',
    'const updatedNotice = freshDraft.changed ? "Valor atualizado hoje." + lineBreak : "";',
    'if (freshDraft.changed && activeState.orderDraft?.productId === draft.productId) activeState.orderDraft = draft;',
  ].join('\n'));
  code = once(code, 'output: requestedLine + list', 'output: updatedNotice + requestedLine + list');
  code = once(code, "output: intro + '[[MSG]]' + list", "output: intro + '[[MSG]]' + updatedNotice + list");
  return 'return (async () => {\n' + code + '\n})();';
}

function patchWorkflow(workflow) {
  const next = structuredClone(workflow);
  const find = name => {
    const nodes = next.nodes.filter(n => n.name === name);
    assert.equal(nodes.length, 1, 'Nó do n8n ausente ou duplicado: ' + name);
    return nodes[0].parameters;
  };
  const post = find(POST), installments = find(INSTALLMENTS);
  const prompts = AGENTS.map(name => find(name).options);
  for (const opts of prompts) assert.ok(typeof opts?.systemMessage === 'string' && opts.systemMessage.length);
  const marked = [post.jsCode, installments.jsCode, ...prompts.map(opts => opts.systemMessage)]
    .map(code => code.includes(MARK));
  if (marked.every(Boolean)) return next;
  assert.ok(marked.every(value => !value), 'Patch aplicado parcialmente');
  const shared = sharedSource(find('Vendas - Contexto Produtos').jsCode);
  post.jsCode = patchPost(post.jsCode, shared);
  installments.jsCode = patchInstallments(installments.jsCode, shared);
  for (const opts of prompts) {
    opts.systemMessage += '\n\nPRECO DA MEMORIA (// ' + MARK + ':agent): nunca repita preço, parcela, total ou entrada que esteja no histórico ou na memória da conversa; valores mudam. Informe somente valores dos dados atuais do fluxo. Se o cliente citar um valor antigo, diga que vai confirmar o valor atual.';
  }
  for (const code of [post.jsCode, installments.jsCode]) new Function(code);
  return next;
}

module.exports = { patchWorkflow, MARK, NODES };
