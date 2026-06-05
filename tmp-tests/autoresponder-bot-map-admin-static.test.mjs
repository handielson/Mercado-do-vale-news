import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');

[
  "id: 'mapa'",
  'Mapa do Bot',
  'Fluxo',
  'Pergunta do bot',
  'Resposta esperada',
  'Fallback contextual',
  'Simular fluxo',
].forEach((needle) => {
  assert.ok(page.includes(needle), `AutoResponderPage must include ${needle}`);
});

assert.ok(service.includes("input.sender?.startsWith('mapa-')"), 'bot map simulation must only accept safe mapa-* senders');
assert.ok(service.includes('sender: safeSender'), 'bot map simulation must send the safe sender to /test-flow');

console.log('autoresponder bot map admin static checks passed');
