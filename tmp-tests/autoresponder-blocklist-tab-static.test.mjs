import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'blocklist',
  'blocklistSearch',
  'blockForm',
  'bulkBlocklistText',
  'isBlockModalOpen',
  'isBulkBlockModalOpen',
  'filteredBlocklist',
].forEach((stateName) => {
  assert(page.includes(stateName), `AutoResponderPage must manage ${stateName}`);
});

[
  'autoResponderService.listBlocklist',
  'autoResponderService.createBlocklistEntry',
  'autoResponderService.bulkCreateBlocklist',
  'autoResponderService.deleteBlocklistEntry',
].forEach((callName) => {
  assert(page.includes(callName), `Blocklist tab must call ${callName}`);
});

[
  'Adicionar bloqueio',
  'Importar em massa',
  'Padrão',
  'Tipo',
  'Nome',
  'Motivo',
  'Ações',
  'Salvar bloqueio',
  'Importar bloqueados',
  'Excluir',
].forEach((label) => {
  assert(page.includes(label), `Blocklist tab must render label: ${label}`);
});

assert(page.includes('pattern_type'), 'Blocklist form must edit pattern_type');
assert(page.includes('contact_name'), 'Blocklist form must edit contact_name');
assert(page.includes('reason'), 'Blocklist form must edit reason');
assert(page.includes('active'), 'Blocklist form must edit active');

assert(doc.includes('- [x] Tabela com padrão / tipo / nome / motivo / ações'), 'Bot_Whatsapp.md must mark blocklist table checklist item');
assert(doc.includes('- [x] Botão "+ Adicionar"'), 'Bot_Whatsapp.md must mark add button checklist item');
assert(doc.includes('- [x] Botão "Importar em massa" (textarea)'), 'Bot_Whatsapp.md must mark bulk import checklist item');

console.log('autoresponder blocklist tab static checks passed');
