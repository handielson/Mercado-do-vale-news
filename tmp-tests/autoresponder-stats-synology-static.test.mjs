import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const serverPath = path.join(root, 'vps_server.cjs');
const servicePath = path.join(root, 'services', 'autoResponderService.ts');
const typesPath = path.join(root, 'types', 'autoResponder.ts');
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = fs.readFileSync(serverPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  'function emptyAutoresponderStats',
  "source === 'synology'",
  'loadAutoresponderSynologyStats',
  "source: 'synology'",
  'warning',
  'Synology stats archive is not available yet',
].forEach((token) => {
  assert(server.includes(token), `Stats endpoint must include ${token}`);
});

[
  'getStats: (filters: { source?:',
  "withQuery('/autoresponder/stats', filters)",
].forEach((token) => {
  assert(service.includes(token), `autoResponderService.getStats must include ${token}`);
});

assert(types.includes("source?: 'mysql' | 'synology';"), 'AutoResponderStats must type source');
assert(types.includes('warning?: string;'), 'AutoResponderStats must type warning');

[
  'statsSource',
  'statsFrom',
  "setStatsSource('mysql')",
  "setStatsSource('synology')",
  "statsSource === 'synology' ? statsFrom : undefined",
  'stats?.warning',
].forEach((token) => {
  assert(page.includes(token), `Stats UI must include ${token}`);
});

assert(doc.includes('- [x] `GET /autoresponder/stats?source=synology&from=YYYY-MM-DD`'), 'Bot_Whatsapp.md must mark Synology stats endpoint');
assert(doc.includes('- [x] Switch para histórico Synology (?source=synology)'), 'Bot_Whatsapp.md must mark Synology history switch');

console.log('autoresponder stats synology static checks passed');
