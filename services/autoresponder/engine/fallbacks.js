import { resolveAutoresponderMessage } from './messages.js';

const CONTEXTUAL_FALLBACK_KEYS = {
  'delivery.awaiting_cep': 'fallback.delivery_awaiting_cep',
  'product_search.awaiting_choice': 'fallback.product_choice',
  'purchase.awaiting_action': 'fallback.purchase_action',
  'purchase.awaiting_variation': 'fallback.purchase_variation',
  'purchase.awaiting_quantity': 'fallback.purchase_quantity',
  'purchase.item_added': 'fallback.purchase_item_added',
  'purchase.awaiting_fulfillment': 'fallback.purchase_fulfillment',
  'delivery.awaiting_number': 'fallback.delivery_awaiting_number',
  'payment.awaiting_method': 'fallback.payment_method',
  'payment.awaiting_payment_method': 'fallback.payment_method',
  'customer_data.awaiting_name': 'fallback.customer_name',
  'customer_data.awaiting_document': 'fallback.customer_document',
  'handoff.ready': 'fallback.handoff_ready',
};

function buildContextualFallback(state, settings = null) {
  const key = `${state?.flow || 'none'}.${state?.step || 'idle'}`;
  const messageKey = CONTEXTUAL_FALLBACK_KEYS[key] || 'fallback.global';
  const message = resolveAutoresponderMessage(settings, messageKey) || buildGlobalFallback(settings).message;
  return {
    message,
    intent: 'contextual_fallback',
    nextState: state,
    matchedCount: 0,
    matchedProducts: [],
  };
}

function buildGlobalFallback(settings = null) {
  return {
    message: resolveAutoresponderMessage(settings, 'fallback.global'),
    intent: 'global_fallback',
    nextState: {
      flow: 'none',
      step: 'idle',
      data: {},
      last_intent: 'global_fallback',
      expires_at: null,
    },
    matchedCount: 0,
    matchedProducts: [],
  };
}

export {
  buildContextualFallback,
  buildGlobalFallback,
  CONTEXTUAL_FALLBACK_KEYS,
};
