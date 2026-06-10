import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

assert.ok(
  existsSync('pages/admin/whatsapp/AiMemoryPage.tsx'),
  'WhatsApp AI memory page must exist',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppAiMemoryPanel.tsx'),
  'WhatsApp AI memory panel must exist',
);

const page = readFileSync('pages/admin/whatsapp/AiMemoryPage.tsx', 'utf8');
const panel = readFileSync('components/whatsapp/WhatsAppAiMemoryPanel.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const types = readFileSync('types/autoResponder.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');
const deployedServer = readFileSync('vps_server.js', 'utf8');

[
  'Memoria IA WhatsApp',
  'WhatsAppAiMemoryPanel',
].forEach((needle) => {
  assert.ok(page.includes(needle), `AI memory page must include ${needle}`);
});

[
  'ai_conversation_memory_enabled',
  'ai_conversation_memory_limit',
  'ai_conversation_memory_days',
  'ai_context_memory',
  'Memoria de conversa',
  'Ultimas 20 mensagens',
  'Ultimas 30 mensagens',
  'Instrucoes globais da IA',
  'Salvar memoria IA',
  'autoResponderService.updateSettings',
].forEach((needle) => {
  assert.ok(panel.includes(needle), `AI memory panel must include ${needle}`);
});

assert.ok(
  routes.includes('const WhatsAppAiMemoryPage') && routes.includes('path: "/admin/whatsapp/memoria-ia"'),
  'routes must expose /admin/whatsapp/memoria-ia',
);
assert.ok(
  layout.includes("to: '/admin/whatsapp/memoria-ia'") && layout.includes("label: 'Memoria IA'"),
  'admin menu must expose Memoria IA',
);

[
  'ai_conversation_memory_enabled?: boolean | number',
  'ai_conversation_memory_limit?: number',
  'ai_conversation_memory_days?: number',
  'ai_context_memory?: string',
].forEach((needle) => {
  assert.ok(types.includes(needle), `AutoResponderSettings must include ${needle}`);
});

[
  'ai_conversation_memory_enabled',
  'ai_conversation_memory_limit',
  'ai_conversation_memory_days',
  'ai_context_memory',
].forEach((needle) => {
  assert.ok(service.includes(needle) || types.includes(needle), `frontend contract must include ${needle}`);
});

[
  'buildAutoresponderAiConversationMemoryContext',
  'loadAutoresponderAiConversationMemory',
  'Memoria recente desta conversa no WhatsApp',
  'callAutoresponderOpenAi({ input, maxOutputTokens = 120, settings = null, sender = null })',
  'ai_conversation_memory_enabled',
  'ai_conversation_memory_limit',
  'ai_conversation_memory_days',
  'ai_context_memory',
  "addColumnIfMissing('autoresponder_settings', 'ai_conversation_memory_enabled'",
  "addColumnIfMissing('autoresponder_settings', 'ai_conversation_memory_limit'",
  "addColumnIfMissing('autoresponder_settings', 'ai_conversation_memory_days'",
  "addColumnIfMissing('autoresponder_settings', 'ai_context_memory'",
].forEach((needle) => {
  assert.ok(server.includes(needle), `VPS server must include ${needle}`);
  assert.ok(deployedServer.includes(needle), `deployed VPS server must include ${needle}`);
});

[
  'buildAutoresponderAiFallbackReply({',
  'buildAutoresponderAiFirstReply({',
  'buildAutoresponderAiIntentPlan({',
  'sender,',
].forEach((needle) => {
  assert.ok(server.includes(needle), `AI callers must pass conversation sender context: ${needle}`);
});

console.log('whatsapp ai memory static checks passed');
