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
  'activeAutoResponderTab',
  'setActiveAutoResponderTab',
  'conversationPollingInterval',
  'window.setInterval',
  'window.clearInterval',
  "activeAutoResponderTab !== 'conversas'",
  'void reloadConversations()',
  'onChange={setActiveAutoResponderTab}',
].forEach((token) => {
  assert(page.includes(token), `Conversation polling must include ${token}`);
});

assert(page.includes('5000'), 'Conversation polling interval must be 5000ms');
assert(
  doc.includes('- [x] Polling a cada 5s'),
  'Bot_Whatsapp.md must mark conversation polling'
);
assert(
  doc.includes('- [x] Polling em tempo real na aba Conversas'),
  'Bot_Whatsapp.md must mark phase 3 polling test item'
);

console.log('autoresponder conversation polling static checks passed');
