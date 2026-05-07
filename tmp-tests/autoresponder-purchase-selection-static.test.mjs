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
    'function findAutoresponderSelectedOptionFromMessage',
    'function buildAutoresponderPurchaseActionPrompt',
    "status: 'awaiting_product_action'",
    'selected_product',
    'saveAutoresponderPurchaseFlow(senderKey',
    "intent: 'purchase_product_selected'",
    'Quer comprar esse produto ou ver detalhes primeiro?',
    'Responda "comprar" ou "detalhes".',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf('findAutoresponderSelectedOptionFromMessage') < source.indexOf("intent: 'purchase_product_selected'"),
    `${fileName} must define selection helper before webhook branch`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Quando cliente responder numero/nome do produto, perguntar se deseja comprar ou ver detalhes'),
  'Bot_Whatsapp.md must mark product selection purchase prompt checklist item'
);

console.log('autoresponder purchase selection static checks passed');
