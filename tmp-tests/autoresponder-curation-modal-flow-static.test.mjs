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
const service = fs.readFileSync(path.join(root, 'services', 'autoResponderService.ts'), 'utf8');

[
  'const openRuleModalFromUnansweredQuestion = (question: AutoResponderUnansweredQuestion)',
  'setEditingRule(null)',
  'setCurationDraftQuestion(question.question)',
  'setRuleForm({',
  'name: `Curadoria: ${question.question.slice(0, 60)}`',
  'pattern: question.question',
  "match_type: 'exact'",
  "reply_type: 'text'",
  'active: true',
  'setIsRuleModalOpen(true)',
  "setCurationNotice('Revise e salve a resposta sugerida')",
  'onClick={() => openRuleModalFromUnansweredQuestion(question)}',
].forEach((token) => {
  assert(page.includes(token), `Curation modal flow must include ${token}`);
});

assert(
  page.includes('await autoResponderService.createRuleFromQuestion({'),
  'Saving a curated answer must use the curation endpoint after the admin reviews the modal'
);
assert(
  page.includes('await autoResponderService.deleteUnanswered('),
  'Saving a curated answer must clear the answered fallback question'
);
assert(
  page.includes("setUnansweredQuestions((current) => current.filter((item) => item.question !== ruleForm.pattern))"),
  'Saving a curated rule must remove the answered question from the local curation list'
);
assert(page.includes('curationDraftQuestion'), 'AutoResponderPage must track when the modal was opened from curation');
assert(service.includes('deleteUnanswered'), 'autoResponderService must expose deleteUnanswered');

for (const serverFile of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  assert(
    fs.readFileSync(path.join(root, serverFile), 'utf8').includes("fastify.delete('/autoresponder/unanswered'"),
    `${serverFile} must implement DELETE /autoresponder/unanswered`
  );
}

assert(
  doc.includes('- [x] Curadoria abre modal de resposta'),
  'Bot_Whatsapp.md must mark curation modal flow'
);

console.log('autoresponder curation modal flow static checks passed');
