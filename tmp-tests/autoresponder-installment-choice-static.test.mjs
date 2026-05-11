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
    'function isAutoresponderInstallmentChoiceRequest',
    'function buildAutoresponderSelectedInstallmentPayment',
    'function buildAutoresponderSelectedInstallmentReply',
    'Combinado, deixei o pagamento como:',
    "method: 'credit'",
    "intent: 'purchase_installment_selected'",
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    /const requestedInstallments = getAutoresponderRequestedInstallments\(message\);[\s\S]*?isAutoresponderInstallmentChoiceRequest\(message\)[\s\S]*?await saveAutoresponderPurchaseFlow\(senderKey, \{[\s\S]*?selected_payment:/m.test(source),
    `${fileName} must save selected_payment when the customer chooses installments`
  );

  assert(
    source.includes('buildAutoresponderSelectedInstallmentReply(selectedPayment)'),
    `${fileName} must confirm the selected installment to the customer`
  );

  assert(
    source.includes('payment_plan: purchaseFlow?.selected_payment || paymentPlan'),
    `${fileName} must expose the selected payment in the customer/order snapshot`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Captar escolha de parcelamento do cliente e salvar no carrinho do WhatsApp'),
  'Bot_Whatsapp.md must mark installment choice capture done'
);
assert(
  doc.includes('tmp-tests/autoresponder-installment-choice-static.test.mjs'),
  'Bot_Whatsapp.md must mention the installment choice test'
);

console.log('autoresponder installment choice static checks passed');
