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
    'function parseAutoresponderRequestedQuantity',
    'function buildAutoresponderOutOfStockReply',
    'function buildAutoresponderInsufficientStockReply',
    'function buildAutoresponderItemAddedPrompt',
    "purchaseFlow.status === 'awaiting_quantity'",
    "status: 'stock_blocked'",
    "status: 'item_added'",
    "intent: 'purchase_stock_blocked'",
    "intent: 'purchase_item_added'",
    'Esse produto ficou sem estoque',
    'Temos apenas',
    'Adicionei ao carrinho',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'awaiting_quantity'") < source.indexOf('const numberedChoice = detectedIntent.numberedChoice'),
    `${fileName} must validate purchase quantity before selecting a new numbered option`
  );
}

const doc = readBotWhatsappDoc(root);
assert(
  doc.includes('- [x] Validar estoque antes de adicionar ao carrinho'),
  'Bot_Whatsapp.md must mark stock validation checklist item'
);
assert(
  doc.includes('- [x] Produto sem estoque bloqueia compra e sugere atendimento/alternativa'),
  'Bot_Whatsapp.md must mark out-of-stock test checklist item'
);

console.log('autoresponder purchase stock validation static checks passed');
