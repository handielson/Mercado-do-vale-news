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
  'unansweredQuestions',
  'curationSearch',
  'curationActionQuestion',
  'filteredUnansweredQuestions',
].forEach((stateName) => {
  assert(page.includes(stateName), `AutoResponderPage must manage ${stateName}`);
});

[
  'autoResponderService.listUnanswered',
  'openRuleModalFromUnansweredQuestion',
  'setIsRuleModalOpen(true)',
].forEach((callName) => {
  assert(page.includes(callName), `Curation tab must include ${callName}`);
});

[
  'Curadoria',
  'Pergunta',
  'Frequência',
  'Última vez',
  'Ações',
  'Criar resposta',
  'Ignorar',
  'Perguntas sem resposta',
  'Revise e salve a resposta sugerida',
].forEach((label) => {
  assert(page.includes(label), `Curation tab must render label: ${label}`);
});

assert(page.includes('listUnanswered({ limit: 100 })'), 'Dashboard must load unanswered questions with limit 100');
assert(page.includes('setUnansweredQuestions'), 'Curation tab must update unanswered question list');
assert(page.includes('pattern: question.question'), 'Curation tab must prefill rule pattern from unanswered question');
assert(page.includes('active: false'), 'Curation tab must open suggested rules as inactive drafts');

assert(doc.includes('- [x] Tabela com pergunta / frequência / última vez / ações'), 'Bot_Whatsapp.md must mark curation table checklist item');
assert(doc.includes('- [x] Botão "Criar resposta" (abre modal da Aba Respostas pré-preenchido)'), 'Bot_Whatsapp.md must mark create answer checklist item');
assert(doc.includes('- [x] Botão "Ignorar"'), 'Bot_Whatsapp.md must mark ignore checklist item');
assert(doc.includes('- [x] Curadoria abre modal de resposta pré-preenchido'), 'Bot_Whatsapp.md must mark curation modal flow item');

console.log('autoresponder curation tab static checks passed');
