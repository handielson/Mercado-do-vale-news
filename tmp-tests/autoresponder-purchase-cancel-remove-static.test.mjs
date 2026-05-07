import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function isAutoresponderPurchaseCancelRequest',
    'function getAutoresponderPurchaseRemoveItemIndex',
    'function buildAutoresponderCartCancelledReply',
    'function buildAutoresponderItemRemovedReply',
    'function hasAutoresponderCartItems',
    'clearAutoresponderPurchaseFlow(senderKey)',
    "intent: 'purchase_cancelled'",
    "intent: 'purchase_item_removed'",
    'Carrinho cancelado',
    'Removi do carrinho',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf('isAutoresponderPurchaseCancelRequest(message)') < source.indexOf("purchaseFlow.status === 'awaiting_product_action'"),
    `${fileName} must handle cart cancellation before product action flow`
  );
  assert(
    source.indexOf('getAutoresponderPurchaseRemoveItemIndex(message)') < source.indexOf("purchaseFlow.status === 'awaiting_product_action'"),
    `${fileName} must handle item removal before product action flow`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Permitir remover item/cancelar carrinho'),
  'Bot_Whatsapp.md must mark remove/cancel checklist item'
);
assert(
  doc.includes('- [x] Fluxo de cancelamento limpa carrinho temporario'),
  'Bot_Whatsapp.md must mark cancel test checklist item'
);
assert(
  doc.includes('tmp-tests/autoresponder-purchase-cancel-remove-static.test.mjs'),
  'Bot_Whatsapp.md must mention cancel/remove test'
);

console.log('autoresponder purchase cancel/remove static checks passed');
