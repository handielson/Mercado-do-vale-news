import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const statsSynologyTestPath = path.join(root, 'tmp-tests', 'autoresponder-stats-synology-static.test.mjs');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const statsSynologyTest = fs.readFileSync(statsSynologyTestPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'statsFrom',
  'setStatsFrom',
  "statsSource === 'synology' ? statsFrom : undefined",
  'type="date"',
  'value={statsFrom}',
  'onChange={(event) => setStatsFrom(event.target.value)}',
  'Data do archive',
].forEach((token) => {
  assert(page.includes(token), `Stats tab date filter must include ${token}`);
});

assert(statsSynologyTest.includes("statsSource === 'synology' ? statsFrom : undefined"), 'Synology stats static test must expect from filter');
assert(doc.includes('### 2026-05-05 — Fase 3U local'), 'Bot_Whatsapp.md must document Fase 3U');
assert(doc.includes('Seletor de data na aba Estatísticas'), 'Bot_Whatsapp.md must document the stats date selector');

console.log('autoresponder stats date filter static checks passed');
