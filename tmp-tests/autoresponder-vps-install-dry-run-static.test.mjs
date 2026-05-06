import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const installerPath = path.join(root, 'tools', 'install-autoresponder-archive-vps-dry-run.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-archive-vps-install-dry-run.md');
const botPath = path.join(root, 'Bot_Whatsapp.md');

for (const filePath of [installerPath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const installer = fs.readFileSync(installerPath, 'utf8');
for (const token of [
  "process.env.VPS_ROOT_PASSWORD",
  "process.env.AUTORESPONDER_ARCHIVE_INSTALL_APPLY === '1'",
  "reports/autoresponder-archive-vps-package",
  "manifest.json",
  "archive-autoresponder-logs.cjs",
  "archive-autoresponder-logs.sh",
  "docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md",
  "/var/www/mdv-api",
  "mkdir -p /var/www/mdv-api/cron /var/www/mdv-api/docs/operacional",
  "sha256sum",
  "chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh",
  "node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs",
  "AUTORESPONDER_ARCHIVE_DRY_RUN=1 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0",
  "crontab",
]) {
  assert.ok(installer.includes(token), `installer should include ${token}`);
}

assert.ok(!installer.includes("pm2 restart"), 'installer must not restart PM2');
assert.ok(!installer.includes("AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1"), 'installer must not enable delete');

const doc = fs.readFileSync(docPath, 'utf8');
for (const token of [
  "# Instalação dry-run na VPS — Archive AutoResponder",
  "VPS_ROOT_PASSWORD",
  "AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1",
  "node tools/install-autoresponder-archive-vps-dry-run.cjs",
  "não ativa crontab",
  "não reinicia PM2",
  "não apaga logs",
  "AUTORESPONDER_ARCHIVE_DRY_RUN=1",
  "AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0",
]) {
  assert.ok(doc.includes(token), `doc should include ${token}`);
}

const bot = fs.readFileSync(botPath, 'utf8');
assert.ok(bot.includes('Fase 3Z local'), 'Bot_Whatsapp.md should document Fase 3Z');
assert.ok(bot.includes('install-autoresponder-archive-vps-dry-run.cjs'), 'Bot_Whatsapp.md should mention installer');

console.log('autoresponder VPS install dry-run static checks passed');
