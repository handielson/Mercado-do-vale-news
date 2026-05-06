import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'cron', 'archive-autoresponder-logs.cjs');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const script = fs.readFileSync(scriptPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'AUTORESPONDER_ARCHIVE_BATCH_SIZE',
  'fetchAutoresponderLogBatch',
  'writeArchiveFromBatches',
  'zlib.createGzip',
  'createWriteStream',
  'rows_written',
].forEach((token) => {
  assert(script.includes(token), `archive script must include low-memory token ${token}`);
});

assert(script.includes('LIMIT ?'), 'archive script must fetch autoresponder logs in limited batches');
assert(!script.includes('ORDER BY created_at ASC, id ASC'), 'archive script must not keep the original full-day ordering query');
assert(!script.includes('writeArchive({ date, rows })'), 'main archive path must not pass all rows into writeArchive at once');
assert(doc.includes('AUTORESPONDER_ARCHIVE_BATCH_SIZE'), 'Bot_Whatsapp.md must document archive batch size');
assert(doc.includes('baixa memoria') || doc.includes('baixa memória'), 'Bot_Whatsapp.md must mention low-memory archive mode');

console.log('autoresponder archive low-memory static checks passed');
