import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const pagePath = 'pages/admin/n8n/N8nChatPage.tsx';
const workflowAssetPath = 'public/n8n-whatsapp-chat/n8n-chat-workflow.json';
const checklistAssetPath = 'public/n8n-whatsapp-chat/manual-test-checklist.md';

assert.ok(existsSync(pagePath), 'n8n chat page file must exist');
assert.ok(existsSync(workflowAssetPath), 'n8n workflow public asset must exist');
assert.ok(existsSync(checklistAssetPath), 'n8n checklist public asset must exist');

const page = readFileSync(pagePath, 'utf8');
const workflowAsset = readFileSync(workflowAssetPath, 'utf8');

assert.ok(
  routes.includes("const N8nChatPage") &&
    routes.includes("path: \"/admin/n8n\"") &&
    routes.includes("<AdminLayout><N8nChatPage /></AdminLayout>"),
  'routes must expose /admin/n8n with AdminLayout'
);

assert.ok(
  layout.includes("to: '/admin/n8n'") &&
    layout.includes("label: 'n8n Chat'") &&
    layout.includes("keywords: 'n8n workflow automacao chat evolution webhook teste'"),
  'admin menu must expose a distinct n8n Chat item'
);

assert.ok(
  page.includes('n8n Chat') &&
    page.includes('Somente chat conversacional') &&
    page.includes('Numero de teste') &&
    page.includes('Sem depender do bot antigo') &&
    page.includes('Automacoes atuais preservadas'),
  'page must clearly distinguish n8n chat from WhatsApp automations and the broken old bot'
);

assert.ok(
  page.includes('https://n8n.mercadodovale.com.br') &&
    page.includes('https://api-wa-test.mercadodovale.com.br') &&
    page.includes('/webhook/whatsapp-chat-test') &&
    page.includes('/n8n-whatsapp-chat/n8n-chat-workflow.json') &&
    page.includes('/n8n-whatsapp-chat/manual-test-checklist.md'),
  'page must show n8n, Evolution, webhook targets, and operational assets'
);

assert.ok(
  page.includes('oi') &&
    page.includes('tem iPhone?') &&
    page.includes('qual o horario?') &&
    page.includes('faz entrega?') &&
    page.includes('quero falar com atendente'),
  'page must include the manual chat test cases'
);

assert.doesNotThrow(
  () => JSON.parse(workflowAsset),
  'public workflow asset must be valid JSON'
);

console.log('n8n chat page static checks passed');
