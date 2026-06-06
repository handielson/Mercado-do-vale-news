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
    'async function findAutoresponderAvailableCategories',
    'function buildAutoresponderCategoryOptions',
    'function findAutoresponderSelectedCategoryFromMessage',
    'async function findAutoresponderProductsByCategory',
    'async function countAutoresponderProductsByCategory',
    "intent: 'category_selected'",
    'JOIN products p ON p.category_id = c.id',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(source.includes("pagination?.source === 'category_list'"), `${fileName} must keep category-list pagination compatibility`);
  assert(!source.includes("intent: 'greeting_category_list'"), `${fileName} must not auto-list categories after a pure greeting`);
  assert(
    source.indexOf('const categoryContext = normalizeAutoresponderOptionsContext') < source.indexOf('const numberedChoice = detectedIntent.numberedChoice'),
    `${fileName} must handle category selection before product numbered selection`
  );
}

const doc = readBotWhatsappDoc(root);
assert(doc.includes('- [x] Cliente pode responder com numero ou nome da categoria'), 'Bot_Whatsapp.md must mark category selection done');
assert(doc.includes('tmp-tests/autoresponder-greeting-category-list-static.test.mjs'), 'Bot_Whatsapp.md must mention category list test');

console.log('autoresponder greeting category list static checks passed');
