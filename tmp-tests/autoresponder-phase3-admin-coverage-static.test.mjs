import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'ruleStatusFilter',
  'ruleTagFilter',
  'ruleSearch',
  'conversationStatusFilter',
  'conversationTagFilter',
  'conversationSearch',
  'blocklistSearch',
  'curationSearch',
  'tagSearch',
  'filteredRules',
  'filteredConversations',
  'filteredBlocklist',
  'filteredUnansweredQuestions',
  'filteredTags',
].forEach((token) => {
  assert(page.includes(token), `Phase 3 coverage must include filter token: ${token}`);
});

[
  'ruleTemplates',
  "label: 'Saud",
  "label: 'Lista de celulares'",
  "label: 'Produto por tag'",
  "label: 'Busca por modelo'",
  'Aplicar template',
].forEach((token) => {
  assert(page.includes(token), `Phase 3 coverage must include template token: ${token}`);
});

[
  'openRuleModalFromUnansweredQuestion',
  'setIsRuleModalOpen(true)',
  'pattern: question.question',
  "active: false",
  'Revise e salve a resposta sugerida',
  'Criar resposta',
].forEach((token) => {
  assert(page.includes(token), `Phase 3 coverage must include curation token: ${token}`);
});

assert(
  doc.includes('- [x] Filtros funcionando em todas as listagens'),
  'Bot_Whatsapp.md must mark filters coverage'
);
assert(
  /- \[x\] Templates .*aparecem no dropdown/.test(doc),
  'Bot_Whatsapp.md must mark template coverage'
);
assert(
  /- \[x\] Curadoria.*criar resposta funciona end-to-end/.test(doc),
  'Bot_Whatsapp.md must mark true end-to-end curation checked after VPS validation'
);

console.log('autoresponder phase 3 admin coverage static checks passed');
