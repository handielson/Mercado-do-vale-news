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
    'async function getAutoresponderCustomerDataSnapshot',
    'function buildAutoresponderCustomerDataConfirmationReply',
    'function buildAutoresponderCustomerDataConfirmedReply',
    'function buildAutoresponderCustomerDataNeedsUpdateReply',
    "purchaseFlow.status === 'customer_data_pending'",
    "status: 'awaiting_customer_confirmation'",
    "status: 'customer_registration_ready'",
    "status: 'customer_record_ready'",
    "status: 'customer_data_update_needed'",
    "intent: 'purchase_customer_data_confirmation'",
    "intent: 'purchase_customer_upserted'",
    "intent: 'purchase_customer_data_needs_update'",
    'customer_record',
    'Confirme os dados do pedido',
    'Telefone:',
    'Endereco:',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'customer_data_pending'") < source.indexOf("purchaseFlow.status === 'awaiting_product_action'"),
    `${fileName} must handle customer data pending before product action flow`
  );
}

const doc = readBotWhatsappDoc(root);
assert(doc.includes('- [x] Confirmar nome/telefone/endereco antes de fechar'), 'Bot_Whatsapp.md must mark customer data confirmation checklist item');
assert(doc.includes('tmp-tests/autoresponder-purchase-customer-confirmation-static.test.mjs'), 'Bot_Whatsapp.md must mention customer confirmation test');

console.log('autoresponder purchase customer confirmation static checks passed');
