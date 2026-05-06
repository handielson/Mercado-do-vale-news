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
  'const openRuleModalFromUnansweredQuestion = (question: AutoResponderUnansweredQuestion)',
  'setEditingRule(null)',
  'setRuleForm({',
  "name: `Curadoria: ${question.question.slice(0, 60)}`",
  'pattern: question.question',
  "match_type: 'exact'",
  "reply_type: 'text'",
  'active: false',
  'setIsRuleModalOpen(true)',
  "setCurationNotice('Revise e salve a resposta sugerida')",
  'onClick={() => openRuleModalFromUnansweredQuestion(question)}',
].forEach((token) => {
  assert(page.includes(token), `Curation modal flow must include ${token}`);
});

assert(
  !page.includes('await autoResponderService.createRuleFromQuestion({'),
  'Curation button must not create the rule before the admin reviews the modal'
);
assert(
  page.includes("setUnansweredQuestions((current) => current.filter((item) => item.question !== ruleForm.pattern))"),
  'Saving a curated rule must remove the answered question from the local curation list'
);
assert(
  doc.includes('- [x] Curadoria abre modal de resposta pré-preenchido'),
  'Bot_Whatsapp.md must mark curation modal flow'
);
assert(
  doc.includes('- [ ] Curadoria → criar resposta funciona end-to-end'),
  'Bot_Whatsapp.md must keep true end-to-end curation unchecked until real UI/API validation'
);

console.log('autoresponder curation modal flow static checks passed');
