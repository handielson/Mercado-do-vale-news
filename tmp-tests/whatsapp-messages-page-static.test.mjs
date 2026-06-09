import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

assert.ok(
  existsSync('pages/admin/whatsapp/MessagesPage.tsx'),
  'WhatsApp messages page must exist',
);

const whatsappPage = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');
const messagesPage = readFileSync('pages/admin/whatsapp/MessagesPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const adminLayout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

[
  'WhatsAppConversationsPanel',
  'Mensagens WhatsApp',
  'Atendimento WhatsApp',
].forEach((needle) => {
  assert.ok(messagesPage.includes(needle), `WhatsApp messages page must include ${needle}`);
});

assert.ok(
  !whatsappPage.includes('<WhatsAppConversationsPanel />'),
  'WhatsApp center should not bury the conversations panel at the bottom',
);

assert.ok(
  routes.includes('path: "/admin/whatsapp/mensagens"'),
  'WhatsApp messages route must exist at /admin/whatsapp/mensagens',
);

assert.ok(
  routes.includes('const WhatsAppMessagesPage'),
  'routes must lazy-load the WhatsApp messages page',
);

assert.ok(
  adminLayout.includes("to: '/admin/whatsapp/mensagens'") && adminLayout.includes("label: 'Mensagens WhatsApp'"),
  'admin menu must expose Mensagens WhatsApp as a direct navigation item',
);

console.log('whatsapp messages page static checks passed');
