import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/autoresponder/engine/flows/purchase.js', 'utf8');
const servers = ['vps_server.js', 'vps_server.cjs', 'server.js'].map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));

[
  'purchaseFlowHandler',
  "step: 'awaiting_action'",
  "step: 'awaiting_quantity'",
  "step: 'awaiting_fulfillment'",
  "step: 'awaiting_payment_method'",
  'buildContextualFallback',
  "intent: 'purchase_handoff_ready'",
].forEach((needle) => {
  assert.ok(source.includes(needle), `purchase flow must include ${needle}`);
});

for (const server of servers) {
  [
    'handleAutoresponderEnginePurchaseFlowV2',
    'purchaseFlowHandler',
    'AUTORESPONDER_ENGINE_V2',
    'conversation_state: purchaseReply.nextState',
    "status = 'awaiting_quantity'",
    "status = 'summary_ready'",
    "status = 'awaiting_payment_method'",
    'buildAutoresponderEngineSelectedPayment',
    "purchaseReply.intent === 'purchase_handoff_ready'",
    'buildAutoresponderCustomerLinkedPurchaseFlow',
    'pauseAutoresponderConversationForPurchase',
    'total_cents',
    'cpf_cnpj',
  ].forEach((needle) => {
    assert.ok(server.source.includes(needle), `${server.file} must include ${needle}`);
  });
}

console.log('autoresponder purchase engine static checks passed');
