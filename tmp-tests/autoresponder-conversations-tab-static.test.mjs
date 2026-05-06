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
  'conversations',
  'conversationStatusFilter',
  'conversationTagFilter',
  'conversationSearch',
  'conversationTagDrafts',
  'filteredConversations',
].forEach((stateName) => {
  assert(page.includes(stateName), `AutoResponderPage must manage ${stateName}`);
});

[
  'autoResponderService.listConversations',
  'autoResponderService.pauseConversation',
  'autoResponderService.resumeConversation',
  'autoResponderService.setConversationTags',
  'autoResponderService.createBlocklistEntry',
].forEach((callName) => {
  assert(page.includes(callName), `Conversations tab must call ${callName}`);
});

[
  'Pausar 1h',
  'Pausar 4h',
  'Pausar 24h',
  'Liberar',
  'Salvar tags',
  'Bloquear',
  'Última mensagem',
].forEach((label) => {
  assert(page.includes(label), `Conversations tab must render label: ${label}`);
});

assert(page.includes('conversationTags'), 'Conversations tab must filter tags by conversation scope');
assert(page.includes('isConversationPaused'), 'Conversations tab must detect paused conversations');
assert(page.includes('parseTagIds(conversation.tag_ids)'), 'Conversations tab must parse conversation tags');

assert(doc.includes('- [x] Lista com cards (sender, última msg, status, tags)'), 'Bot_Whatsapp.md must mark conversation cards checklist item');
assert(doc.includes('- [x] Filtro por tag e status (ativo/pausado)'), 'Bot_Whatsapp.md must mark conversation filters checklist item');
assert(doc.includes('- [x] Ações por conversa: pausar (1h/4h/24h/indefinido), liberar, atribuir tag, bloquear'), 'Bot_Whatsapp.md must mark conversation actions checklist item');

console.log('autoresponder conversations tab static checks passed');
