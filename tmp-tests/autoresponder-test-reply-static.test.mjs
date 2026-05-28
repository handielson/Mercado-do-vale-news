import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');
const deployServer = readFileSync('vps_server.js', 'utf8');
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const types = readFileSync('types/autoResponder.ts', 'utf8');

assert.ok(server.includes("fastify.post('/autoresponder/test-reply'"), 'VPS server must expose a test reply endpoint');
assert.ok(server.includes('buildAutoresponderTestReply'), 'VPS server must build test replies without calling the real webhook');
assert.ok(deployServer.includes("fastify.post('/autoresponder/test-reply'"), 'deploy server must expose a test reply endpoint');
assert.ok(deployServer.includes('buildAutoresponderTestReply'), 'deploy server must build test replies without calling the real webhook');
assert.doesNotMatch(
  server.slice(server.indexOf("fastify.post('/autoresponder/test-reply'"), server.indexOf("fastify.patch('/products/:id/tags'")),
  /logAutoresponderReply|upsertAutoresponder|hits = hits \+ 1|saveAutoresponderPurchaseFlow|clearAutoresponderPurchaseFlow/,
  'test reply route must not mutate conversations, logs, hits, or purchase flow',
);

assert.ok(service.includes("'/autoresponder/test-reply'"), 'frontend service must call the VPS test endpoint');
assert.ok(types.includes('AutoResponderTestReplyResult'), 'types must expose test reply result');

[
  "id: 'testes'",
  'Testar respostas do bot',
  'testBotReply',
  'editableTestReplies',
  'saveTestReply',
  'Salvar resposta',
  'autoResponderService.createRule',
  'autoResponderService.updateRule',
].forEach((token) => {
  assert.ok(page.includes(token), `AutoResponderPage must include ${token}`);
});

console.log('autoresponder test reply static checks passed');
