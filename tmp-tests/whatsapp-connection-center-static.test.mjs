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
  existsSync('components/whatsapp/WhatsAppResponseCenterPanel.tsx'),
  'WhatsApp center must have a response center panel component',
);

const connectionPanel = readFileSync('components/whatsapp/WhatsAppConnectionPanel.tsx', 'utf8');
const checklist = readFileSync('components/whatsapp/WhatsAppMigrationChecklist.tsx', 'utf8');
const conversationsPanel = readFileSync('components/whatsapp/WhatsAppConversationsPanel.tsx', 'utf8');
const botSettingsPanel = readFileSync('components/whatsapp/WhatsAppBotSettingsPanel.tsx', 'utf8');
const attendantsPanel = readFileSync('components/whatsapp/WhatsAppAttendantsPanel.tsx', 'utf8');
const internalBotTester = readFileSync('components/whatsapp/WhatsAppInternalBotTester.tsx', 'utf8');
const responseCenterPanel = readFileSync('components/whatsapp/WhatsAppResponseCenterPanel.tsx', 'utf8');

[
  'WhatsAppConnectionPanel',
  'WhatsAppMigrationChecklist',
  'WhatsAppConversationsPanel',
  'WhatsAppBotSettingsPanel',
  'WhatsAppAttendantsPanel',
  'WhatsAppInternalBotTester',
  'WhatsAppResponseCenterPanel',
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
  'WhatsAppResponseCenterPanel',
  'Centro de respostas',
  'Mensagens editaveis do bot',
  'Mensagens padrao',
  'Respostas por gatilho',
  'getSettings',
  'updateSettings',
  'listRules',
  'createRule',
  'updateRule',
  'uploadAttachment',
  'RuleEditor',
  'Carrinho abandonado',
  'Nova resposta',
  'Todas salvas na VPS',
].forEach((needle) => {
  assert.ok(responseCenterPanel.includes(needle), `response center panel must include ${needle}`);
});

[
  'WhatsAppBotSettingsPanel',
  'getSettings',
  'updateSettings',
  'enabled',
  'botEnabled',
  'toggleBotEnabled',
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
  routes.includes('path: "/admin/atendimento-automatico"'),
  'legacy AutoResponder route must remain during phase 1',
);

console.log('whatsapp connection center static checks passed');
