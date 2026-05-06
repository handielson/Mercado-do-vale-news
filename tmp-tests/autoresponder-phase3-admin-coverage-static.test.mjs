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
  "label: 'Saudação'",
  "label: 'Produto por tag'",
  "label: 'Busca livre'",
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
  doc.includes('- [x] Templates pré-cadastrados aparecem no dropdown'),
  'Bot_Whatsapp.md must mark template coverage'
);
assert(
  doc.includes('- [ ] Curadoria → criar resposta funciona end-to-end'),
  'Bot_Whatsapp.md must keep true end-to-end curation unchecked'
);

console.log('autoresponder phase 3 admin coverage static checks passed');
