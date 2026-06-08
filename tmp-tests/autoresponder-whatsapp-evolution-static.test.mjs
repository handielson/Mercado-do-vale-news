import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');

[
  "id: 'conexao'",
  'WhatsApp Evolution',
  'Gerar QR Code / Conectar',
  'Leia o QR Code abaixo com seu WhatsApp',
  'Tem certeza de que deseja desconectar o WhatsApp?',
].forEach((needle) => {
  assert.ok(page.includes(needle), `AutoResponderPage must include ${needle}`);
});

[
  "getWhatsAppConnectionState",
  "getWhatsAppDebug",
  "connectWhatsApp",
  "disconnectWhatsApp",
  "/autoresponder/whatsapp/debug",
  "/autoresponder/whatsapp/state",
  "/autoresponder/whatsapp/connect",
  "/autoresponder/whatsapp/disconnect",
].forEach((needle) => {
  assert.ok(service.includes(needle) || server.includes(needle), `Evolution API wiring must include ${needle}`);
});

[
  "evolutionStatus",
  "fetchInstances",
  "connectionState",
  "formatEvolutionMessage",
  "number: process.env.EVOLUTION_INSTANCE_NUMBER || ''",
  "events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT']",
  "already exists|existe|exist|in use",
].forEach((needle) => {
  assert.ok(server.includes(needle), `Evolution API debug must expose ${needle}`);
});

[
  "deleteWhatsAppInstance",
  "/autoresponder/whatsapp/instance",
].forEach((needle) => {
  assert.ok(!service.includes(needle) && !server.includes(needle), `Evolution API wiring must not expose ${needle}`);
});

assert.ok(server.includes('EVOLUTION_BASE_URL'), 'VPS server must proxy Evolution API through a base URL');
assert.ok(server.includes('requireSyncKey'), 'Evolution API proxies must stay protected by sync key');

console.log('autoresponder whatsapp evolution static checks passed');
