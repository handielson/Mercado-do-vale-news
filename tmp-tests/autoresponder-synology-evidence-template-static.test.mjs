import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'tools', 'validate-autoresponder-synology-manual-evidence.cjs');
const templatePath = path.join(root, 'docs', 'operacional', 'autoresponder-synology-manual-evidence.example.json');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-synology-evidence-template.md');
const botPath = path.join(root, 'Bot_Whatsapp.md');

for (const filePath of [scriptPath, templatePath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  'manual evidence',
  'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
  'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
  'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
  'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
  'read_only',
  'does_not_touch_synology',
  'mdv-videos',
  '7680ed44-a7a9-4700-a37e-2026b3653360',
  'forbidden_actions',
]) {
  assert.ok(script.includes(token), `evidence validator should include ${token}`);
}

for (const forbidden of [
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
  assert.ok(!script.includes(forbidden), `evidence validator must not include ${forbidden}`);
}

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
assert.equal(template.source_of_truth, 'Synology.md');
assert.equal(template.canonical_tunnel.name, 'mdv-videos');
assert.equal(template.canonical_tunnel.uuid, '7680ed44-a7a9-4700-a37e-2026b3653360');
assert.equal(template.checks.length, 4, 'template should have four manual checks');
for (const check of template.checks) {
  assert.equal(check.confirmed, false, `${check.id} should default to unconfirmed`);
  assert.ok(check.env.startsWith('AUTORESPONDER_SYNOLOGY_'), `${check.id} should map to gate env`);
  assert.ok(typeof check.evidence === 'string', `${check.id} should include evidence field`);
}

assert.ok(script.includes('missingConfirmations.length === 0'), 'validator should reject missing confirmations');
assert.ok(script.includes('evidenceText.length > 0'), 'validator should require evidence text');
assert.ok(script.includes('process.exitCode = 1'), 'validator should exit non-zero when evidence is incomplete');

const doc = fs.readFileSync(docPath, 'utf8');
for (const token of [
  '# Template de evidências Synology',
  'somente leitura',
  'não altera Synology',
  'não reinicia túnel',
  'não altera crontab',
  'manual',
  'safety gate',
]) {
  assert.ok(doc.includes(token), `evidence doc should include ${token}`);
}

const bot = fs.readFileSync(botPath, 'utf8');
assert.ok(bot.includes('Fase 3AF local'), 'Bot_Whatsapp.md should document Fase 3AF');
assert.ok(bot.includes('validate-autoresponder-synology-manual-evidence.cjs'), 'Bot_Whatsapp.md should mention evidence validator');

console.log('autoresponder Synology evidence template static checks passed');
