import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc, resolveBotWhatsappDocPath } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const botPath = resolveBotWhatsappDocPath(root);
const scriptPath = path.join(root, 'tools', 'validate-autoresponder-synology-manual-evidence.cjs');
const templatePath = path.join(root, 'docs', 'operacional', 'autoresponder-synology-manual-evidence.example.json');

for (const filePath of [scriptPath, botPath]) {
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

if (fs.existsSync(templatePath)) {
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
}

assert.ok(script.includes('missingConfirmations.length === 0'), 'validator should reject missing confirmations');
assert.ok(script.includes('evidenceText.length > 0'), 'validator should require evidence text');
assert.ok(script.includes('process.exitCode = 1'), 'validator should exit non-zero when evidence is incomplete');

const bot = readBotWhatsappDoc(root);
for (const token of [
  'Fase 3AF local',
  'manual',
  'safety gate',
  'autoresponder-synology-manual-evidence.example.json',
  'validate-autoresponder-synology-manual-evidence.cjs',
]) {
  assert.ok(bot.includes(token), `archived bot doc should include ${token}`);
}

console.log('autoresponder Synology evidence template static checks passed');
