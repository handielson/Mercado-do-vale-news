const fs = require('fs');

function readEnv(name) {
  for (const file of ['.env.vps.local', '.env.local', '.env', '.env.production']) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      if (key.trim() === name) return rest.join('=').trim().replace(/^"|"$/g, '');
    }
  }
  return process.env[name] || '';
}

const apiBase = process.env.AUTORESPONDER_TEST_API || 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.SYNC_SECRET || readEnv('SYNC_SECRET');

if (!syncKey) throw new Error('Missing SYNC_SECRET for /autoresponder/test-flow');

function responseText(result) {
  return JSON.stringify(result);
}

function collectReplyText(result) {
  return (result.steps || [])
    .flatMap((step) => step.replies || [])
    .map((reply) => String(reply.message || ''))
    .join('\n');
}

function stepReplyText(result, index) {
  const step = result.steps?.find((item) => item.index === index);
  return (step?.replies || []).map((reply) => reply.message || '').join('\n');
}

function lastReplyText(result) {
  const replies = (result.steps || []).flatMap((step) => step.replies || []);
  return String(replies.at(-1)?.message || '');
}

function normalizeCep(value) {
  return String(value || '').replace(/\D/g, '');
}

function assertIncludesAny(text, needles, message) {
  if (!needles.some((needle) => text.includes(needle))) {
    throw new Error(message);
  }
}

const scenarios = [
  {
    name: 'product search footer',
    messages: ['redmi note 15'],
    assert: (result) => {
      const text = responseText(result);
      if (!text.includes('vamos ficar com qual deles hoje?')) {
        throw new Error('product footer did not include new choice prompt');
      }
    },
  },
  {
    name: 'standalone delivery cep',
    messages: ['faz entrega?', '56320690'],
    assert: (result) => {
      const text = responseText(result);
      assertIncludesAny(text, ['Atendemos esse CEP', 'Encontrei este endereco'], 'delivery CEP was not consulted');
      if (text.includes('instabilidade')) {
        throw new Error('delivery CEP scenario returned instability fallback');
      }
    },
  },
  {
    name: 'purchase delivery shipping',
    messages: ['redmi note 15', '1', 'comprar', '1', '1', 'finalizar', 'entrega', '56320690'],
    assert: (result) => {
      const text = collectReplyText(result);
      const flow = result.final_purchase_flow || {};
      if (result.steps?.length !== 8) {
        throw new Error('purchase delivery did not process all messages');
      }
      if (!Array.isArray(flow.items) || flow.items.length === 0) {
        throw new Error('purchase delivery lost cart items');
      }
      if (flow.fulfillment !== 'delivery') {
        throw new Error('purchase delivery did not keep fulfillment=delivery');
      }
      if (flow.status !== 'awaiting_delivery_cep_confirmation') {
        throw new Error('purchase delivery did not wait for CEP confirmation');
      }
      if (normalizeCep(flow.delivery_address_lookup?.cep) !== '56320690') {
        throw new Error('purchase delivery did not persist the looked up CEP');
      }
      if (!flow.delivery_address_lookup?.city && !flow.delivery_address_lookup?.street) {
        throw new Error('purchase delivery did not persist address lookup data');
      }
      if (!flow.shipping_quote && (!Array.isArray(flow.shipping_options) || flow.shipping_options.length === 0)) {
        throw new Error('purchase delivery did not persist shipping_quote');
      }
      if (/instabilidade/i.test(text)) {
        throw new Error('purchase delivery returned instability fallback');
      }
      if (!/\bfrete\b/i.test(text)) {
        throw new Error('purchase delivery reply did not mention freight');
      }
      if (!/numero|número|complemento/i.test(text)) {
        throw new Error('purchase delivery did not ask for number/complement');
      }
    },
  },
  {
    name: 'purchase delivery cep replacement',
    messages: ['redmi note 15', '1', 'comprar', '1', '1', 'finalizar', 'entrega', '56320690', '56330000'],
    assert: (result) => {
      const text = collectReplyText(result);
      const flow = result.final_purchase_flow || {};
      if (result.steps?.length !== 9) {
        throw new Error('replacement CEP flow did not process all messages');
      }
      if (!Array.isArray(flow.items) || flow.items.length === 0) {
        throw new Error('replacement CEP flow lost cart items');
      }
      if (flow.fulfillment !== 'delivery') {
        throw new Error('replacement CEP flow did not keep fulfillment=delivery');
      }
      if (flow.status !== 'awaiting_delivery_cep_confirmation') {
        throw new Error('replacement CEP did not produce a fresh confirmation quote');
      }
      if (normalizeCep(flow.delivery_address_lookup?.cep) !== '56330000') {
        throw new Error('replacement CEP was not persisted as the latest lookup');
      }
      if (normalizeCep(flow.delivery_address?.cep) === '56320690') {
        throw new Error('old CEP should not become the confirmed address');
      }
      if (!flow.shipping_quote && (!Array.isArray(flow.shipping_options) || flow.shipping_options.length === 0)) {
        throw new Error('replacement CEP flow did not recalculate shipping');
      }
      if (/CEP da entrega/i.test(lastReplyText(result))) {
        throw new Error('replacement CEP merely reset to the CEP prompt');
      }
      if (/instabilidade/i.test(text)) {
        throw new Error('replacement CEP flow returned instability fallback');
      }
    },
  },
  {
    name: 'purchase pickup payment name prompt',
    messages: ['redmi note 15', '1', 'comprar', '1', '1', 'finalizar', 'retirada', 'pix'],
    assert: (result) => {
      const text = collectReplyText(result);
      const flow = result.final_purchase_flow || {};
      if (result.steps?.length !== 8) {
        throw new Error('pickup payment flow did not process all messages');
      }
      if (!Array.isArray(flow.items) || flow.items.length === 0) {
        throw new Error('pickup payment flow lost cart items');
      }
      if (flow.fulfillment !== 'pickup') {
        throw new Error('pickup payment flow did not keep fulfillment=pickup');
      }
      if (!['customer_data_pending', 'awaiting_customer_full_name'].includes(flow.status)) {
        throw new Error('pickup payment flow did not advance to customer data collection');
      }
      if (!flow.selected_payment || flow.selected_payment.method !== 'pix') {
        throw new Error('pickup payment flow did not persist selected pix payment');
      }
      if (!/cadastro|nome completo|seu nome|nome/i.test(text)) {
        throw new Error('pickup payment flow reply did not ask for customer data');
      }
      if (/instabilidade/i.test(text)) {
        throw new Error('pickup payment flow returned instability fallback');
      }
    },
  },
  {
    name: 'delivery cep contextual fallback',
    messages: ['faz entrega?', 'nao sei'],
    assert: (result) => {
      const text = responseText(result);
      assertIncludesAny(text, ['CEP da entrega', '8 numeros', 'somente os numeros'], 'delivery fallback did not ask for a CEP');
    },
  },
];

async function runScenario(scenario) {
  const response = await fetch(`${apiBase}/autoresponder/test-flow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
    },
    body: JSON.stringify({
      sender: `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      messages: scenario.messages,
      cleanup: true,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${scenario.name} failed HTTP ${response.status}: ${JSON.stringify(body)}`);
  scenario.assert(body);
  console.log(`PASS ${scenario.name}`);
}

(async () => {
  for (const scenario of scenarios) await runScenario(scenario);
})();
