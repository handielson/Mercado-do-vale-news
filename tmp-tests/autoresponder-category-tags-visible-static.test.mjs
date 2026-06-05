import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const servicePath = path.join(root, 'services', 'autoResponderService.ts');
const typesPath = path.join(root, 'types', 'autoResponder.ts');
const serverPaths = ['vps_server.js', 'vps_server.cjs'].map((file) => path.join(root, file));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');
const doc = readBotWhatsappDoc(root);

assert(types.includes('AutoResponderCategoryTag'), 'types must expose dynamic category tags');
assert(service.includes('listCategoryTags'), 'autoResponderService must list dynamic category tags');
assert(service.includes('/autoresponder/category-tags'), 'service must call category tags endpoint');

for (const serverPath of serverPaths) {
  const server = fs.readFileSync(serverPath, 'utf8');
  assert(server.includes("fastify.get('/autoresponder/category-tags'"), `${path.basename(serverPath)} must expose category tags endpoint`);
  assert(server.includes('LEFT JOIN products p ON p.category_id = c.id'), `${path.basename(serverPath)} must count products per category`);
  assert(server.includes('resolveAutoresponderReplyTemplate'), `${path.basename(serverPath)} must resolve category template tags in rule replies`);
  assert(server.includes('{categorias_disponiveis}'), `${path.basename(serverPath)} must support available category template tag`);
  assert(server.includes('{categoria:'), `${path.basename(serverPath)} must support category product template tag`);
}

[
  'categoryTags',
  'filteredCategoryTags',
  'Categorias dinamicas',
  'Tags de categoria',
  'Vem da tabela categories',
  'Aparece na saudacao',
  'Informativos para outras mensagens',
  'Previa da saudacao automatica',
  'Categorias que aparecem nesta mensagem',
  'greetingCategoryPreviewText',
  'category.appears_on_greeting',
  '{categorias_disponiveis}',
  '{categoria:Nome da categoria}',
  'Use nas respostas automáticas',
].forEach((needle) => {
  assert(page.includes(needle), `AutoResponderPage must render dynamic category tag UI: ${needle}`);
});

[
  'copyCategoryTagPlaceholder',
  'navigator.clipboard.writeText',
  'Copiar tag',
  'Copiado',
].forEach((needle) => {
  assert(page.includes(needle), `AutoResponderPage must render category tag copy UI: ${needle}`);
});

assert(
  page.includes('copyCategoryTagPlaceholder(`{categoria:${category.name}}`)'),
  'Each dynamic category row must expose a copy action for its {categoria:Nome} placeholder'
);

assert(
  doc.includes('- [x] Tags de categoria visiveis no admin como categorias dinamicas') ||
  doc.includes('- [x] Tags de categoria visíveis no admin como categorias dinâmicas'),
  'Bot_Whatsapp.md must mark category tags admin visibility done'
);
assert(doc.includes('tmp-tests/autoresponder-category-tags-visible-static.test.mjs'), 'Bot_Whatsapp.md must mention category tags visibility test');

console.log('autoresponder category tags visibility static checks passed');
