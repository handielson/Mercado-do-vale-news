import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc, resolveBotWhatsappDocPath } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const botPath = resolveBotWhatsappDocPath(root);
const scriptPath = path.join(root, 'tools', 'install-autoresponder-schema-vps-dry-run.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-schema-vps-dry-run.md');

for (const filePath of [scriptPath, docPath, botPath]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(root, filePath)} should exist`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
for (const token of [
  "process.env.VPS_ROOT_PASSWORD",
  "process.env.AUTORESPONDER_SCHEMA_INSTALL_APPLY === '1'",
  "CREATE TABLE IF NOT EXISTS autoresponder_settings",
  "CREATE TABLE IF NOT EXISTS autoresponder_rules",
  "CREATE TABLE IF NOT EXISTS autoresponder_tags",
  "CREATE TABLE IF NOT EXISTS autoresponder_logs",
  "CREATE TABLE IF NOT EXISTS autoresponder_conversations",
  "CREATE TABLE IF NOT EXISTS autoresponder_blocklist",
  "INSERT IGNORE INTO autoresponder_settings",
  "addColumnIfMissing",
  "products",
  "tag_ids",
  "SELECT table_name",
  "/var/www/mdv-api/.env",
  "pm2 is not restarted",
  "crontab is not changed",
]) {
  assert.ok(script.includes(token), `schema installer should include ${token}`);
}

assert.ok(!script.includes('AUTORESPONDER_TOKEN='), 'schema installer must not define webhook token');
assert.ok(!script.includes('DROP TABLE'), 'schema installer must not drop tables');
assert.ok(!script.includes('DELETE FROM'), 'schema installer must not delete data');

const doc = readBotWhatsappDoc(root);
for (const token of [
  "# Schema dry-run na VPS — AutoResponder",
  "Table 'mercadodovale.autoresponder_logs' doesn't exist",
  "AUTORESPONDER_SCHEMA_INSTALL_APPLY=1",
  "VPS_ROOT_PASSWORD",
  "node tools/install-autoresponder-schema-vps-dry-run.cjs",
  "não ativa crontab",
  "não reinicia PM2",
  "não apaga dados",
]) {
  assert.ok(doc.includes(token), `schema doc should include ${token}`);
}

const bot = readBotWhatsappDoc(root);
assert.ok(bot.includes('Fase 3AA local'), 'Bot_Whatsapp.md should document Fase 3AA');
assert.ok(bot.includes('install-autoresponder-schema-vps-dry-run.cjs'), 'Bot_Whatsapp.md should mention schema installer');

console.log('autoresponder VPS schema install static checks passed');
