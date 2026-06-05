function buildContextualFallback(state) {
  const key = `${state?.flow || 'none'}.${state?.step || 'idle'}`;
  const messages = {
    'delivery.awaiting_cep': 'Me envie apenas os 8 numeros do CEP. Ex: 56320690',
    'product_search.awaiting_choice': 'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.',
    'purchase.awaiting_quantity': 'Me envie a quantidade em numero. Ex: 1',
    'purchase.awaiting_fulfillment': 'Voce prefere entrega ou retirada na loja?',
    'payment.awaiting_method': 'Voce prefere Pix, dinheiro, debito ou cartao?',
    'customer_data.awaiting_name': 'Me envie seu nome completo para finalizar.',
  };

  const message = messages[key] || buildGlobalFallback().message;
  return {
    message,
    intent: 'contextual_fallback',
    nextState: state,
    matchedCount: 0,
    matchedProducts: [],
  };
}

function buildGlobalFallback() {
  return {
    message: 'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?',
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
};
