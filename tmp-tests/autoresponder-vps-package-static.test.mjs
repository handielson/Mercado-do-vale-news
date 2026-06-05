import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const toolPath = path.join(root, 'tools', 'prepare-autoresponder-archive-vps-package.cjs');
const docPath = path.join(root, 'docs', 'operacional', '2026-05-05-autoresponder-archive-vps-package.md');
const gitignorePath = path.join(root, '.gitignore');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(toolPath), 'VPS package tool must exist');
assert(fs.existsSync(docPath), 'VPS package operational document must exist');

const tool = fs.readFileSync(toolPath, 'utf8');
const doc = readBotWhatsappDoc(root);
const botDoc = readBotWhatsappDoc(root);
const gitignore = fs.readFileSync(gitignorePath, 'utf8');

[
  "const PACKAGE_DIR",
  'autoresponder-archive-vps-package',
  'cron/archive-autoresponder-logs.cjs',
  'cron/archive-autoresponder-logs.sh',
  'docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md',
  "crypto.createHash('sha256')",
  'manifest.json',
  'copyPackageFile',
  'writeManifest',
].forEach((token) => {
  assert(tool.includes(token), `package tool must include ${token}`);
});

[
  '# Pacote VPS — Archive AutoResponder',
  'tools/prepare-autoresponder-archive-vps-package.cjs',
  'reports/autoresponder-archive-vps-package/manifest.json',
  'scp',
  'sha256',
  '/var/www/mdv-api/cron/archive-autoresponder-logs.cjs',
  '/var/www/mdv-api/cron/archive-autoresponder-logs.sh',
  'chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh',
  'AUTORESPONDER_ARCHIVE_DRY_RUN=1',
  'NÃO ativar crontab nesta fase',
].forEach((token) => {
  assert(doc.includes(token), `package doc must include ${token}`);
});

assert(gitignore.includes('reports/autoresponder-archive-vps-package/'), 'package output must be ignored');
assert(botDoc.includes('### 2026-05-05 — Fase 3Y local'), 'Bot_Whatsapp.md must document Fase 3Y');
assert(botDoc.includes('prepare-autoresponder-archive-vps-package.cjs'), 'Bot_Whatsapp.md must mention package tool');

console.log('autoresponder VPS package static checks passed');
