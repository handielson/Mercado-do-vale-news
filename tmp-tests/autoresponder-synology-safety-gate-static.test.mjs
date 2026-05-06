import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'tools', 'check-autoresponder-synology-safety-gate.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-synology-safety-gate.md');
const botPath = path.join(root, 'Bot_Whatsapp.md');

for (const filePath of [scriptPath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  'Synology.md',
  'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
  'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
  'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
  'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
  'blocked',
  'read_only',
  'forbidden_actions',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
]) {
  assert.ok(script.includes(token), `safety gate script should include ${token}`);
}

for (const forbidden of [
  'ssh ',
  'scp ',
  'curl ',
  'Invoke-WebRequest',
  'cloudflared tunnel run',
  'config.yml',
  'crontab -',
  'pm2 restart',
  'AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1',
  'rm -rf',
]) {
  assert.ok(!script.includes(forbidden), `safety gate script must not include ${forbidden}`);
}

assert.ok(script.includes('missingConfirmations.length > 0'), 'safety gate should fail closed when confirmations are missing');
assert.ok(script.includes('process.exitCode = 1'), 'safety gate should return non-zero when blocked');
assert.ok(script.includes('ok: !blocked'), 'safety gate should only be ok when unblocked');

const doc = fs.readFileSync(docPath, 'utf8');
for (const token of [
  '# Safety gate Synology',
  'falha fechado',
  'RAM/swap',
  'túnel',
  'DSM API',
  '--token',
  'não altera Synology',
]) {
  assert.ok(doc.includes(token), `safety gate doc should include ${token}`);
}

const bot = fs.readFileSync(botPath, 'utf8');
assert.ok(bot.includes('Fase 3AD local'), 'Bot_Whatsapp.md should document Fase 3AD');
assert.ok(bot.includes('check-autoresponder-synology-safety-gate.cjs'), 'Bot_Whatsapp.md should mention safety gate script');

console.log('autoresponder Synology safety gate static checks passed');
