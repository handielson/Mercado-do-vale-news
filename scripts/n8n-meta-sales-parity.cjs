'use strict';

// Adapt the shared sales state machine to a Meta DM without changing WhatsApp.
const assert = require('node:assert/strict');
const MARKER = 'meta-sales-parity-v1';
const NODE = 'Vendas - Verificar Pos Lista';
const RESOLVER = 'Resolver Acao de Conversacao';

function replaceOnce(code, before, after) {
  assert.equal(code.split(before).length - 1, 1, `Missing or ambiguous sales anchor: ${before.slice(0, 80)}`);
  return code.replace(before, after);
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const nodes = workflow.nodes.filter(node => node.name === NODE);
  assert.equal(nodes.length, 1, 'Exactly one shared sales node is required');
  const node = nodes[0];
  let code = node.parameters.jsCode;
  if (code.includes(MARKER)) return workflow;

  code = replaceOnce(code,
    "const normalized = normalize(text);",
    `const normalized = normalize(text);
// ${MARKER}: Meta has an opaque conversation ID, never a WhatsApp number.
const metaSalesV1 = Boolean(source.metaAttendance);
if (metaSalesV1 && activeState?.step === 'awaiting_delivery_location') activeState.step = 'awaiting_delivery_address_text';
if (metaSalesV1 && activeState?.step === 'awaiting_customer_phone_confirm') activeState.step = 'awaiting_customer_phone';
const metaPaymentMethodV1 = !/[?？]/.test(text) && !/\\b(?:nao|sem)\\s+(?:o\\s+)?(?:pix|dinheiro)\\b/.test(normalized)
  ? (/\\bpix\\b/.test(normalized) ? 'pix' : /\\b(?:dinheiro|especie)\\b/.test(normalized) ? 'cash' : '') : '';
if (metaSalesV1 && metaPaymentMethodV1 && activeState?.orderDraft
  && /^(?:awaiting_purchase_confirmation|awaiting_fulfillment|awaiting_delivery_|awaiting_payment_method|awaiting_order_confirmation)/.test(String(activeState.step || ''))) {
  activeState.orderDraft.paymentMethod = metaPaymentMethodV1;
  activeState.orderDraft.paymentLabel = metaPaymentMethodV1 === 'pix' ? 'Pix' : 'dinheiro';
  activeState.updatedAt = new Date(now).toISOString();
}`);
  code = replaceOnce(code,
    "const collectionIsInterruptionV1 = collectingFieldV1 && !collectionHasLocationV1",
    `const metaAddressPaymentConfirmationV1 = metaSalesV1 && activeState?.step === 'awaiting_delivery_address_confirmation'
  && /^(?:sim|isso|correto|correta|certo|certa|confere|confirmo|esta certo|ta certo)(?:\\s+(?:no|em|via)\\s+(?:pix|dinheiro))?$/.test(normalized);
const collectionIsInterruptionV1 = collectingFieldV1 && !collectionHasLocationV1 && !metaAddressPaymentConfirmationV1`);
  code = replaceOnce(code,
    "const confirmsAddressV401 = /^(?:sim|isso|correto|correta|certo|certa|confere|confirmo|esta certo|esta correta|ta certo|pode ser)$/.test(normalized);",
    "const confirmsAddressV401 = /^(?:sim|isso|correto|correta|certo|certa|confere|confirmo|esta certo|esta correta|ta certo|pode ser)$/.test(normalized) || metaAddressPaymentConfirmationV1;");
  code = replaceOnce(code,
    "  if (confirmsPurchaseV417 && activeState?.orderDraft?.productId) {",
    `  if (metaSalesV1 && activeState?.orderDraft?.productId && !confirmsPurchaseV417
    && /\\b(?:a vista|pix|dinheiro)\\b/.test(normalized) && !/[?？]/.test(text)) {
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      output: withGreeting('Certo, você prefere pagar à vista. Confirma que quer comprar este aparelho? 😊') } }];
  }
  if (confirmsPurchaseV417 && activeState?.orderDraft?.productId) {`);
  code = replaceOnce(code,
    "  activeState.step = 'awaiting_delivery_location';\n  activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery', deliveryNeighborhood: text };",
    `  activeState.step = metaSalesV1 ? 'awaiting_delivery_address_text' : 'awaiting_delivery_location';
  activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery', deliveryNeighborhood: text };`);
  code = replaceOnce(code,
    "output: withGreeting('Obrigado. Agora me envie sua localização pelo WhatsApp usando o clipe 📎 e a opção Localização. Assim eu capto o endereço e peço sua confirmação.')",
    "output: withGreeting(metaSalesV1 ? 'Obrigado. Me envie o endereço completo, com rua e número, para eu confirmar a entrega.' : 'Obrigado. Agora me envie sua localização pelo WhatsApp usando o clipe 📎 e a opção Localização. Assim eu capto o endereço e peço sua confirmação.')");
  code = replaceOnce(code,
    "output: withGreeting('Ainda preciso da localização enviada pelo WhatsApp. Toque no clipe 📎, escolha Localização e envie sua posição atual. Se não conseguir, escreva “não consigo”.')",
    "output: withGreeting(metaSalesV1 ? 'Me envie o endereço completo por texto, com rua, número e bairro.' : 'Ainda preciso da localização enviada pelo WhatsApp. Toque no clipe 📎, escolha Localização e envie sua posição atual. Se não conseguir, escreva “não consigo”.')");
  code = replaceOnce(code,
    "  activeState.step = 'awaiting_payment_method';\n  activeState.orderDraft = { ...activeState.orderDraft, deliveryNumberComplement: text };",
    `  activeState.step = metaSalesV1 && ['pix', 'cash'].includes(activeState.orderDraft?.paymentMethod)
    ? 'awaiting_order_confirmation' : 'awaiting_payment_method';
  activeState.orderDraft = { ...activeState.orderDraft, deliveryNumberComplement: text };`);
  code = replaceOnce(code,
    "output: withGreeting('Endereco anotado. 😊' + lineBreak + paymentPrompt())",
    "output: withGreeting('Endereco anotado. 😊' + lineBreak + (activeState.step === 'awaiting_order_confirmation' ? orderSummary(activeState.orderDraft) : paymentPrompt()))");
  code = replaceOnce(code,
    "if (activeState.step === 'awaiting_order_confirmation') {\n  if (!isYes) return ask('awaiting_order_confirmation', 'Me confirma se esta tudo certo para eu seguir com o cadastro do pedido?');\n  customer();\n  return ask('awaiting_customer_full_name', 'Perfeito. Para cadastrar o pedido no sistema, me manda seu nome completo?');\n}",
    `if (activeState.step === 'awaiting_order_confirmation') {
  if (metaSalesV1 && !isYes) {
    const explicitNameV1 = text.match(/^(?:em nome de|meu nome [ée]|pode colocar em nome de)\\s+(.+)$/i)?.[1]?.trim() || '';
    if (explicitNameV1.split(/\\s+/).length >= 2 && !/\\d/.test(explicitNameV1)) {
      customer().fullName = explicitNameV1;
      activeState.updatedAt = new Date(now).toISOString();
    }
  }
  if (!isYes) return ask('awaiting_order_confirmation', 'Me confirma se esta tudo certo para eu seguir com o cadastro do pedido?');
  if (metaSalesV1 && customer().fullName) return ask('awaiting_customer_cpf', 'Perfeito. Já tenho seu nome. Agora me manda o CPF, pode ser somente os números.');
  customer();
  return ask('awaiting_customer_full_name', 'Perfeito. Para cadastrar o pedido no sistema, me manda seu nome completo?');
}`);
  code = replaceOnce(code,
    "  return ask('awaiting_customer_phone_confirm', birthday + 'O WhatsApp para o cadastro pode ser esse mesmo que voce esta falando com a gente?');",
    "  if (metaSalesV1) return ask('awaiting_customer_phone', birthday + 'Qual número de WhatsApp com DDD devemos usar para o cadastro?');\n  return ask('awaiting_customer_phone_confirm', birthday + 'O WhatsApp para o cadastro pode ser esse mesmo que voce esta falando com a gente?');");
  node.parameters.jsCode = code;
  new Function('$json', '$', '$getWorkflowStaticData', 'fetch', code);

  const resolvers = workflow.nodes.filter(candidate => candidate.name === RESOLVER);
  assert.equal(resolvers.length, 1, 'Exactly one shared conversation resolver is required');
  let resolverCode = resolvers[0].parameters.jsCode;
  resolverCode = replaceOnce(resolverCode,
    'const decision = birthdayCorrectionV372 || deterministicStoreVisitV638',
    `// ${MARKER}: an in-progress Meta order owns payment preferences, not the general PayJoy policy.
const metaOrderStateV1 = source.metaAttendance ? getActivePostList() : null;
const metaOrderTextV1 = normalize(text);
const metaOrderPreferenceV1 = metaOrderStateV1?.flow === 'sales_post_list'
  && Boolean(metaOrderStateV1?.orderDraft?.productId)
  && /^(?:awaiting_purchase_confirmation|awaiting_delivery_address_confirmation|awaiting_payment_method)$/.test(String(metaOrderStateV1.step || ''))
  && !/[?？]/.test(text) && !/\\b(?:payjoy|boleto|parcelamento|cartao|credito|debito)\\b/.test(metaOrderTextV1)
  && /\\b(?:pix|dinheiro|a vista)\\b/.test(metaOrderTextV1)
  ? { acao: 'continuar_pedido', intencao: 'preferencia_pagamento_pedido', confianca: 1,
      motivo: 'Preservar a escolha de pagamento no pedido Meta em andamento.' } : null;
const decision = metaOrderPreferenceV1 || birthdayCorrectionV372 || deterministicStoreVisitV638`);
  resolvers[0].parameters.jsCode = resolverCode;
  new Function('$json', '$', '$getWorkflowStaticData', resolverCode);
  return workflow;
}

module.exports = { patchWorkflow, MARKER, NODE, RESOLVER };
