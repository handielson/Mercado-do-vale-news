import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const servicePath = path.join(root, 'services', 'autoResponderService.ts');
const typesPath = path.join(root, 'types', 'autoResponder.ts');
const serverPath = path.join(root, 'vps_server.cjs');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');
const server = fs.readFileSync(serverPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'AutoResponderBlocklistUpdate',
  'updateBlocklistEntry',
  "vpsClient.patch<AutoResponderBlocklistEntry | null>(`/autoresponder/blocklist/${id}`, updates)",
].forEach((token) => {
  assert(service.includes(token), `autoResponderService must include ${token}`);
});

assert(types.includes('export type AutoResponderBlocklistUpdate'), 'types must expose AutoResponderBlocklistUpdate');
assert(server.includes("fastify.patch('/autoresponder/blocklist/:id'"), 'VPS server must expose PATCH /autoresponder/blocklist/:id');
assert(server.includes('UPDATE autoresponder_blocklist'), 'VPS blocklist PATCH must update the database row');

[
  'const [editingBlocklistEntry, setEditingBlocklistEntry]',
  'function blockEntryToForm',
  'const openEditBlockModal = (entry: AutoResponderBlocklistEntry)',
  'setEditingBlocklistEntry(entry)',
  'autoResponderService.updateBlocklistEntry(editingBlocklistEntry.id, payload)',
  'autoResponderService.createBlocklistEntry(payload)',
  'editingBlocklistEntry ?',
  'Editar bloqueio',
  'onClick={() => openEditBlockModal(entry)}',
].forEach((token) => {
  assert(page.includes(token), `Blocklist edit UI must include ${token}`);
});

assert(
  doc.includes('- [x] Editar bloqueio existente pelo modal'),
  'Bot_Whatsapp.md must mark blocklist edit complete'
);
assert(
  doc.includes('- [x] `PATCH /autoresponder/blocklist/:id`'),
  'Bot_Whatsapp.md must document the blocklist update endpoint'
);

console.log('autoresponder blocklist edit static checks passed');
