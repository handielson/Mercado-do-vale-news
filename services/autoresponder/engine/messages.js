const AUTORESPONDER_MESSAGE_KEYS = {
  'delivery.ask_cep': 'Fazemos entrega sim. Me envie seu CEP com 8 numeros para consultar rapidinho.',
  'delivery.cep_not_found': 'Nao consegui encontrar esse CEP. Confira os 8 numeros e me envie novamente.',
  'delivery.cep_found_no_rule': 'Nao encontrei uma regra automatica de frete para esse CEP. Um atendente confirma o valor certinho.',
  'delivery.choose_product_after_cep': 'Para fechar o valor com produto, responda com o numero ou nome do item que voce quer.',
  'product_search.choice_prompt': 'vamos ficar com qual deles hoje? quer ver a lista completa?',
  'product_search.more_prompt': 'Se quiser ver mais opcoes, digite "mais".',
  'purchase.variation_prompt': 'Antes de seguir, escolha a cor/variacao disponivel:\n\n{opcoes}\n\nResponda com o numero ou com a cor desejada.',
  'fallback.global': 'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?',
  'fallback.delivery_awaiting_cep': 'Me envie apenas os 8 numeros do CEP. Ex: 56320690',
  'fallback.product_choice': 'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.',
  'fallback.purchase_action': 'Responda comprar, detalhes ou escolha outro produto.',
  'fallback.purchase_variation': 'Responda com o numero ou a cor desejada.',
  'fallback.purchase_quantity': 'Me envie a quantidade em numero. Ex: 1',
  'fallback.purchase_item_added': 'Responda finalizar, adicionar mais ou remover item.',
  'fallback.purchase_fulfillment': 'Voce prefere entrega ou retirada na loja?',
  'fallback.delivery_awaiting_number': 'Me envie o numero da residencia e complemento, se tiver.',
  'fallback.payment_method': 'Voce prefere Pix, dinheiro, debito ou cartao?',
  'fallback.customer_name': 'Me envie seu nome completo para finalizar.',
  'fallback.customer_document': 'Me envie CPF ou CNPJ para finalizar o cadastro.',
  'fallback.handoff_ready': 'Vou deixar seu pedido pronto para um atendente finalizar.',
};

function parseMessageConfig(settings) {
  if (!settings?.conversation_flow_messages) return {};
  if (typeof settings.conversation_flow_messages === 'string') {
    try {
      const parsed = JSON.parse(settings.conversation_flow_messages);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof settings.conversation_flow_messages === 'object' ? settings.conversation_flow_messages : {};
}

function resolveAutoresponderMessage(settings, key, replacements = {}) {
  const configured = parseMessageConfig(settings);
  let template = String(configured[key] || AUTORESPONDER_MESSAGE_KEYS[key] || '');
  for (const [name, value] of Object.entries(replacements)) {
    template = template.split(`{${name}}`).join(String(value ?? ''));
  }
  return template;
}

export {
  AUTORESPONDER_MESSAGE_KEYS,
  resolveAutoresponderMessage,
};
