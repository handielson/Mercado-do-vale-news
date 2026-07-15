import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /latest\.source_node <> 'whatsapp-manual-handoff'/, `${file} must not schedule idle follow-up from a manual reply`);
  const handoffGuards = source.match(/human_handoff_until IS NULL OR (?:controls\.)?human_handoff_until <= CURRENT_TIMESTAMP/g) || [];
  assert.ok(handoffGuards.length >= 4, `${file} must guard idle selection and atomic claims while human handoff is active`);
}

const patchScript = fs.readFileSync('tmp-tests/n8n-fix-handoff-name-idle-repetition.cjs', 'utf8');
assert.match(patchScript, /invalidOptionalNameRepliesV135/, 'workflow patch must reject operational words as customer names');
assert.match(patchScript, /'aguardando'/, 'workflow patch must explicitly reject Aguardando as a name');
assert.match(patchScript, /Date\.now\(\) \+ 10 \* 60 \* 1000/, 'optional-name invitation must expire after ten minutes');
assert.match(patchScript, /botRequestsHumanV135/, 'name invitation must be suppressed when the bot calls a human');
assert.match(patchScript, /Handoff - Persistir solicitado/, 'bot handoff request must persist a pause before future inbound messages');
assert.match(patchScript, /deterministicServiceDecisionV135/, 'delivery scheduling and payment simulation must override the repeated legacy policy route');

console.log('n8n handoff/name/idle repetition static regression tests passed');
