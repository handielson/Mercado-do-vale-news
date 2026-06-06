import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const doc = readBotWhatsappDoc(root);

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
  "label: 'Sauda",
  "label: 'Produto por tag'",
  "label: 'Busca",
  'Aplicar template',
].forEach((token) => {
  assert(page.includes(token), `Phase 3 coverage must include template token: ${token}`);
});

[
  'openRuleModalFromUnansweredQuestion',
  'setCurationDraftQuestion(question.question)',
  'setIsRuleModalOpen(true)',
  'pattern: question.question',
  'active: true',
  'createRuleFromQuestion',
  'deleteUnanswered',
  'Revise e salve a resposta sugerida',
  'Criar resposta',
].forEach((token) => {
  assert(page.includes(token), `Phase 3 coverage must include curation token: ${token}`);
});

assert(doc.includes('- [x] Filtros funcionando em todas as listagens'), 'Bot_Whatsapp.md must mark filters coverage');
assert(doc.includes('- [x] Templates'), 'Bot_Whatsapp.md must mark template coverage');
assert(
  doc.includes('- [x] Curadoria → criar resposta funciona end-to-end') ||
    doc.includes('- [x] Curadoria -> criar resposta funciona end-to-end'),
  'Bot_Whatsapp.md must mark curation end-to-end coverage'
);

console.log('autoresponder phase 3 admin coverage static checks passed');
