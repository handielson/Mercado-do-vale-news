import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  'TagKeywordRow',
  'settingsKeywordRows',
  'parseSettingsKeywordRows',
  'keywordRowsToMap',
  'addKeywordRow',
  'updateKeywordRow',
  'removeKeywordRow',
  'productTags',
  'product_tag_keywords',
].forEach((token) => {
  assert(page.includes(token), `Settings polish must include ${token}`);
});

[
  'Mapeamento palavra → tag',
  'Palavras-chave',
  'Tag de produto',
  'Adicionar mapeamento',
  'Remover',
  'Horário de funcionamento',
  '/admin/settings/company',
  'Abrir horários da empresa',
].forEach((label) => {
  assert(page.includes(label), `Settings polish must render label: ${label}`);
});

assert(
  page.includes('settingsFormToInput(settingsForm, settingsKeywordRows)'),
  'Settings save must include keyword rows in the payload'
);

assert(
  doc.includes('- [x] Bloco "Mapeamento palavra → tag"'),
  'Bot_Whatsapp.md must mark keyword mapping block'
);
assert(
  doc.includes('- [x] Bloco "Horário de funcionamento" com link para `/admin/settings/company`'),
  'Bot_Whatsapp.md must mark business hours link'
);

console.log('autoresponder settings polish static checks passed');
