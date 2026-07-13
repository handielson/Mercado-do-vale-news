import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPatch = readFileSync('tmp-tests/n8n-fix-persistent-handoff-context.cjs', 'utf8');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /client-control\/handoff/, `${file} must expose persistent human handoff endpoint`);
  assert.match(source, /human_handoff_until = GREATEST/, `${file} must extend handoff atomically`);
  assert.match(source, /human_handoff_active/, `${file} must calculate active persistent handoff`);
  assert.match(source, /conversationHistory/, `${file} must return recent conversation context`);
  assert.match(source, /Atendente humano/, `${file} must identify manual messages in context`);
  assert.match(source, /wa_message_id = \? LIMIT 1/, `${file} must deduplicate manual webhook messages`);
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'human_handoff_until'/, `${file} must migrate handoff storage`);
}

assert.match(workflowPatch, /Handoff - Persistir manual/, 'workflow must persist manual replies through the API');
assert.match(workflowPatch, /conversationHistory/, 'workflow must propagate complete recent history');
assert.match(workflowPatch, /Historico recente da conversa/, 'AI prompts must receive recent history');
assert.match(workflowPatch, /alreadyInvitedInHistory/, 'name invitation must not repeat in an existing conversation');
assert.match(workflowPatch, /oldStaticPauseRemoved/, 'workflow validation must confirm the static pause path was removed');
assert.doesNotMatch(workflowPatch, /humanHandoffs\s*=\s*staticData/, 'workflow must not keep handoff state in static data');

console.log('n8n persistent handoff and complete context static checks passed');
