import assert from 'node:assert/strict';
import { deliveryFlowHandler } from '../services/autoresponder/engine/flows/delivery.js';

const cartItems = [
  { product_id: 1, name: 'Produto Teste', quantity: 2, subtotal_cents: 2000 },
];
let receivedItems = null;

const reply = await deliveryFlowHandler.handle({
  message: '56320690',
  state: {
    flow: 'delivery',
    step: 'awaiting_cep',
    data: { items: cartItems },
    last_intent: 'purchase_delivery_cep_prompt',
    expires_at: null,
  },
  settings: {},
  context: {
    lookupCep: async (cep) => ({ cep, street: 'Rua Teste', neighborhood: 'Centro', city: 'Petrolina', state: 'PE' }),
    calculateShippingOptions: async (_cep, items) => {
      receivedItems = items;
      return [{ name: 'Entrega local', price: 'R$ 10,00', isFree: false }];
    },
  },
});

assert.equal(reply.intent, 'delivery_cep_quote');
assert.deepEqual(receivedItems, cartItems, 'delivery engine must calculate freight with cart items from state data');

console.log('autoresponder delivery engine cart item tests passed');
