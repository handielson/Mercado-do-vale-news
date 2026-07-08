import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const whatsappPage = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const types = readFileSync('types/autoResponder.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');
const deployedServer = readFileSync('vps_server.js', 'utf8');

assert.ok(
  !existsSync('components/whatsapp/WhatsAppConnectionPanel.tsx'),
  'legacy duplicate connection panel must stay removed',
);
assert.ok(
  !existsSync('components/whatsapp/WhatsAppMigrationChecklist.tsx'),
  'obsolete migration checklist component must stay removed',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppConversationsPanel.tsx'),
  'WhatsApp center must have an essential attendance panel component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppBotSettingsPanel.tsx'),
  'WhatsApp center must have a bot settings panel component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppAttendantsPanel.tsx'),
  'WhatsApp center must have an attendants panel component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppInternalBotTester.tsx'),
  'WhatsApp center must have an internal bot tester component',
);
assert.ok(
  existsSync('components/whatsapp/WhatsAppAutomationTemplatesPanel.tsx'),
  'WhatsApp center must have an automation templates panel component',
);

const conversationsPanel = readFileSync('components/whatsapp/WhatsAppConversationsPanel.tsx', 'utf8');
const botSettingsPanel = readFileSync('components/whatsapp/WhatsAppBotSettingsPanel.tsx', 'utf8');
const attendantsPanel = readFileSync('components/whatsapp/WhatsAppAttendantsPanel.tsx', 'utf8');
const internalBotTester = readFileSync('components/whatsapp/WhatsAppInternalBotTester.tsx', 'utf8');
const automationTemplatesPanel = readFileSync('components/whatsapp/WhatsAppAutomationTemplatesPanel.tsx', 'utf8');

[
  'WhatsAppNumberSwitchPanel',
  'WhatsAppBotSettingsPanel',
  'WhatsAppAttendantsPanel',
  'WhatsAppInternalBotTester',
  'WhatsAppAutomationTemplatesPanel',
  'Centro WhatsApp',
  'Central do bot novo',
  'atendimento',
].forEach((needle) => {
  assert.ok(whatsappPage.includes(needle), `WhatsAppPage must include ${needle}`);
});

assert.ok(
  !whatsappPage.includes('<WhatsAppConnectionPanel />'),
  'WhatsApp page must not render the legacy connection panel together with the guided number switch panel',
);
assert.ok(
  !whatsappPage.includes('<WhatsAppMigrationChecklist />'),
  'WhatsApp page must not render the obsolete migration checklist block',
);

[
  'listConversations',
  'pauseConversation',
  'resumeConversation',
  'resetConversationCounters',
  'listConversationLogs',
  'sendManualMessage',
  'manualMessageDrafts',
  'selectedSendTagBySender',
  'selectedAttendantBySender',
  'attendants',
  'attendantFilter',
  'Atendente atual',
  'Todos atendentes',
  'Sem atendente',
  'Salvar atendente',
  'Bloquear numero',
  'Tag de envio',
  'Enviar mensagem',
  'Finalizar atendimento',
  'Atendimento finalizado',
  'Atendimento finalizado, mas qualquer duvida estamos por aqui.',
  'human_handoff',
  'manual_finished',
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
  'updateConversationAttendant',
  'createBlocklistEntry',
].forEach((needle) => {
  assert.ok(conversationsPanel.includes(needle), `conversations panel must include ${needle}`);
});

[
  'WhatsAppAttendantsPanel',
  'listAttendants',
  'createAttendant',
  'deleteAttendant',
  'newAttendantName',
  'Equipe de atendimento',
  'Atendentes ativos',
  'Cadastrar atendente',
  'Salvo na VPS',
].forEach((needle) => {
  assert.ok(attendantsPanel.includes(needle), `attendants panel must include ${needle}`);
});

[
  'WhatsAppInternalBotTester',
  'sendInternalChatMessage',
  'resetInternalChat',
  'WhatsApp interno',
  'Laboratorio do bot',
  'Limpar conversa',
  'Novo cliente de teste',
  'Digite como se fosse o cliente',
  'Bot processando',
  'nao sao enviadas ao WhatsApp real',
].forEach((needle) => {
  assert.ok(internalBotTester.includes(needle), `internal bot tester must include ${needle}`);
});

