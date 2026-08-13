import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../scripts/configure-evolution-call-response.cjs', import.meta.url), 'utf8');

assert.match(source, /rejectCall: true/, 'incoming calls must be rejected by Evolution');
assert.match(source, /msgCall: CALL_RESPONSE_MESSAGE/, 'the approved guidance must be configured as the call reply');
assert.match(source, /Não atendemos ligações: o WhatsApp funciona no computador/, 'the reply must explain why calls cannot be answered');
assert.match(source, /mensagem ou áudio/, 'the reply must offer text and audio alternatives');
assert.doesNotMatch(source, /WhatsApp não aceita ligações/, 'the bot must not make a false claim about WhatsApp');
assert.match(source, /if \(APPLY\)/, 'the production mutation must require explicit --apply');
assert.match(source, /matchesExpectedMessage/, 'the script must verify the persisted setting');
assert.match(source, /function writableSettings/, 'the update must preserve only fields accepted by the Evolution settings schema');

console.log('evolution-call-response-static.test.mjs: ok');
