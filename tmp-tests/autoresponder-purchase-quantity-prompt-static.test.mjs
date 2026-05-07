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
    'function isAutoresponderPurchaseBuyRequest',
    'function isAutoresponderPurchaseDetailsRequest',
    'function buildAutoresponderQuantityPrompt',
    "purchaseFlow.status === 'awaiting_product_action'",
    "status: 'awaiting_quantity'",
    "intent: 'purchase_quantity_prompt'",
    'Quantas unidades voce deseja?',
    'Responda apenas com a quantidade.',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'awaiting_product_action'") < source.indexOf('const numberedChoice = detectedIntent.numberedChoice'),
    `${fileName} must handle existing purchase flow before selecting a new numbered option`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Perguntar quantidade desejada'),
  'Bot_Whatsapp.md must mark quantity prompt checklist item'
);
assert(
  doc.includes('- [x] Cliente escolhe produto por numero e bot pergunta quantidade'),
  'Bot_Whatsapp.md must mark quantity prompt test checklist item'
);

console.log('autoresponder purchase quantity prompt static checks passed');
