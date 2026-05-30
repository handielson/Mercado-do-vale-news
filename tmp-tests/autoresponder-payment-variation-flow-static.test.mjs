import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function buildAutoresponderVariationPrompt',
    'function findAutoresponderSelectedVariation',
    "status: 'awaiting_variation'",
    "purchaseFlow.status === 'awaiting_variation'",
    'function buildAutoresponderPaymentMethodPrompt',
    'function getAutoresponderPaymentMethodChoice',
    'function buildAutoresponderCardEntryPrompt',
    'function parseAutoresponderPaymentEntryCents',
    'function buildAutoresponderInstallmentTableReply',
    'function buildAutoresponderCashPaymentSelectedReply',
    "status: 'awaiting_payment_method'",
    "status: 'awaiting_card_entry'",
    "status: 'awaiting_card_installments'",
    "intent = 'purchase_payment_method_prompt'",
    "intent: 'purchase_payment_cash_selected'",
    "intent: 'purchase_payment_card_entry_prompt'",
    "intent: 'purchase_payment_card_installments'",
    "intent: 'purchase_payment_card_selected'",
    'calculateAutoresponderInstallmentOptions(cardBaseCents, 12)',
    'entry_cents',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'awaiting_payment_method'") < source.indexOf("purchaseFlow.status === 'customer_data_pending'"),
    `${fileName} must handle payment before customer data confirmation`
  );
}

const pageSource = fs.readFileSync(path.join(root, 'pages/admin/AutoResponderPage.tsx'), 'utf8');
[
  "id: 'variation'",
  "id: 'payment-method'",
  "id: 'payment-card-entry'",
  "id: 'payment-card-installments'",
  "id: 'payment-card-choice'",
  'Pix, dinheiro, debito ou cartao de credito',
].forEach((token) => {
  assert(pageSource.includes(token), `AutoResponder flow UI must include ${token}`);
});

console.log('autoresponder payment and variation flow static checks passed');
