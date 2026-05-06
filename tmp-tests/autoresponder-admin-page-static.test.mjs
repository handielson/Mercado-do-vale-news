import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const routesPath = path.join(root, 'routes', 'index.tsx');
const layoutPath = path.join(root, 'layouts', 'AdminLayout.tsx');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(pagePath), 'pages/admin/AutoResponderPage.tsx must exist');

const page = fs.readFileSync(pagePath, 'utf8');
const routes = fs.readFileSync(routesPath, 'utf8');
const layout = fs.readFileSync(layoutPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

assert(page.includes('autoResponderService'), 'AutoResponderPage must consume autoResponderService');
assert(page.includes('Tabs') && page.includes('TabList') && page.includes('TabPanel'), 'AutoResponderPage must use the shared Tabs UI');

[
  'respostas',
  'conversas',
  'bloqueados',
  'curadoria',
  'tags',
  'estatisticas',
  'configuracoes',
].forEach((tabId) => {
  assert(page.includes(`id="${tabId}"`) || page.includes(`id='${tabId}'`), `AutoResponderPage must expose ${tabId} tab`);
});

assert(routes.includes('AutoResponderPage'), 'routes/index.tsx must lazy-load AutoResponderPage');
assert(routes.includes('"/admin/atendimento-automatico"'), 'routes/index.tsx must register /admin/atendimento-automatico');
assert(layout.includes("to: '/admin/atendimento-automatico'"), 'AdminLayout must include AutoResponder menu item');
assert(layout.includes("label: 'AutoResponder'"), 'AdminLayout menu label must be AutoResponder');

assert(doc.includes('- [x] Criar `pages/admin/AutoResponderPage.tsx`'), 'Bot_Whatsapp.md must mark AutoResponderPage checklist item');
assert(doc.includes('- [x] Adicionar rota no router'), 'Bot_Whatsapp.md must mark route checklist item');
assert(doc.includes('- [x] Adicionar item no menu de [layouts/AdminLayout.tsx](layouts/AdminLayout.tsx)'), 'Bot_Whatsapp.md must mark menu checklist item');

console.log('autoresponder admin page static checks passed');
