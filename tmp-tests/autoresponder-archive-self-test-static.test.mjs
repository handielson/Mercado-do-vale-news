import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const scriptPath = path.join(root, 'cron', 'archive-autoresponder-logs.cjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const script = fs.readFileSync(scriptPath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  "process.argv.includes('--self-test')",
  'runSelfTest',
  'AUTORESPONDER_ARCHIVE_SELF_TEST_DIR',
  "archive_date: '2026-05-04'",
  "intent: 'product_search'",
  'verifyArchiveChecksum',
  'zlib.gunzipSync',
  'self_test: true',
].forEach((token) => {
  assert(script.includes(token), `archive self-test support must include ${token}`);
});

assert(doc.includes('### 2026-05-05 — Fase 3W local'), 'Bot_Whatsapp.md must document Fase 3W');
assert(doc.includes('`node cron/archive-autoresponder-logs.cjs --self-test`'), 'Bot_Whatsapp.md must document self-test command');

console.log('autoresponder archive self-test static checks passed');
