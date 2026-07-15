import assert from 'node:assert/strict';
import fs from 'node:fs';

const forbidden = [
  'runN8nBotIdleFollowups',
  'scheduleN8nBotIdleFollowups',
  'N8N_BOT_IDLE_',
  '/n8n-bot/idle-followups/run',
  'idle-followup',
  'idle-close',
  'idle_followup_sent_at',
  'idle_closed_at',
  'idle_suppressed_at',
  'idle_suppressed_reason',
  'Ainda posso te ajudar a escolher seu produto?',
  'Vou encerrar este atendimento por enquanto',
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  for (const marker of forbidden) {
    assert.ok(!source.includes(marker), `${file}: removed idle flow marker remains: ${marker}`);
  }
}

const service = fs.readFileSync('services/n8nBotControlService.ts', 'utf8');
for (const marker of ['idle_followup_sent_at', 'idle_closed_at', 'idle_suppressed_at', 'idle_suppressed_reason']) {
  assert.ok(!service.includes(marker), `front service must not expose obsolete idle state: ${marker}`);
}

console.log('n8n idle reminder and close flow removal checks passed');
