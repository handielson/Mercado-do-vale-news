const assert = require('node:assert/strict');
const { readWorkflow } = require('./n8n-warranty-policy.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'installment-quote-guard-v1';

function replaceOnce(text, search, replacement, label) {
  const matches = String(text).split(search).length - 1;
  assert.equal(matches, 1, `${label} anchor must occur exactly once`);
  return String(text).replace(search, replacement);
}

function patchClassifier(code) {
  let next = String(code || '');
  if (next.includes(`${MARKER}:classifier`)) return next;
  const anchor = "const deliveryFreightIntentV337 = deliveryTermsV337 && !explicitPaymentTermsV337;";
  const addition = `${anchor}\n// ${MARKER}:classifier\nconst installmentQuoteIntentV1 = (/(?:^|\\s)(?:1[0-2]|[1-9])\\s*x(?:\\s|$)/.test(usedPolicyNormalizedV161)\n  && /\\b(?:cartao|credito|parcela|parcelado|parcelamento|fica|ficaria|sai|sairia|valor|quanto)\\b/.test(usedPolicyNormalizedV161))\n  || /\\b(?:valor|quanto|como)\\b.{0,35}\\bparcelad(?:o|a|os|as|amento)\\b/.test(usedPolicyNormalizedV161);`;
  next = replaceOnce(next, anchor, addition, 'classifier installment detection');
  next = replaceOnce(
    next,
    "if (genericPurchaseInquiryV1) intencao = 'compra_generica';",
    "if (genericPurchaseInquiryV1) intencao = 'compra_generica';\nif (installmentQuoteIntentV1) intencao = 'vendas_produtos';",
    'classifier intent override',
  );
  new Function('$json', '$', next);
  return next;
}

const POST_LIST_GUARD = String.raw`
// installment-quote-guard-v1:quote-request
const installmentQuoteMatchV1 = normalized.match(/\b(1[0-2]|[1-9])\s*x\b/);
const installmentQuoteRequestV1 = (Boolean(installmentQuoteMatchV1)
  && /\b(?:cartao|credito|parcela|parcelado|parcelamento|fica|ficaria|sai|sairia|valor|quanto)\b/.test(normalized))
  || /\b(?:valor|quanto|como)\b.{0,35}\bparcelad(?:o|a|os|as|amento)\b/.test(normalized);
if (installmentQuoteRequestV1 && activeState?.flow === 'sales_post_list' && Array.isArray(activeState.options) && activeState.options.length > 0) {
  const quoteOptionsV1 = activeState.options;
  const recentRowsV1 = Array.isArray(source.recentMessages) ? source.recentMessages.slice(-20) : [];
  const quoteNormalizeV1 = (value) => normalize(value);
  const optionVariantsV1 = (option) => Array.isArray(option?.colors) ? option.colors : [];
  const optionProductIdsV1 = (option) => optionVariantsV1(option).map((item) => String(item?.productId || '')).filter(Boolean);
  const draftProductIdV1 = String(activeState?.orderDraft?.productId || '');
  const mediaProductIdV1 = String(activeState?.lastMediaContext?.productId || '');
  let quoteOptionV1 = quoteOptionsV1.find((option) => optionProductIdsV1(option).includes(draftProductIdV1)) || null;
  if (!quoteOptionV1 && mediaProductIdV1) quoteOptionV1 = quoteOptionsV1.find((option) => optionProductIdsV1(option).includes(mediaProductIdV1)) || null;
  if (!quoteOptionV1) {
    const explicitOptionsV1 = quoteOptionsV1.filter((option) => {
      const nameV1 = quoteNormalizeV1(option?.name);
      return nameV1.length >= 3 && normalized.includes(nameV1);
    });
    if (explicitOptionsV1.length === 1) quoteOptionV1 = explicitOptionsV1[0];
  }
  let recentProductTextV1 = '';
  if (!quoteOptionV1) {
    const candidatesV1 = [...recentRowsV1].reverse().filter((row) => String(row?.direction || '').toLowerCase() === 'outbound');
    for (const rowV1 of candidatesV1) {
      const rowTextV1 = quoteNormalizeV1(rowV1?.text || rowV1?.message_text || rowV1?.caption || '');
      const matchesV1 = quoteOptionsV1
        .filter((option) => rowTextV1.includes(quoteNormalizeV1(option?.name)))
        .sort((a, b) => quoteNormalizeV1(b?.name).length - quoteNormalizeV1(a?.name).length);
      if (matchesV1.length > 0) {
        quoteOptionV1 = matchesV1[0];
        recentProductTextV1 = rowTextV1;
        break;
      }
    }
  }
  if (!quoteOptionV1 && activeState?.selectedOptionNumber) {
    quoteOptionV1 = quoteOptionsV1.find((option) => Number(option?.number) === Number(activeState.selectedOptionNumber)) || null;
  }
  if (!quoteOptionV1) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,
      output: withGreeting('Me confirma qual modelo da lista você quer parcelar para eu consultar a tabela correta da maquininha.') } }];
  }
  const variantsV1 = optionVariantsV1(quoteOptionV1);
  const preferredProductIdV1 = draftProductIdV1 || mediaProductIdV1;
  let quoteVariantV1 = variantsV1.find((item) => String(item?.productId || '') === preferredProductIdV1) || null;
  if (!quoteVariantV1 && recentProductTextV1) {
    quoteVariantV1 = variantsV1.find((item) => recentProductTextV1.includes(quoteNormalizeV1(item?.color))) || null;
  }
  quoteVariantV1 = quoteVariantV1 || variantsV1[0] || {};
  const quoteDraftV1 = {
    productId: quoteVariantV1.productId || '',
    name: quoteOptionV1.name || '',
    memory: quoteOptionV1.memory || '',
    color: quoteVariantV1.color || '',
    price: quoteOptionV1.price || quoteVariantV1.price || '',
    url: quoteVariantV1.url || quoteOptionV1.url || '',
    quantity: 1,
  };
  if (!parseMoneyToCents(quoteDraftV1.price)) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,
      output: withGreeting('Não consegui confirmar o preço desse modelo agora. Vou deixar para um atendente conferir sem estimar o parcelamento.') } }];
  }
  activeState.focusedModelName = quoteDraftV1.name;
  activeState.lastPaymentQuoteV1 = { ...quoteDraftV1, requestedInstallments: Number(installmentQuoteMatchV1?.[1] || 0) };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    needsPaymentOptionsLookup: true,
    paymentQuoteOnly: true,
    requestedInstallments: Number(installmentQuoteMatchV1?.[1] || 0),
    orderDraft: quoteDraftV1,
  } }];
}
`;

function patchPostList(code) {
  const current = String(code || '');
  if (current.includes(`${MARKER}:quote-request`)) return current;
  const anchor = "const normalized = normalize(text);\n";
  const next = replaceOnce(current, anchor, anchor + POST_LIST_GUARD, 'post-list quote guard');
  new Function('$json', '$', '$getWorkflowStaticData', 'fetch', next);
  return next;
}

function patchResolver(code) {
  let next = String(code || '');
  if (next.includes(`${MARKER}:resolver`)) return next;
  next = replaceOnce(
    next,
    "    const fee = presencialFees.find((item) => Number(item?.installments) === installments) || { applied_fee_pct: 0 };\n    const feePct = toNumber(fee.applied_fee_pct);",
    "    const fee = presencialFees.find((item) => Number(item?.installments) === installments);\n    if (!fee) return null;\n    const feePct = toNumber(fee.applied_fee_pct);",
    'resolver missing-fee fallback',
  );
  next = replaceOnce(
    next,
    "const options = buildInstallmentOptions(cardBaseCents, fees);\n\nactiveState.step = 'awaiting_card_installment';",
    `const options = buildInstallmentOptions(cardBaseCents, fees);\n\n// ${MARKER}:resolver\nif (orderTotalCents <= 0) {\n  return [{ json: { ...source, needsPaymentOptionsLookup: false, salesPostListHandled: true,\n    output: 'Não consegui confirmar o preço desse modelo agora. Vou deixar para um atendente conferir sem estimar o parcelamento.' } }];\n}\nif (options.length !== paymentInstallments || options.some((option) => !option)) {\n  return [{ json: { ...source, needsPaymentOptionsLookup: false, salesPostListHandled: true,\n    output: 'A tabela da maquininha não está completa agora. Vou deixar para um atendente conferir antes de informar qualquer valor.' } }];\n}\nif (source.paymentQuoteOnly === true) {\n  const requestedInstallments = Number(source.requestedInstallments || 0);\n  const requested = options.find((option) => option.installments === requestedInstallments);\n  activeState.lastPaymentQuoteV1 = { ...draft, requestedInstallments, cardInstallmentOptions: options };\n  activeState.updatedAt = new Date().toISOString();\n  const productLabel = [draft.name, draft.memory, draft.color].filter(Boolean).join(' - ');\n  const requestedLine = requested ? 'Em ' + requested.label + '.' + lineBreak + lineBreak : '';\n  const list = 'Tabela da maquininha para ' + productLabel + ':' + lineBreak\n    + options.map((option) => option.installments + 'x de ' + centsToBRL(option.installmentCents)\n      + ' (total ' + centsToBRL(option.totalCents) + ')').join(lineBreak);\n  return [{ json: { ...source, needsPaymentOptionsLookup: false, salesPostListHandled: true,\n    salesPostListStep: activeState.step, paymentQuoteOnly: true, orderDraft: draft,\n    output: requestedLine + list } }];\n}\n\nactiveState.step = 'awaiting_card_installment';`,
    'resolver quote-only branch',
  );
  new Function('$json', '$input', '$', '$getWorkflowStaticData', next);
  return next;
}

function patchAgentPrompt(node) {
  assert.ok(node?.parameters?.options, `${node?.name || 'agent'} options missing`);
  const current = String(node.parameters.options.systemMessage || '');
  if (current.includes(`${MARKER}:agent`)) return;
  node.parameters.options.systemMessage = `${current}\n\nPARCELAMENTO NO CARTAO (// ${MARKER}:agent):\n- Nunca calcule parcelas dividindo o valor do PIX e nunca informe estimativa, aproximacao ou valor "em torno de".\n- Valores parcelados so podem vir da tabela estruturada da maquininha, com juros, valor da parcela e total.\n- Se a tabela estruturada nao estiver disponivel, nao informe nenhum valor; diga que precisa consultar a tabela correta.`;
}

function patchWorkflow(workflow) {
  const cloned = structuredClone(workflow);
  const classifier = cloned.nodes.find((node) => node.name === 'Parse Classificacao');
  const postList = cloned.nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
  const resolver = cloned.nodes.find((node) => node.name === 'Vendas - Resolver Parcelamento');
  assert.ok(classifier?.parameters?.jsCode && postList?.parameters?.jsCode && resolver?.parameters?.jsCode, 'required installment nodes missing');
  classifier.parameters.jsCode = patchClassifier(classifier.parameters.jsCode);
  postList.parameters.jsCode = patchPostList(postList.parameters.jsCode);
  resolver.parameters.jsCode = patchResolver(resolver.parameters.jsCode);
  patchAgentPrompt(cloned.nodes.find((node) => node.name === 'Agente Geral - Atendimento'));
  patchAgentPrompt(cloned.nodes.find((node) => node.name === 'Especialista - Vendas'));
  return cloned;
}

async function validate(workflow) {
  const classifierCode = workflow.nodes.find((node) => node.name === 'Parse Classificacao').parameters.jsCode;
  const postListCode = workflow.nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const resolverCode = workflow.nodes.find((node) => node.name === 'Vendas - Resolver Parcelamento').parameters.jsCode;
  const remoteJid = '558792044059@s.whatsapp.net';
  const source = {
    remoteJid,
    conversation: 'Esse último em 6x fica quanto',
    recentMessages: [
      { direction: 'outbound', message_text: 'Poco C71 - 4GB/128GB - Dourado' },
      { direction: 'outbound', message_text: 'Poco C81 Pro - 4GB/128GB - Verde' },
      { direction: 'outbound', message_text: 'Poco C85 - 6GB/128GB - Roxo' },
    ],
  };
  const classify = (conversation) => new Function('$json', '$', classifierCode)(
    { output: JSON.stringify({ intencao: 'formas_pagamento', mensagem: conversation, venda: {}, fluxo_venda: {} }) },
    () => ({ first: () => ({ json: { ...source, conversation } }) }),
  )[0].json;
  for (const conversation of [
    'Esse último em 6x fica quanto',
    '5x no cartão fica como as parcelas',
    'Em 10x sairia a quanto?',
    'Qual valor parcelado?',
  ]) {
    assert.equal(classify(conversation).intencao, 'vendas_produtos', conversation);
  }
  const parsed = classify(source.conversation);

  const state = {
    flow: 'sales_post_list', step: 'awaiting_product_choice', expiresAt: Date.now() + 60_000,
    options: [
      { number: 12, name: 'Poco C71', memory: '4GB/128GB', price: 'R$ 901,00', colors: [{ productId: 'c71', color: 'Dourado' }] },
      { number: 13, name: 'Poco C81 Pro', memory: '4GB/128GB', price: 'R$ 960,00', colors: [{ productId: 'c81', color: 'Verde' }] },
      { number: 15, name: 'Poco C85', memory: '6GB/128GB', price: 'R$ 949,00', colors: [{ productId: 'c85', color: 'Roxo' }] },
    ],
  };
  const staticData = { salesPostList: { [remoteJid]: state } };
  const quoteRequest = await new Function('$json', '$', '$getWorkflowStaticData', 'fetch', postListCode)(
    {}, (name) => ({ first: () => ({ json: name === 'Parse Classificacao' ? source : {} }) }),
    () => staticData, async () => ({ ok: false, json: async () => ({}) }),
  );
  assert.equal(quoteRequest[0].json.needsPaymentOptionsLookup, true);
  assert.equal(quoteRequest[0].json.paymentQuoteOnly, true);
  assert.equal(quoteRequest[0].json.requestedInstallments, 6);
  assert.equal(quoteRequest[0].json.orderDraft.name, 'Poco C85');

  const fees = Array.from({ length: 12 }, (_, index) => ({
    channel: 'presencial', installments: index + 1, applied_fee_pct: index === 5 ? '7.81' : String(index),
  }));
  const resolved = new Function('$json', '$input', '$', '$getWorkflowStaticData', resolverCode)(
    {}, { all: () => fees.map((json) => ({ json })) },
    () => ({ first: () => ({ json: quoteRequest[0].json }) }), () => staticData,
  );
  assert.match(resolved[0].json.output, /Em 6x de R\$\s*170,52/);
  assert.match(resolved[0].json.output, /total R\$\s*1\.023,12/);
  assert.match(resolved[0].json.output, /12x de/);
  assert.doesNotMatch(resolved[0].json.output, /158,15|aproxim|em torno/i);
  assert.equal(state.step, 'awaiting_product_choice', 'a price quote must not start checkout');
  assert.equal(state.orderDraft, undefined, 'a price quote must not confirm a product purchase');

  const missingFees = new Function('$json', '$input', '$', '$getWorkflowStaticData', resolverCode)(
    {}, { all: () => fees.slice(0, 5).map((json) => ({ json })) },
    () => ({ first: () => ({ json: quoteRequest[0].json }) }), () => staticData,
  );
  assert.match(missingFees[0].json.output, /tabela da maquininha não está completa/i);
  assert.doesNotMatch(missingFees[0].json.output, /\d+x de R\$/i);

  for (const name of ['Agente Geral - Atendimento', 'Especialista - Vendas']) {
    const prompt = workflow.nodes.find((node) => node.name === name).parameters.options.systemMessage;
    assert.match(prompt, new RegExp(`${MARKER}:agent`));
    assert.match(prompt, /Nunca calcule parcelas dividindo o valor do PIX/);
  }
  return { route: parsed.intencao, model: quoteRequest[0].json.orderDraft.name, requestedInstallments: 6,
    exactSixInstallments: '6x de R$ 170,52 (total R$ 1.023,12)', fullTable: true, checkoutPreserved: true,
    missingFeesFailClosed: true, agentGuard: true };
}

async function main() {
  const { Client } = require('ssh2');
  const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const current = await readWorkflow(connection);
    assert.equal(current.id || WORKFLOW_ID, WORKFLOW_ID);
    const patched = patchWorkflow(current);
    const result = await validate(patched);
    assert.deepEqual(patchWorkflow(patched).nodes, patched.nodes, 'patch must be idempotent');
    console.log(JSON.stringify({ mode: 'local dry run; production unchanged', workflow: current.name, marker: MARKER, result }, null, 2));
  } finally {
    connection.end();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = { patchClassifier, patchPostList, patchResolver, patchAgentPrompt, patchWorkflow, validate };
