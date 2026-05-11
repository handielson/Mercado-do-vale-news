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
    'function getAutoresponderRequestedInstallments',
    'async function calculateAutoresponderInstallmentOptions',
    'function formatAutoresponderSpecificInstallmentReply',
    'Parcelamento do carrinho',
    'Tabela completa:',
    "intent: 'purchase_specific_installment_quote'",
    'calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow)',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    /getAutoresponderRequestedInstallments\(message\)[\s\S]*?hasAutoresponderCartItems\(purchaseFlow\)/.test(source),
    `${fileName} must detect a requested installment while a cart is active`
  );

  assert(
    source.indexOf('const requestedInstallments = getAutoresponderRequestedInstallments(message)') <
      source.indexOf('const categoryContext = normalizeAutoresponderOptionsContext'),
    `${fileName} must answer installment questions before numbered/category handling`
  );

  assert(
    source.includes('installments BETWEEN 2 AND ?'),
    `${fileName} must read card installment fees from payment_fees`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Responder pergunta de parcela especifica com destaque e tabela completa: `Em 5x fica R$ X = xxxx`'),
  'Bot_Whatsapp.md must mark specific installment replies done'
);
assert(
  doc.includes('tmp-tests/autoresponder-specific-installment-reply-static.test.mjs'),
  'Bot_Whatsapp.md must mention the specific installment reply test'
);

console.log('autoresponder specific installment reply static checks passed');
