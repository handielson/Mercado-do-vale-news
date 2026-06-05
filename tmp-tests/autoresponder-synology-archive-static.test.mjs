import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const serverPath = path.join(root, 'vps_server.cjs');
const typesPath = path.join(root, 'types', 'autoResponder.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = fs.readFileSync(serverPath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  "const zlib = require('zlib')",
  'AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR',
  'parseAutoresponderArchiveDate',
  "from=YYYY-MM-DD",
  'buildAutoresponderSynologyArchivePath',
  "`${dateParts.day}.json.gz`",
  'zlib.gunzipSync',
  'extractAutoresponderArchiveRows',
  'aggregateAutoresponderArchiveStats',
  'archive_date',
  'Synology stats archive not found',
].forEach((token) => {
  assert(server.includes(token), `Synology archive stats support must include ${token}`);
});

assert(types.includes('archive_date?: string;'), 'AutoResponderStats must type archive_date');
assert(doc.includes('### 2026-05-05 — Fase 3T local'), 'Bot_Whatsapp.md must document Fase 3T');
assert(doc.includes('Leitura segura de `.json.gz`'), 'Bot_Whatsapp.md must document safe .json.gz reading');
assert(doc.includes('tmp-tests\\autoresponder-synology-archive-static.test.mjs'), 'Bot_Whatsapp.md must list archive static test');

console.log('autoresponder synology archive static checks passed');
