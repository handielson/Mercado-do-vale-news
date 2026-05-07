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
    'function isAutoresponderPurchaseAddMoreRequest',
    'function buildAutoresponderAddMorePrompt',
    "purchaseFlow.status === 'item_added'",
    "status: 'adding_more'",
    "intent: 'purchase_add_more_prompt'",
    'Qual produto voce quer adicionar agora?',
    'items: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : []',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'item_added'") < source.indexOf('const numberedChoice = detectedIntent.numberedChoice'),
    `${fileName} must handle add-more request before selecting a new numbered option`
  );

  assert(
    !source.includes('items: [],\n          });'),
    `${fileName} must not reset cart items when selecting another product`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Permitir adicionar mais produtos ao mesmo carrinho'),
  'Bot_Whatsapp.md must mark add-more cart checklist item'
);
assert(
  doc.includes('tmp-tests/autoresponder-purchase-add-more-static.test.mjs'),
  'Bot_Whatsapp.md must mention add-more test'
);

console.log('autoresponder purchase add more static checks passed');
