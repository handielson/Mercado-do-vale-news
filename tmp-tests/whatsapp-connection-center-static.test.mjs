import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const whatsappPage = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const types = readFileSync('types/autoResponder.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');
const deployedServer = readFileSync('vps_server.js', 'utf8');

assert.ok(
  existsSync('components/whatsapp/WhatsAppConnectionPanel.tsx'),
  'WhatsApp center must have a focused connection panel component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppMigrationChecklist.tsx'),
  'WhatsApp center must show a migration checklist component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppConversationsPanel.tsx'),
  'WhatsApp center must have an essential attendance panel component',
);

const connectionPanel = readFileSync('components/whatsapp/WhatsAppConnectionPanel.tsx', 'utf8');
const checklist = readFileSync('components/whatsapp/WhatsAppMigrationChecklist.tsx', 'utf8');
const conversationsPanel = readFileSync('components/whatsapp/WhatsAppConversationsPanel.tsx', 'utf8');

[
  'WhatsAppConnectionPanel',
  'WhatsAppMigrationChecklist',
  'WhatsAppConversationsPanel',
  'Centro WhatsApp',
  'Conexao WhatsApp',
  'Atendimento WhatsApp',
].forEach((needle) => {
  assert.ok(whatsappPage.includes(needle), `WhatsAppPage must include ${needle}`);
});

[
  'getWhatsAppConnectionState',
  'getWhatsAppDebug',
  'connectWhatsApp',
  'disconnectWhatsApp',
  'Gerar QR Code / Conectar',
  'Desconectar WhatsApp',
  'pairingCode',
  'base64',
  'evolutionStatus',
  'fetchInstances',
  'connectionState',
  'formatDebugValue',
  'handleRefresh',
  'A Evolution nao retornou QR Code para conexao.',
].forEach((needle) => {
  assert.ok(connectionPanel.includes(needle), `connection panel must include ${needle}`);
});

[
  'listConversations',
  'pauseConversation',
  'resumeConversation',
  'resetConversationCounters',
  'listConversationLogs',
  'Atendimento WhatsApp',
  'Ver historico',
  'Ocultar historico',
  'Historico da conversa',
  'conversationLogsBySender',
  'selectedConversationSender',
  'loadConversationLogs',
  'Pausar 1h',
  'Retomar',
  'Resetar contadores',
  'conversationStatusFilter',
  'isConversationPaused',
  'Pausa humana',
  'Pausada ate',
].forEach((needle) => {
  assert.ok(conversationsPanel.includes(needle), `conversations panel must include ${needle}`);
});

[
  'Conexao',
  'Atendimento',
  "status: 'testing'",
  'ChatGPT',
  'Lista de celulares',
  'Curadoria',
  'Configuracoes',
].forEach((needle) => {
  assert.ok(checklist.includes(needle), `migration checklist must include ${needle}`);
});

[
  'getWhatsAppConnectionState',
  'getWhatsAppDebug',
  'connectWhatsApp',
  'disconnectWhatsApp',
  'listConversations',
  'listConversationLogs',
  'pauseConversation',
  'resumeConversation',
  'resetConversationCounters',
].forEach((needle) => {
  assert.ok(service.includes(needle), `autoResponderService must keep ${needle}`);
});

[
  'export interface AutoResponderConversationLog',
  'question?: string | null',
  'reply_text?: string | null',
  'response_time_ms?: number | null',
].forEach((needle) => {
  assert.ok(types.includes(needle), `autoResponder types must include ${needle}`);
});

[
  "fastify.get('/autoresponder/conversations/:sender/logs'",
  'FROM autoresponder_logs',
  'WHERE sender = ?',
  'ORDER BY created_at DESC',
  'LIMIT ${limit}',
].forEach((needle) => {
  assert.ok(server.includes(needle), `VPS server must include ${needle}`);
  assert.ok(deployedServer.includes(needle), `deployed VPS server must include ${needle}`);
});

assert.ok(
  routes.includes('path: "/admin/settings/whatsapp"'),
  'new WhatsApp center route must stay at /admin/settings/whatsapp',
);
assert.ok(
  routes.includes('path: "/admin/atendimento-automatico"'),
  'legacy AutoResponder route must remain during phase 1',
);

console.log('whatsapp connection center static checks passed');
