import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'tools', 'print-autoresponder-synology-manual-checklist.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-synology-manual-checklist.md');
const botPath = path.join(root, 'Bot_Whatsapp.md');

for (const filePath of [scriptPath, docPath, botPath]) {
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

const doc = fs.readFileSync(docPath, 'utf8');
for (const token of [
  '# Checklist manual Synology',
  'somente leitura',
  'RAM/swap',
  'túnel canônico',
  'DSM API',
  '--token',
  'não altera Synology',
  'não reinicia túnel',
  'não altera crontab',
]) {
  assert.ok(doc.includes(token), `manual checklist doc should include ${token}`);
}

const bot = fs.readFileSync(botPath, 'utf8');
assert.ok(bot.includes('Fase 3AE local'), 'Bot_Whatsapp.md should document Fase 3AE');
assert.ok(bot.includes('print-autoresponder-synology-manual-checklist.cjs'), 'Bot_Whatsapp.md should mention manual checklist script');

console.log('autoresponder Synology manual checklist static checks passed');