[
  'WhatsAppAutomationTemplatesPanel',
  'Templates automaticos',
  'Mensagens editaveis por evento',
  'listWhatsAppAutomationTemplates',
  'saveWhatsAppAutomationTemplate',
  'sendWhatsAppAutomationTemplateTest',
  'resetWhatsAppAutomationTemplate',
  'Pausar envio deste template',
  'Envio ligado',
  'Envio pausado',
].forEach((needle) => {
  assert.ok(automationTemplatesPanel.includes(needle), `automation templates panel must include ${needle}`);
});

[
  'WhatsAppBotSettingsPanel',
  'getSettings',
  'updateSettings',
  'enabled',
  'botEnabled',
  'toggleBotEnabled',
  'Configuracoes do atendimento automatico',
  'Atendimento automatico',
  'Bot ligado',
  'Bot desligado',
  'Ligar bot',
  'Desligar bot',
  'manual_finish_pause_days',
  'days_paused_after_finish',
  'finish_pause_days',
  'Power',
  'Minus',
  'Plus',
  'response_tone_mode',
  'responseToneMode',
  'Tom das respostas',
  'A - Direto',
  'B - Consultivo',
  'C - Humano',
  'Auto A/B/C',
  'finishPauseDays',
  'Dias pausado apos finalizar',
  'Salvar configuracoes',
].forEach((needle) => {
  assert.ok(botSettingsPanel.includes(needle), `bot settings panel must include ${needle}`);
});

[
  'getWhatsAppConnectionState',
  'getWhatsAppDebug',
  'connectWhatsApp',
  'disconnectWhatsApp',
  'listConversations',
  'listConversationLogs',
  'listAttendants',
  'createAttendant',
  'deleteAttendant',
  'pauseConversation',
  'resumeConversation',
  'resetConversationCounters',
  'updateConversationAttendant',
  'sendManualMessage',
  'sendInternalChatMessage',
  'resetInternalChat',
].forEach((needle) => {
  assert.ok(service.includes(needle), `autoResponderService must keep ${needle}`);
});

[
  'export interface AutoResponderConversationLog',
  'export interface AutoResponderManualMessageInput',
  'export interface AutoResponderManualMessageResult',
  'export interface AutoResponderInternalChatResult',
  'export interface AutoResponderAttendant',
  'manual_finish_pause_days',
  'days_paused_after_finish',
  "response_tone_mode?: 'a' | 'b' | 'c' | 'auto_abc'",
  'attendant_name?: string',
  'attendant_updated_at?: string | null',
  'send_tag_id?: number',
  'question?: string | null',
  'reply_text?: string | null',
  'response_time_ms?: number | null',
].forEach((needle) => {
  assert.ok(types.includes(needle), `autoResponder types must include ${needle}`);
});

[
  "fastify.get('/autoresponder/attendants'",
  "fastify.post('/autoresponder/attendants'",
  "fastify.delete('/autoresponder/attendants/:id'",
  "fastify.post('/autoresponder/conversations/:sender/attendant'",
  'CREATE TABLE IF NOT EXISTS autoresponder_attendants',
  "addColumnIfMissing('autoresponder_conversations', 'attendant_name'",
  'attendant_changed',
  "fastify.post('/autoresponder/internal-chat/message'",
  "fastify.post('/autoresponder/internal-chat/reset'",
  'runAutoresponderInternalChatMessage',
  "fastify.post('/autoresponder/conversations/:sender/manual-message'",
  'sendAutoresponderEvolutionTextMessage',
  'normalizeEvolutionWebhookPayload',
  'sendAutoresponderEvolutionReplies',
  "fastify.post('/autoresponder/whatsapp/sync-webhook'",
  "payload.event !== 'MESSAGES_UPSERT'",
  "!normalizeAutoresponderSender(sender)",
  'attendant_name',
  'send_tag_id',
  'manual_finish_pause_days',
  'response_tone_mode',
  'AUTORESPONDER_RESPONSE_TONE_VARIANTS',
  'selectAutoresponderResponseTone',
  'getAutoresponderToneMessage',
  "addColumnIfMissing('autoresponder_settings', 'response_tone_mode'",
  "addColumnIfMissing('autoresponder_settings', 'manual_finish_pause_days'",
  'manual_message',
  'manual_finished',
  'human_handoff',
  "status === 'finished'",
  "pause_reason = 'manual_finished'",
  'finishAttendance ? 60 * 24 * 3650 : 60 * 24 * 7',
  "VALUES (?, CURRENT_TIMESTAMP, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'manual_finished')",
  'applyAutoresponderRuleConversationTag(sender, sendTagId)',
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
  !routes.includes('path: "/admin/atendimento-automatico"'),
  'legacy AutoResponder route must stay removed',
);

console.log('whatsapp connection center static checks passed');
