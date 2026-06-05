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
  'rules',
  'tags',
  'ruleStatusFilter',
  'ruleTagFilter',
  'ruleSearch',
  'editingRule',
  'ruleForm',
].forEach((stateName) => {
  assert(page.includes(stateName), `AutoResponderPage must manage ${stateName}`);
});

[
  'autoResponderService.listRules',
  'autoResponderService.listTags',
  'autoResponderService.createRule',
  'autoResponderService.updateRule',
].forEach((callName) => {
  assert(page.includes(callName), `Rules tab must call ${callName}`);
});

[
  'Nova resposta',
  'Editar resposta',
  'Palavras-chave',
  'Tipo de resposta',
  'Prioridade',
  'Acertos',
  'Salvar resposta',
].forEach((label) => {
  assert(page.includes(label), `Rules tab must render label: ${label}`);
});

assert(page.includes('filteredRules'), 'Rules tab must filter rules before rendering');
assert(page.includes('reply_type') && page.includes('match_type'), 'Rules form must edit reply_type and match_type');
assert(page.includes('tag_ids'), 'Rules form must support tag_ids');
assert(page.includes('reply_text'), 'Rules form must support reply_text');
assert(page.includes('active'), 'Rules form must support active status');

assert(doc.includes('- [x] Tabela com nome / palavras-chave / acertos / status / ações'), 'Bot_Whatsapp.md must mark rules table checklist item');
assert(doc.includes('- [x] Filtro por tag + busca'), 'Bot_Whatsapp.md must mark rules filters checklist item');
assert(doc.includes('- [x] Botão "+ Nova resposta" + dropdown "Usar template"'), 'Bot_Whatsapp.md must mark new response checklist item');
assert(doc.includes('- [x] Modal de edição com preview ao vivo'), 'Bot_Whatsapp.md must mark modal checklist item');

console.log('autoresponder rules tab static checks passed');
