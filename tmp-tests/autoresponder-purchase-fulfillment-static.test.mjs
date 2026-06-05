import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function getAutoresponderPurchaseFulfillmentChoice',
    'function normalizeAutoresponderDeliveryAddress',
    'function buildAutoresponderPickupConfirmationReply',
    'function buildAutoresponderDeliveryAddressPrompt',
    'function buildAutoresponderDeliveryAddressSavedReply',
    "purchaseFlow.status === 'summary_ready'",
    "purchaseFlow.status === 'awaiting_delivery_address'",
    "purchaseFlow.status === 'awaiting_delivery_cep_confirmation'",
    "purchaseFlow.status === 'awaiting_delivery_number'",
    "fulfillment: 'pickup'",
    "fulfillment: 'delivery'",
    "status: 'customer_data_pending'",
    "status: 'awaiting_delivery_address'",
    "status: 'awaiting_delivery_cep_confirmation'",
    "status: 'awaiting_delivery_number'",
    'delivery_address: deliveryAddress',
    "intent: 'purchase_fulfillment_pickup'",
    "intent: 'purchase_fulfillment_delivery'",
    "intent: 'purchase_delivery_cep_quote'",
    "intent: 'purchase_delivery_number_saved'",
    'retirada na loja',
    'CEP da entrega',
    'Endereco anotado',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'summary_ready'") < source.indexOf("purchaseFlow.status === 'awaiting_product_action'"),
    `${fileName} must handle fulfillment choice before product action flow`
  );
}

const doc = readBotWhatsappDoc(root);
assert(doc.includes('- [x] Confirmar se sera retirada na loja ou entrega'), 'Bot_Whatsapp.md must mark fulfillment checklist item');
assert(doc.includes('- [x] Se entrega, coletar endereco completo'), 'Bot_Whatsapp.md must mark delivery address checklist item');
assert(doc.includes('- [x] Entrega coleta endereco antes de fechar'), 'Bot_Whatsapp.md must mark delivery address test item');
assert(doc.includes('- [x] Retirada nao pede endereco'), 'Bot_Whatsapp.md must mark pickup test item');
assert(doc.includes('tmp-tests/autoresponder-purchase-fulfillment-static.test.mjs'), 'Bot_Whatsapp.md must mention fulfillment test');

console.log('autoresponder purchase fulfillment static checks passed');
