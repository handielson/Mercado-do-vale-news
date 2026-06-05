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
  'const [deletingRuleId, setDeletingRuleId]',
  'const deleteRule = async (rule: AutoResponderRule)',
  'window.confirm',
  'autoResponderService.deleteRule(rule.id)',
  'setDeletingRuleId(rule.id)',
  'setDeletingRuleId(null)',
  'autoResponderService.listRules()',
  'autoResponderService.getStats()',
  'onClick={() => deleteRule(rule)}',
  'disabled={deletingRuleId === rule.id}',
].forEach((token) => {
  assert(page.includes(token), `Rules CRUD flow must include ${token}`);
});

[
  'Editar',
  'Excluir',
  'Excluindo...',
  'Falha ao excluir resposta automática',
].forEach((label) => {
  assert(page.includes(label), `Rules CRUD flow must render label/message: ${label}`);
});

assert(
  page.includes('autoResponderService.createRule(payload)') && page.includes('autoResponderService.updateRule(editingRule.id, payload)'),
  'Rules CRUD flow must keep create and update connected'
);
assert(
  doc.includes('- [x] Criar, editar e excluir respostas com recarregamento da lista'),
  'Bot_Whatsapp.md must mark rules CRUD complete for the Respostas tab'
);

console.log('autoresponder rules CRUD static checks passed');
