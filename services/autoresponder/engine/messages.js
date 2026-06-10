const AUTORESPONDER_MESSAGE_KEYS = {
  'delivery.ask_cep': 'Fazemos entrega sim. Me envie seu CEP com 8 numeros para consultar rapidinho.',
  'delivery.cep_not_found': 'Nao consegui encontrar esse CEP. Confira os 8 numeros e me envie novamente.',
  'delivery.cep_found_no_rule': 'Nao encontrei uma regra automatica de frete para esse CEP. Um atendente confirma o valor certinho.',
  'delivery.choose_product_after_cep': 'Para fechar o valor com produto, responda com o numero ou nome do item que voce quer.',
  'product_search.choice_prompt': '',
  'product_search.more_prompt': '',
  'fallback.global': 'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?',
  'fallback.delivery_awaiting_cep': 'Me envie apenas os 8 numeros do CEP. Ex: 56320690',
  'fallback.product_choice': 'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.',
  'fallback.purchase_quantity': 'Me envie a quantidade em numero. Ex: 1',
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
