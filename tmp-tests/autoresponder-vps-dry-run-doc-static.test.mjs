import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-archive-vps-dry-run.md');
const botDocPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(docPath), 'VPS dry-run validation document must exist');

const doc = fs.readFileSync(docPath, 'utf8');
const botDoc = fs.readFileSync(botDocPath, 'utf8');

[
  '# Validação VPS — Archive AutoResponder em dry-run',
  'AUTORESPONDER_ARCHIVE_DRY_RUN=1',
  'AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0',
  'node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs --self-test',
  'AUTORESPONDER_ARCHIVE_DRY_RUN=1 node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs YYYY-MM-DD',
  'node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs',
  'crontab -l',
  'NÃO adicionar ainda',
  '/volume1/backups/autoresponder/YYYY/MM/DD.json.gz',
  'cleanup skipped',
].forEach((token) => {
  assert(doc.includes(token), `VPS dry-run doc must include ${token}`);
});

assert(botDoc.includes('### 2026-05-05 — Fase 3X local'), 'Bot_Whatsapp.md must document Fase 3X');
assert(botDoc.includes('2026-05-05-autoresponder-archive-vps-dry-run.md'), 'Bot_Whatsapp.md must link the dry-run document');

console.log('autoresponder VPS dry-run doc static checks passed');
