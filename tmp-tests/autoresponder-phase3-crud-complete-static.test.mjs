import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const servicePath = path.join(root, 'services', 'autoResponderService.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');
const doc = readBotWhatsappDoc(root);

const serviceMethods = [
  'createRule',
  'updateRule',
  'deleteRule',
  'createTag',
  'updateTag',
  'deleteTag',
  'createBlocklistEntry',
  'updateBlocklistEntry',
  'deleteBlocklistEntry',
  'bulkCreateBlocklist',
  'pauseConversation',
  'resumeConversation',
  'setConversationTags',
  'updateSettings',
];

for (const method of serviceMethods) {
  assert(service.includes(`${method}:`), `autoResponderService must expose ${method}`);
}

const pageFlows = [
  'const saveRule = async ()',
  'autoResponderService.createRule(payload)',
  'autoResponderService.updateRule(editingRule.id, payload)',
  'const deleteRule = async (rule: AutoResponderRule)',
  'autoResponderService.deleteRule(rule.id)',
  'const saveTag = async ()',
  'autoResponderService.createTag(payload)',
  'autoResponderService.updateTag(editingTag.id, payload)',
  'const deleteTag = async (tag: AutoResponderTag)',
  'autoResponderService.deleteTag(tag.id)',
  'const saveBlocklistEntry = async ()',
  'autoResponderService.createBlocklistEntry(payload)',
  'autoResponderService.updateBlocklistEntry(editingBlocklistEntry.id, payload)',
  'const deleteBlocklistEntry = async (entry: AutoResponderBlocklistEntry)',
  'autoResponderService.deleteBlocklistEntry(entry.id)',
  'const saveBulkBlocklist = async ()',
  'autoResponderService.bulkCreateBlocklist(items)',
  'const pauseConversation = async (sender: string, minutes: number)',
  'autoResponderService.pauseConversation(sender, minutes, \'admin\')',
  'const resumeConversation = async (sender: string)',
  'autoResponderService.resumeConversation(sender)',
  'const saveConversationTags = async (sender: string)',
  'autoResponderService.setConversationTags(sender, conversationTagDrafts[sender] || [])',
  'const saveSettings = async ()',
  'autoResponderService.updateSettings(settingsFormToInput(settingsForm, settingsKeywordRows))',
];

for (const token of pageFlows) {
  assert(page.includes(token), `AutoResponderPage CRUD flow must include ${token}`);
}

const checklistItems = [
  '- [x] Criar, editar e excluir respostas com recarregamento da lista',
  '- [x] Ações por conversa: pausar (1h/4h/24h/indefinido), liberar, atribuir tag, bloquear',
  '- [x] CRUD com seletor de cores + multi-select de escopos',
  '- [x] CRUD completo em cada aba',
];

for (const item of checklistItems) {
  assert(doc.includes(item), `Bot_Whatsapp.md must mark checklist item: ${item}`);
}

assert(
  doc.includes('- [x] Curadoria → criar resposta funciona end-to-end'),
  'Curadoria end-to-end must be marked complete after real UI/API validation runs'
);

console.log('autoresponder phase 3 CRUD complete static checks passed');
