import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicePath = path.join(root, 'services', 'autoResponderService.ts');
const typesPath = path.join(root, 'types', 'autoResponder.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(fs.existsSync(servicePath), 'services/autoResponderService.ts must exist');
assert(fs.existsSync(typesPath), 'types/autoResponder.ts must exist');

const service = fs.readFileSync(servicePath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');

[
  'getSettings',
  'updateSettings',
  'listTags',
  'createTag',
  'updateTag',
  'deleteTag',
  'listAttendants',
  'createAttendant',
  'deleteAttendant',
  'listConversations',
  'pauseConversation',
  'resumeConversation',
  'updateConversationAttendant',
  'setConversationTags',
  'listBlocklist',
  'createBlocklistEntry',
  'updateBlocklistEntry',
  'bulkCreateBlocklist',
  'deleteBlocklistEntry',
  'listUnanswered',
  'deleteUnanswered',
  'getStats',
  'getStoreStatus',
  'sendInternalChatMessage',
  'resetInternalChat',
  'updateProductTags',
].forEach((method) => {
  assert(service.includes(`${method}:`), `autoResponderService must expose ${method}`);
});

assert(
  service.includes("import { vpsClient } from './vpsClient'"),
  'autoResponderService must use the shared vpsClient'
);
assert(!service.includes('uploadAttachment'), 'legacy attachment upload method must stay removed from the frontend service');
assert(!service.includes('/autoresponder/upload-attachment'), 'legacy attachment upload endpoint must not be exposed by the frontend service');
assert(!service.includes('listRules') && !service.includes('createRule') && !service.includes('/autoresponder/rules'), 'legacy autoresponder rule methods must stay removed');
assert(service.includes('URLSearchParams'), 'list methods with filters must build URLSearchParams');
assert(service.includes('AutoResponderBlocklistUpdate'), 'blocklist update method must use AutoResponderBlocklistUpdate');
assert(
  service.includes("vpsClient.patch<AutoResponderBlocklistEntry | null>(`/autoresponder/blocklist/${id}`, updates)"),
  'updateBlocklistEntry must PATCH /autoresponder/blocklist/:id'
);

[
  'AutoResponderSettings',
  'AutoResponderTag',
  'AutoResponderAttendant',
  'AutoResponderConversation',
  'AutoResponderBlocklistEntry',
  'AutoResponderBlocklistUpdate',
  'AutoResponderUnansweredQuestion',
  'AutoResponderStats',
  'AutoResponderStoreStatus',
  'AutoResponderInternalChatResult',
].forEach((typeName) => {
  assert(types.includes(`interface ${typeName}`) || types.includes(`type ${typeName}`), `${typeName} type must exist`);
});

console.log('autoresponder service static checks passed');
