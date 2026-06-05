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
    'function buildAutoresponderCustomerLinkedPurchaseFlow',
    'customer_id: customerRecord?.id || purchaseFlow?.customer_id || null',
    'customer_record: customerRecord',
    'customer_linked_at:',
    "status: 'customer_record_ready'",
    "intent: 'purchase_customer_upserted'",
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    /const linkedPurchaseFlow = buildAutoresponderCustomerLinkedPurchaseFlow\([\s\S]*?const handoffPurchaseFlow = \{[\s\S]*?\.\.\.linkedPurchaseFlow[\s\S]*?await saveAutoresponderPurchaseFlow\(senderKey, handoffPurchaseFlow\)/m.test(source),
    `${fileName} must carry the linked customer into the saved purchase handoff flow`
  );

  assert(
    source.indexOf('function buildAutoresponderCustomerLinkedPurchaseFlow') <
      source.indexOf("purchaseFlow.status === 'awaiting_customer_confirmation'"),
    `${fileName} must define customer link helper before customer confirmation flow`
  );
}

const doc = readBotWhatsappDoc(root);
assert(
  doc.includes('- [x] Vincular cliente cadastrado ao pedido/carrinho do WhatsApp'),
  'Bot_Whatsapp.md must mark customer-cart link done'
);
assert(
  doc.includes('tmp-tests/autoresponder-customer-cart-link-static.test.mjs'),
  'Bot_Whatsapp.md must mention customer-cart link test'
);

console.log('autoresponder customer cart link static checks passed');
