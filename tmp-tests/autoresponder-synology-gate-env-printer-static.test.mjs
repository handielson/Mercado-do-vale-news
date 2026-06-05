import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc, resolveBotWhatsappDocPath } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const botPath = resolveBotWhatsappDocPath(root);
const scriptPath = path.join(root, 'tools', 'print-autoresponder-synology-gate-env.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-synology-gate-env.md');

for (const filePath of [scriptPath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  'print_only',
  'read_only',
  'does_not_set_env',
  'does_not_touch_synology',
  'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
  'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
  'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
  'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
  'PowerShell',
  '$env:',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
  'forbidden_actions',
]) {
  assert.ok(script.includes(token), `gate env printer should include ${token}`);
}

for (const forbidden of [
  'process.env.AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK =',
  'process.env.AUTORESPONDER_SYNOLOGY_TUNNEL_OK =',
  'process.env.AUTORESPONDER_SYNOLOGY_DSM_API_OK =',
  'process.env.AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT =',
  'child_process',
  'execSync',
  'spawn',
  'ssh ',
  'scp ',
  'curl ',
  'fetch(',
  'cloudflared tunnel run',
  'crontab -',
  'pm2 restart',
  'AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1',
  'rm -rf',
]) {
  assert.ok(!script.includes(forbidden), `gate env printer must not include ${forbidden}`);
}

assert.ok(script.includes('missingConfirmations.length === 0'), 'printer should require complete evidence');
assert.ok(script.includes('process.exitCode = 1'), 'printer should fail non-zero when evidence is incomplete');

const doc = readBotWhatsappDoc(root);
for (const token of [
  '# Comandos locais do safety gate',
  'somente leitura',
  'não altera Synology',
  'não define variáveis automaticamente',
  'PowerShell',
  'safety gate',
]) {
  assert.ok(doc.includes(token), `gate env doc should include ${token}`);
}

const bot = readBotWhatsappDoc(root);
assert.ok(bot.includes('Fase 3AG local'), 'Bot_Whatsapp.md should document Fase 3AG');
assert.ok(bot.includes('print-autoresponder-synology-gate-env.cjs'), 'Bot_Whatsapp.md should mention gate env printer');

console.log('autoresponder Synology gate env printer static checks passed');
