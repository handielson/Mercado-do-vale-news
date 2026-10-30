'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, NODE, RESOLVER, MARKER } = require('../scripts/n8n-meta-sales-parity.cjs');

const workflowPath = process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT || require('node:path').join(__dirname, '..', '.local', 'meta-current-workflow.private.json');
const original = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const workflow = patchWorkflow(original);
const code = workflow.nodes.find(node => node.name === NODE).parameters.jsCode;
const resolverCode = workflow.nodes.find(node => node.name === RESOLVER).parameters.jsCode;
const metaJid = 'meta:messenger:page:fixture:dm';
const waJid = '5587900000000@s.whatsapp.net';
const option = { number: 1, name: 'Modelo Teste', memory: '8GB/256GB', price: 'R$ 1.200,00',
  colors: [{ productId: 'fixture-product', color: 'Preto', memory: '8GB/256GB', price: 'R$ 1.200,00', priceCents: 120000 }] };
const baseDraft = () => ({ productId: 'fixture-product', name: 'Modelo Teste', memory: '8GB/256GB',
  color: 'Preto', price: 'R$ 1.200,00', unitPriceCents: 120000, quantity: 1,
  fulfillment: 'delivery', customer: {} });

async function run({ channel = 'meta', step, message, draft = baseDraft(), extraSource = {} }) {
  const jid = channel === 'meta' ? metaJid : waJid;
  const staticData = { salesPostList: { [jid]: { flow: 'sales_post_list', step,
    expiresAt: Date.now() + 60000, updatedAt: new Date().toISOString(),
    categoryId: '8b7c4852-c195-4527-8fd7-c3cc2debda42', options: [option],
    selectedOptionNumber: 1, selectedColor: 'Preto', orderDraft: draft } } };
  const source = { remoteJid: jid, conversation: message,
    ...(channel === 'meta' ? { metaAttendance: { channel: 'messenger' } } : {}), ...extraSource };
  const result = (await new Function('$json', '$', '$getWorkflowStaticData', 'fetch', code)(
    {}, () => ({ first: () => ({ json: source }) }), () => staticData,
    async () => { throw new Error('No external requests in this fixture'); }
  ))[0].json;
  return { result, state: staticData.salesPostList[jid] };
}

function resolve({ channel = 'meta', step, message, aiAction = 'responder_politica_pagamento' }) {
  const jid = channel === 'meta' ? metaJid : waJid;
  const staticData = { salesPostList: { [jid]: { flow: 'sales_post_list', step,
    expiresAt: Date.now() + 60000, orderDraft: baseDraft(), options: [option] } } };
  const source = { remoteJid: jid, conversation: message,
    ...(channel === 'meta' ? { metaAttendance: { channel: 'messenger' } } : {}) };
  return new Function('$json', '$', '$getWorkflowStaticData', resolverCode)(
    { ...source, output: JSON.stringify({ acao: aiAction, intencao: 'pagamento', confianca: 0.99 }) },
    () => ({ first: () => ({ json: source }) }), () => staticData
  )[0].json;
}

test('patch changes only the existing shared sales node and is idempotent', () => {
  assert.ok(code.includes(MARKER));
  assert.deepEqual(patchWorkflow(workflow), workflow);
  assert.deepEqual(workflow.connections, original.connections);
  for (const before of original.nodes) {
    if (![NODE, RESOLVER].includes(before.name)) assert.deepEqual(workflow.nodes.find(node => node.id === before.id), before);
  }
});

test('Meta cash preference stays in the selected product and asks for purchase confirmation', async () => {
  assert.equal(resolve({ step: 'awaiting_purchase_confirmation', message: 'Quero à vista' }).conversationAction, 'continuar_pedido');
  assert.equal(resolve({ channel: 'wa', step: 'awaiting_purchase_confirmation', message: 'Quero à vista' }).conversationAction, 'responder_politica_pagamento');
  const meta = await run({ step: 'awaiting_purchase_confirmation', message: 'Quero à vista' });
  assert.equal(meta.state.step, 'awaiting_purchase_confirmation');
  assert.equal(meta.result.salesPostListHandled, true);
  assert.match(meta.result.output, /Confirma que quer comprar/i);
  assert.doesNotMatch(meta.result.output, /PayJoy/i);
  const wa = await run({ channel: 'wa', step: 'awaiting_purchase_confirmation', message: 'Quero à vista' });
  assert.notEqual(wa.result.output, meta.result.output);
});

test('Meta order payment facts route to the order, while explicit PayJoy questions retain policy routing', () => {
  assert.equal(resolve({ step: 'awaiting_delivery_address_confirmation', message: 'Sim no Pix' }).conversationAction, 'continuar_pedido');
  assert.equal(resolve({ step: 'awaiting_payment_method', message: 'Dinheiro' }).conversationAction, 'continuar_pedido');
  assert.equal(resolve({ step: 'awaiting_purchase_confirmation', message: 'Como funciona PayJoy?' }).conversationAction, 'responder_politica_pagamento');
});

test('Meta remembers Pix while confirming an address and does not ask payment again', async () => {
  const addressDraft = { ...baseDraft(), deliveryAddress: { street: 'Rua Teste', neighborhood: 'Centro', city: 'Juazeiro', state: 'BA', cep: '48903000' } };
  const confirmed = await run({ step: 'awaiting_delivery_address_confirmation', message: 'Sim no Pix', draft: addressDraft });
  assert.equal(confirmed.result.salesPostListHandled, true);
  assert.equal(confirmed.state.step, 'awaiting_delivery_number_complement');
  assert.equal(confirmed.state.orderDraft.paymentMethod, 'pix');
  const number = await run({ step: 'awaiting_delivery_number_complement', message: 'N. 08', draft: confirmed.state.orderDraft });
  assert.equal(number.state.step, 'awaiting_order_confirmation');
  assert.match(number.result.output, /Pagamento: Pix/);
  assert.doesNotMatch(number.result.output, /Pix, cartao ou dinheiro/i);
});

test('Meta uses a name already given before order confirmation', async () => {
  const named = await run({ step: 'awaiting_order_confirmation', message: 'Em nome de Maria da Silva' });
  assert.equal(named.state.orderDraft.customer.fullName, 'Maria da Silva');
  assert.equal(named.state.step, 'awaiting_order_confirmation');
  const confirmed = await run({ step: 'awaiting_order_confirmation', message: 'Está tudo certo', draft: named.state.orderDraft });
  assert.equal(confirmed.state.step, 'awaiting_customer_cpf');
  assert.doesNotMatch(confirmed.result.output, /nome completo/i);
});

test('Meta asks for a real WhatsApp number instead of treating a Messenger ID as one', async () => {
  const result = await run({ step: 'awaiting_customer_birthdate', message: '20/02/1990' });
  assert.equal(result.state.step, 'awaiting_customer_phone');
  assert.match(result.result.output, /número de WhatsApp com DDD/i);
  const wa = await run({ channel: 'wa', step: 'awaiting_customer_birthdate', message: '20/02/1990' });
  assert.equal(wa.state.step, 'awaiting_customer_phone_confirm');
});

test('Meta asks for a typed address after a neighborhood; WhatsApp retains its location flow', async () => {
  const meta = await run({ step: 'awaiting_delivery_neighborhood', message: 'Centro' });
  assert.equal(meta.state.step, 'awaiting_delivery_address_text');
  assert.doesNotMatch(meta.result.output, /pelo WhatsApp usando o clipe/i);
  const wa = await run({ channel: 'wa', step: 'awaiting_delivery_neighborhood', message: 'Centro' });
  assert.equal(wa.state.step, 'awaiting_delivery_location');
});
