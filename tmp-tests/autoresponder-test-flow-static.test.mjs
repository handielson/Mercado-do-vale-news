import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const types = readFileSync('types/autoResponder.ts', 'utf8');

for (const fileName of serverFiles) {
  const source = readFileSync(fileName, 'utf8');

  assert.ok(source.includes("fastify.post('/autoresponder/test-flow'"), `${fileName} must expose a full flow test endpoint`);
  assert.ok(source.includes('runAutoresponderTestFlow'), `${fileName} must run a multi-message test flow`);
  assert.ok(source.includes("fastify.inject({"), `${fileName} must exercise the real webhook route internally`);
  assert.ok(source.includes("url: '/autoresponder-webhook'"), `${fileName} must route each test step through the webhook`);
  assert.ok(source.includes('cleanupAutoresponderTestFlowSender'), `${fileName} must clean up the temporary test sender`);
  assert.ok(source.includes('DELETE FROM autoresponder_logs WHERE sender = ?'), `${fileName} must remove temporary test logs`);
  assert.ok(source.includes('DELETE FROM autoresponder_conversations WHERE sender = ?'), `${fileName} must remove temporary test conversation state`);
}

assert.ok(service.includes("'/autoresponder/test-flow'"), 'frontend service must call the full flow test endpoint');
assert.ok(types.includes('AutoResponderTestFlowResult'), 'types must expose full flow result');
assert.ok(types.includes('AutoResponderTestFlowStep'), 'types must expose full flow steps');

[
  'testFlowMessages',
  'testBotFlow',
  'Roteiro completo',
  'Testar fluxo completo',
  'Fluxo completo',
  'setTestFlowMessages',
].forEach((token) => {
  assert.ok(page.includes(token), `AutoResponderPage must include ${token}`);
});

console.log('autoresponder full flow test static checks passed');
