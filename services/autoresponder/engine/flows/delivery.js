import { buildContextualFallback } from '../fallbacks.js';

function normalizeCep(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.length === 8 ? digits : '';
}

function isDeliveryQuestion(message) {
  const text = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(entrega|entregar|delivery|frete|motoboy|enviar|mandar)\b/.test(text);
}

function buildAskCepReply() {
  return {
    message: 'Fazemos entrega sim. Me envie seu CEP com 8 numeros para consultar rapidinho.',
    intent: 'delivery_cep_prompt',
    nextState: {
      flow: 'delivery',
      step: 'awaiting_cep',
      data: {},
      last_intent: 'delivery_question',
      expires_at: null,
    },
    matchedCount: 0,
    matchedProducts: [],
  };
}

function buildCepReply(address, shippingOptions, stateData = {}) {
  const firstOption = Array.isArray(shippingOptions) ? shippingOptions[0] : null;
  const lines = [
    'Atendemos esse CEP:',
    `Rua: ${address.street || 'nao informado'}`,
    `Bairro: ${address.neighborhood || 'nao informado'}`,
    `Cidade: ${address.city || 'nao informado'} - ${address.state || ''}`.trim(),
    `CEP: ${address.cep || 'nao informado'}`,
    '',
  ];

  if (firstOption) {
    lines.push('Frete estimado:');
    lines.push(`${firstOption.name}: ${firstOption.isFree ? 'Gratis' : firstOption.price}`);
  } else {
    lines.push('Nao encontrei uma regra automatica de frete para esse CEP. Um atendente confirma o valor certinho.');
  }

  return {
    message: lines.join('\n'),
    intent: 'delivery_cep_quote',
    nextState: {
      flow: 'none',
      step: 'idle',
      data: { ...stateData, address, shippingOptions: shippingOptions || [] },
      last_intent: 'delivery_cep_quote',
      expires_at: null,
    },
    matchedCount: Array.isArray(shippingOptions) ? shippingOptions.length : 0,
    matchedProducts: shippingOptions || [],
  };
}

const deliveryFlowHandler = {
  name: 'delivery',
  canHandle({ message, state }) {
    return state.flow === 'delivery' || isDeliveryQuestion(message);
  },
  async handle({ message, state, context }) {
    if (state.flow !== 'delivery' && isDeliveryQuestion(message)) {
      return buildAskCepReply();
    }

    if (state.flow === 'delivery' && state.step === 'awaiting_cep') {
      const cep = normalizeCep(message);
      if (!cep) return buildContextualFallback(state, settings);
      const address = await context.lookupCep(cep);
      if (!address) return buildContextualFallback(state, settings);
      const cartItems = Array.isArray(state.data?.items) ? state.data.items : [];
      const shippingOptions = await context.calculateShippingOptions(cep, cartItems, address);
      return buildCepReply(address, shippingOptions, state.data);
    }

    return buildContextualFallback(state, settings);
  },
};

export {
  deliveryFlowHandler,
  normalizeCep,
  isDeliveryQuestion,
  buildAskCepReply,
  buildCepReply,
};
