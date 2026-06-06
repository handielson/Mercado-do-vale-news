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
    'Para ver a configuracao, fotos e video dele, clica aqui',
    'Para comprar digite *1* ou responda com *comprar*',
    'await buildAutoresponderPurchaseActionPrompt(product, selectedOption)',
    "'1'",
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    !source.includes('Responda "comprar" ou "detalhes".'),
    `${fileName} must not use the old text commands after product selection`
  );
  assert(
    !source.includes('Responda:\\n*1* Para comprar\\n*2* Para detalhes'),
    `${fileName} must not offer a separate details action after product selection`
  );
  assert(
    !source.includes('const detailText = await formatAutoresponderProductDetailReply(product, settings);'),
    `${fileName} must not send the long detail reply when the customer asks for details`
  );
  const purchaseDetailsBranch = source.match(/if \(isAutoresponderPurchaseDetailsRequest\(message\)\) \{[\s\S]*?return \{ replies: \[\{ message: replyText \}\] \};[\s\S]*?\n        \}/)?.[0] || '';
  assert(
    purchaseDetailsBranch.includes('await buildAutoresponderPurchaseActionPrompt(product, purchaseFlow.selected_product)'),
    `${fileName} details requests in purchase flow must reuse the short link-and-buy prompt`
  );
  assert(
    !purchaseDetailsBranch.includes('formatAutoresponderProductDetailReply'),
    `${fileName} purchase details branch must not include the old long product detail block`
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
