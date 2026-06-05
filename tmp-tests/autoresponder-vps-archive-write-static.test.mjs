import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc, resolveBotWhatsappDocPath } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const botPath = resolveBotWhatsappDocPath(root);
const scriptPath = path.join(root, 'tools', 'test-autoresponder-archive-vps-write.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-archive-vps-write-test.md');

for (const filePath of [scriptPath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  "process.env.VPS_ROOT_PASSWORD",
  "process.env.AUTORESPONDER_ARCHIVE_WRITE_APPLY === '1'",
  "AUTORESPONDER_ARCHIVE_DRY_RUN=0",
  "AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0",
  "AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR",
  "/tmp/mdv-autoresponder-archive-write-test",
  "archive-autoresponder-logs.cjs",
  "sha256sum",
  "gzip -t",
  "JSON.parse",
  "archive_date",
  "crontab is not changed",
  "delete mode is not enabled",
]) {
  assert.ok(script.includes(token), `write test script should include ${token}`);
}

assert.ok(!script.includes('AUTORESPONDER_ARCHIVE_DELETE_ENABLED=1'), 'write test must not enable delete');
assert.ok(!script.includes('crontab -'), 'write test must not edit crontab');
assert.ok(!script.includes('pm2 restart'), 'write test must not restart PM2');
assert.ok(!script.includes('rm -rf'), 'write test must not remove directories');

const doc = readBotWhatsappDoc(root);
for (const token of [
  "# Teste de escrita controlada na VPS — Archive AutoResponder",
  "AUTORESPONDER_ARCHIVE_WRITE_APPLY=1",
  "VPS_ROOT_PASSWORD",
  "/tmp/mdv-autoresponder-archive-write-test",
  "não usa o caminho definitivo do Synology",
  "não ativa crontab",
  "não apaga logs",
  "node tools/test-autoresponder-archive-vps-write.cjs",
]) {
  assert.ok(doc.includes(token), `write test doc should include ${token}`);
}

const bot = readBotWhatsappDoc(root);
assert.ok(bot.includes('Fase 3AB local'), 'Bot_Whatsapp.md should document Fase 3AB');
assert.ok(bot.includes('test-autoresponder-archive-vps-write.cjs'), 'Bot_Whatsapp.md should mention write test script');

console.log('autoresponder VPS archive write static checks passed');
