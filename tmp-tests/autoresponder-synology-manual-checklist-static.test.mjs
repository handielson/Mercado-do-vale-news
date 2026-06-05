import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc, resolveBotWhatsappDocPath } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const botPath = resolveBotWhatsappDocPath(root);
const scriptPath = path.join(root, 'tools', 'print-autoresponder-synology-manual-checklist.cjs');

for (const filePath of [scriptPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  'manual_only',
  'read_only',
  'does_not_execute_remote_checks',
  'Synology.md',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
  'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
  'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
  'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
  'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
  'forbidden_actions',
]) {
  assert.ok(script.includes(token), `manual checklist script should include ${token}`);
}

for (const forbidden of [
  'child_process',
  'execSync',
  'spawn',
  'ssh ',
  'scp ',
  'curl ',
  'fetch(',
  'axios',
  'cloudflared tunnel run',
  'crontab -',
  'pm2 restart',
  'AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1',
  'rm -rf',
]) {
  assert.ok(!script.includes(forbidden), `manual checklist script must not include ${forbidden}`);
}

const bot = readBotWhatsappDoc(root);
for (const token of [
  'Fase 3AE local',
  'Checklist manual',
  'print-autoresponder-synology-manual-checklist.cjs',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
]) {
  assert.ok(bot.includes(token), `archived bot doc should include ${token}`);
}

console.log('autoresponder Synology manual checklist static checks passed');
