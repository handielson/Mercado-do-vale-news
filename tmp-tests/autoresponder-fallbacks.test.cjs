const assert = require('node:assert/strict');
const {
  buildContextualFallback,
  buildGlobalFallback,
} = require('../services/autoresponder/engine/fallbacks.js');

assert.equal(
  buildContextualFallback({ flow: 'delivery', step: 'awaiting_cep' }).message,
  'Me envie apenas os 8 numeros do CEP. Ex: 56320690'
);

assert.equal(
  buildContextualFallback({ flow: 'product_search', step: 'awaiting_choice' }).message,
  'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.'
);

const settings = {
  conversation_flow_messages: {
    'fallback.purchase_action': 'Mensagem editada para acao de compra.',
    'fallback.payment_method': 'Mensagem editada para pagamento.',
    'fallback.global': 'Mensagem global editada.',
  },
};

assert.equal(
  buildContextualFallback({ flow: 'purchase', step: 'awaiting_action' }, settings).message,
  'Mensagem editada para acao de compra.'
);

assert.equal(
  buildContextualFallback({ flow: 'payment', step: 'awaiting_payment_method' }, settings).message,
  'Mensagem editada para pagamento.'
);

assert.equal(
  buildGlobalFallback().message,
  'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?'
);

assert.equal(
  buildGlobalFallback(settings).message,
  'Mensagem global editada.'
);

console.log('autoresponder fallback tests passed');
