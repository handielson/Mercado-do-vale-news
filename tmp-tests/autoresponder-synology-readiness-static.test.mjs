import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'tools', 'check-autoresponder-synology-readiness.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-synology-readiness.md');
const botPath = path.join(root, 'Bot_Whatsapp.md');

for (const filePath of [scriptPath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  "Synology.md",
  "mdv-videos",
  "7680ed44-a7a9-4700-a37e-2026b3653360",
  "dsm-api.xiaomipetrolina.com.br",
  "imagens.xiaomipetrolina.com.br",
  "videos.mercadodovale.com.br",
  "AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR",
  "/volume1/backups/autoresponder",
  "read_only",
  "ram_swap_first",
  "forbidden_actions",
]) {
  assert.ok(script.includes(token), `readiness script should include ${token}`);
}

for (const forbidden of [
  "pkill",
  "cloudflared tunnel run",
  "cat > /volume1/.cloudflared/config.yml",
  "crontab -",
  "AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1",
  "rm -rf",
  "/synology/enqueue-restart",
  "/synology/enqueue-reboot",
]) {
  assert.ok(!script.includes(forbidden), `readiness script must not include ${forbidden}`);
}

const doc = fs.readFileSync(docPath, 'utf8');
for (const token of [
  "# Preflight read-only Synology — Archive AutoResponder",
  "não altera o Synology",
  "não reinicia túnel",
  "não altera DNS",
  "não altera crontab",
  "RAM e swap",
  "mdv-videos",
  "7680ed44-a7a9-4700-a37e-2026b3653360",
  "node tools/check-autoresponder-synology-readiness.cjs",
]) {
  assert.ok(doc.includes(token), `readiness doc should include ${token}`);
}

const bot = fs.readFileSync(botPath, 'utf8');
assert.ok(bot.includes('Fase 3AC local'), 'Bot_Whatsapp.md should document Fase 3AC');
assert.ok(bot.includes('check-autoresponder-synology-readiness.cjs'), 'Bot_Whatsapp.md should mention readiness script');

console.log('autoresponder Synology readiness static checks passed');
