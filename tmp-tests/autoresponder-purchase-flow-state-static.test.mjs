import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverCjsPath = path.join(root, 'vps_server.cjs');
const serverJsPath = path.join(root, 'vps_server.js');
const typePath = path.join(root, 'types', 'autoResponder.ts');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const filePath of [serverCjsPath, serverJsPath]) {
  const source = fs.readFileSync(filePath, 'utf8');
  const label = path.basename(filePath);

  [
    'purchase_flow JSON NULL',
    'purchase_flow_updated_at TIMESTAMP NULL',
    "await addColumnIfMissing('autoresponder_conversations', 'purchase_flow', 'JSON NULL')",
    "await addColumnIfMissing('autoresponder_conversations', 'purchase_flow_updated_at', 'TIMESTAMP NULL')",
    'function normalizeAutoresponderPurchaseFlow',
    'async function getAutoresponderPurchaseFlow',
    'async function saveAutoresponderPurchaseFlow',
    'async function clearAutoresponderPurchaseFlow',
    'purchase_flow_updated_at = CURRENT_TIMESTAMP',
  ].forEach((token) => {
    assert(source.includes(token), `${label} must include ${token}`);
  });
}

const types = fs.readFileSync(typePath, 'utf8');
assert(types.includes('purchase_flow?: unknown;'), 'AutoResponderConversation must expose purchase_flow');
assert(types.includes('purchase_flow_updated_at?: string | null;'), 'AutoResponderConversation must expose purchase_flow_updated_at');

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Criar estado `purchase_flow` em `autoresponder_conversations` ou tabela propria para carrinho temporario'),
  'Bot_Whatsapp.md must mark purchase_flow state checklist item'
);

console.log('autoresponder purchase flow state static checks passed');
