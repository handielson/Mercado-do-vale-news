const assert = require('node:assert/strict');
const {
  createEmptyConversationState,
  normalizeConversationState,
  isConversationStateExpired,
} = require('../services/autoresponder/engine/state.js');

const empty = createEmptyConversationState();
assert.equal(empty.flow, 'none');
assert.equal(empty.step, 'idle');
assert.deepEqual(empty.data, {});

const normalized = normalizeConversationState({
  flow: 'delivery',
  step: 'awaiting_cep',
  data: { asked: true },
  last_intent: 'delivery_question',
});
assert.equal(normalized.flow, 'delivery');
assert.equal(normalized.step, 'awaiting_cep');
assert.equal(normalized.data.asked, true);
assert.equal(normalized.last_intent, 'delivery_question');

const invalid = normalizeConversationState({ flow: 'weird', step: '' });
assert.equal(invalid.flow, 'none');
assert.equal(invalid.step, 'idle');

assert.equal(isConversationStateExpired({ expires_at: '2000-01-01T00:00:00.000Z' }), true);
assert.equal(isConversationStateExpired({ expires_at: '2999-01-01T00:00:00.000Z' }), false);
assert.equal(isConversationStateExpired({ expires_at: null }), false);

console.log('autoresponder state normalizer tests passed');
