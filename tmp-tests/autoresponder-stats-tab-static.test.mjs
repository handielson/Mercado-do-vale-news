import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const typePath = path.join(root, 'types', 'autoResponder.ts');
const vpsPath = path.join(root, 'vps_server.cjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const types = fs.readFileSync(typePath, 'utf8');
const vps = fs.readFileSync(vpsPath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  'responseRate',
  'maxIntentTotal',
  'stats?.topProducts',
  'stats?.topRules',
  'stats?.byIntent',
].forEach((token) => {
  assert(page.includes(token), `Stats tab must include ${token}`);
});

[
  'Mensagens 7 dias',
  'Contatos únicos',
  'Taxa de resposta',
  'Fora de cobertura',
  'Gráfico por intent',
  'Top produtos perguntados',
  'Top regras',
  'Tempo médio',
  'Histórico Synology',
].forEach((label) => {
  assert(page.includes(label), `Stats tab must render label: ${label}`);
});

assert(types.includes('topProducts?: Array<{ id: string; name: string; sku?: string | null; total: number }>'), 'AutoResponderStats must type topProducts');
assert(types.includes('avg_response_time_ms?: number'), 'AutoResponderStats summary must type avg_response_time_ms');
assert(vps.includes('async function getAutoresponderTopProducts'), 'VPS must aggregate top products safely');
assert(vps.includes('matched_products IS NOT NULL'), 'VPS top products must read matched_products');
assert(vps.includes("return { source: 'mysql', summary, byIntent, topRules, topProducts }"), 'Stats endpoint must return source and topProducts');

assert(doc.includes('- [x] KPIs (cards no topo)'), 'Bot_Whatsapp.md must mark KPI checklist item');
assert(doc.includes('- [x] Pizza por intent'), 'Bot_Whatsapp.md must mark intent chart checklist item');
assert(doc.includes('- [x] Top produtos perguntados'), 'Bot_Whatsapp.md must mark top products checklist item');
assert(doc.includes('- [x] Top regras'), 'Bot_Whatsapp.md must mark top rules checklist item');
assert(doc.includes('- [x] Tempo médio de resposta'), 'Bot_Whatsapp.md must mark average response time checklist item');

console.log('autoresponder stats tab static checks passed');
