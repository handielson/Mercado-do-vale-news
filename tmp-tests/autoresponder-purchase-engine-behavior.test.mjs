import assert from 'node:assert/strict';
import { purchaseFlowHandler } from '../services/autoresponder/engine/flows/purchase.js';

const baseState = {
  flow: 'payment',
  step: 'awaiting_payment_method',
  data: {
    items: [
      { product_id: 1, name: 'Produto Teste', quantity: 1, unit_price_cents: 1000, subtotal_cents: 1000 },
    ],
  },
  last_intent: null,
  expires_at: null,
};

const pixReply = await purchaseFlowHandler.handle({
  message: 'pix',
  state: baseState,
  settings: {},
  context: {
    parsePaymentMethod: () => 'pix',
    buildSelectedPayment: (method) => ({
      method,
      label: 'Pix',
      total_cents: 1000,
      base_total_cents: 1000,
    }),
    buildCustomerNamePrompt: () => 'Nome completo?',
  },
});

assert.equal(pixReply.intent, 'purchase_customer_name_prompt');
assert.equal(pixReply.nextState.flow, 'customer_data');
assert.equal(pixReply.nextState.step, 'awaiting_name');
assert.deepEqual(pixReply.nextState.data.payment, {
  method: 'pix',
  label: 'Pix',
  total_cents: 1000,
  base_total_cents: 1000,
});

const creditReply = await purchaseFlowHandler.handle({
  message: 'credito',
  state: baseState,
  settings: {},
  context: {
    parsePaymentMethod: () => 'credit',
    buildSelectedPayment: () => null,
    buildCustomerNamePrompt: () => 'Nome completo?',
  },
});

assert.equal(creditReply, null, 'credit payment must fall back to legacy card flow');

const handoffReply = await purchaseFlowHandler.handle({
  message: '12345678901',
  state: {
    flow: 'customer_data',
    step: 'awaiting_document',
    data: { customer_name: 'Cliente Teste', items: baseState.data.items },
    last_intent: null,
    expires_at: null,
  },
  settings: {},
  context: {
    parseCustomerDocument: () => '12345678901',
    buildHandoffReadyReply: () => 'Pedido pronto',
  },
});

assert.equal(handoffReply.intent, 'purchase_handoff_ready');
assert.equal(handoffReply.nextState.flow, 'handoff');
assert.equal(handoffReply.nextState.step, 'ready');
assert.equal(handoffReply.nextState.data.customer_document, '12345678901');
assert.equal(handoffReply.message, 'Pedido pronto');

console.log('autoresponder purchase engine behavior tests passed');
