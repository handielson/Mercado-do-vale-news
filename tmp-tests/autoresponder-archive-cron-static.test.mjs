import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'cron', 'archive-autoresponder-logs.cjs');
const wrapperPath = path.join(root, 'cron', 'archive-autoresponder-logs.sh');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(scriptPath), 'archive Node script must exist');
assert(fs.existsSync(wrapperPath), 'archive shell wrapper must exist');

const script = fs.readFileSync(scriptPath, 'utf8');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  "require('dotenv')",
  "require('mysql2/promise')",
  "require('zlib')",
  "crypto.createHash('sha256')",
  'AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR',
  'AUTORESPONDER_ARCHIVE_DRY_RUN',
  'AUTORESPONDER_ARCHIVE_DELETE_ENABLED',
  'getYesterdayBrtDate',
  'SELECT * FROM autoresponder_logs',
  'created_at >= ? AND created_at < ?',
  'zlib.gzipSync',
  'JSON.stringify(payload)',
  'sha256',
  'cleanup skipped',
].forEach((token) => {
  assert(script.includes(token), `archive script must include ${token}`);
});

assert(!script.includes('DELETE FROM autoresponder_logs'), 'archive script must not delete logs in this phase');
assert(wrapper.includes('node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs'), 'wrapper must run the Node archive script');
assert(doc.includes('### 2026-05-05 — Fase 3V local'), 'Bot_Whatsapp.md must document Fase 3V');
assert(doc.includes('cron/archive-autoresponder-logs.cjs'), 'Bot_Whatsapp.md must mention Node archive script');
assert(doc.includes('cron/archive-autoresponder-logs.sh'), 'Bot_Whatsapp.md must mention shell archive wrapper');

console.log('autoresponder archive cron static checks passed');
