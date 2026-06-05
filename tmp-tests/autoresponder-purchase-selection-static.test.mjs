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
    'function findAutoresponderSelectedOptionFromMessage',
    'async function buildAutoresponderPurchaseActionPrompt',
    "status: 'awaiting_product_action'",
    'selected_product',
    'saveAutoresponderPurchaseFlow(senderKey',
    "intent: 'purchase_product_selected'",
    'formatAutoresponderProductCardLine',
    'option_number: choiceNumber',
    'Responda:\\n*1* Para comprar\\n*2* Para detalhes',
    'await buildAutoresponderPurchaseActionPrompt(product, selectedOption)',
    "'1'",
    "'2'",
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    !source.includes('Responda "comprar" ou "detalhes".'),
    `${fileName} must not use the old text commands after product selection`
  );

  assert(
    source.indexOf('findAutoresponderSelectedOptionFromMessage') < source.indexOf("intent: 'purchase_product_selected'"),
    `${fileName} must define selection helper before webhook branch`
  );
}

const doc = readBotWhatsappDoc(root);
assert(
  doc.includes('- [x] Quando cliente responder numero/nome do produto, perguntar se deseja comprar ou ver detalhes'),
  'Bot_Whatsapp.md must mark product selection purchase prompt checklist item'
);
assert(
  doc.includes('tmp-tests/autoresponder-purchase-selection-static.test.mjs'),
  'Bot_Whatsapp.md must mention purchase selection test'
);

console.log('autoresponder purchase selection static checks passed');
