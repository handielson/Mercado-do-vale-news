'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const snapshot = process.env.MDV_ATTENDANCE_SNAPSHOT;
assert.ok(snapshot, 'MDV_ATTENDANCE_SNAPSHOT must identify the exact candidate');
const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const jid = 'synthetic-test-only@s.whatsapp.net';
const node = (name) => {
  const found = workflow.nodes.find((entry) => entry.name === name);
  assert.ok(found, `Missing node: ${name}`);
  return found;
};
const runCode = (name, input, source, state) => new Function(
  '$json', '$', '$getWorkflowStaticData', 'fetch', node(name).parameters.jsCode,
)(input, () => ({ first: () => ({ json: source }), all: () => [{ json: source }] }),
  () => state, async () => { throw new Error('External network forbidden in offline smoke'); });
const hours = Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((day) => [day, { isOpen: true, openTime: '08:00', closeTime: '18:00' }]),
);

function initialState() {
  return { salesPostList: { [jid]: {
    flow: 'sales_post_list', step: 'awaiting_fulfillment', expiresAt: Date.now() + 60000,
    options: [{ number: 1, name: 'Fixture', memory: '8GB/256GB', price: 'R$ 1.224,00',
      colors: [{ productId: 'fixture', color: 'Roxo', memory: '8GB/256GB', price: 'R$ 1.224,00', priceCents: 122400 }] }],
    orderDraft: { productId: 'fixture', name: 'Fixture', memory: '8GB/256GB', color: 'Roxo',
      price: 'R$ 1.224,00', unitPriceCents: 122400, quantity: 1,
      fulfillment: 'delivery', customer: { fullName: 'Cliente Teste' } },
  } } };
}

async function turn(state, text, intent, settings) {
  const source = { remoteJid: jid, conversation: text,
    salesConversationState: { ativo: true, step: state.salesPostList[jid].step } };
  const parsed = (await runCode('Parse Classificacao', {
    output: JSON.stringify({ intencao: intent, confianca: 0.99,
      collection_reply: { decision: 'field_value', confidence: 0.99 } }),
  }, source, state))[0].json;
  const decision = (await runCode('Vendas - Verificar Pos Lista', settings, parsed, state))[0].json;
  const messages = (await runCode('Dividir mensagens', decision, source, state)).map((entry) => entry.json);
  assert.ok(messages.length > 0, `No final outbound after: ${text}`);
  assert.ok(messages.every((message) => message.remoteJid === jid));
  return messages;
}

function renderSendBody(message) {
  // Evaluate outgoing HTTP fields as data; never call HTTP or the Evolution API.
  const params = node('Enviar WhatsApp').parameters.bodyParameters.parameters;
  return Object.fromEntries(params.map(({ name, value }) => {
    assert.match(value, /^=\{\{[\s\S]*\}\}$/);
    return [name, new Function('$json', `return (${value.slice(3, -2)});`)(message)];
  }));
}

test('pickup choice survives a separate pickup-time turn and reaches final WhatsApp payload', async () => {
  const state = initialState();
  const first = await turn(state, 'Não quero entrega, vou retirar na loja', 'entrega_frete', {});
  assert.equal(state.salesPostList[jid].step, 'awaiting_pickup_time');
  assert.equal(state.salesPostList[jid].orderDraft.fulfillment, 'pickup');
  assert.match(first.map((part) => part.message).join('\n'), /google\.com\/maps\/search/);
  assert.doesNotMatch(first.map((part) => part.message).join('\n'), /entregar|frete/i);

  const second = await turn(state, 'Vou retirar às 16h', 'fallback', { business_hours: hours });
  assert.equal(state.salesPostList[jid].step, 'awaiting_payment_method');
  assert.equal(state.salesPostList[jid].orderDraft.fulfillment, 'pickup');
  assert.equal(state.salesPostList[jid].orderDraft.pickupTime, '16:00');
  assert.match(second.map((part) => part.message).join('\n'), /Pix, cartao ou dinheiro/);
  const bodies = second.map(renderSendBody);
  assert.ok(bodies.every((body, index) => body.number === 'synthetic-test-only'
    && body.text === second[index].message && body.delay === 1200));
});
