import assert from 'node:assert/strict';
import { productSearchFlowHandler } from '../services/autoresponder/engine/flows/product-search.js';

const canHandlePurchase = productSearchFlowHandler.canHandle({
  message: 'comprar',
  state: {
    flow: 'purchase',
    step: 'awaiting_action',
    data: { selected_product: { id: 'produto-1', name: 'Redmi Teste' } },
    last_intent: 'product_selected',
    expires_at: null,
  },
  context: { productSearchTokens: ['comprar'] },
});

assert.equal(canHandlePurchase, false, 'product search must not intercept an active purchase flow');

const canHandleChoice = productSearchFlowHandler.canHandle({
  message: '1',
  state: {
    flow: 'product_search',
    step: 'awaiting_choice',
    data: { options: [{ id: 'produto-1', name: 'Redmi Teste' }] },
    last_intent: 'product_search',
    expires_at: null,
  },
  context: { productSearchTokens: [] },
});

assert.equal(canHandleChoice, true, 'product search must keep handling its own awaiting_choice state');

console.log('autoresponder product search active flow guard tests passed');
