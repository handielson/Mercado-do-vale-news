import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc, resolveBotWhatsappDocPath } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const botPath = resolveBotWhatsappDocPath(root);
const scriptPath = path.join(root, 'tools', 'check-autoresponder-synology-readiness.cjs');

for (const filePath of [scriptPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  'Synology.md',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
  'dsm-api.xiaomipetrolina.com.br',
  'imagens.xiaomipetrolina.com.br',
  'videos.mercadodovale.com.br',
  'AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR',
  '/volume1/backups/autoresponder',
  'read_only',
  'ram_swap_first',
  'forbidden_actions',
]) {
  assert.ok(script.includes(token), `readiness script should include ${token}`);
}

for (const forbidden of [
  'pkill',
  'cloudflared tunnel run',
  'cat > /volume1/.cloudflared/config.yml',
  'crontab -',
  'AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1',
  'rm -rf',
  '/synology/enqueue-restart',
  '/synology/enqueue-reboot',
]) {
  assert.ok(!script.includes(forbidden), `readiness script must not include ${forbidden}`);
}

const bot = readBotWhatsappDoc(root);
for (const token of [
  'Fase 3AC local',
  'preflight read-only',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
  'check-autoresponder-synology-readiness.cjs',
]) {
  assert.ok(bot.includes(token), `archived bot doc should include ${token}`);
}

console.log('autoresponder Synology readiness static checks passed');
