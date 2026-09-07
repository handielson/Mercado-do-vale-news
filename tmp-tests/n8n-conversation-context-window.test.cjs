const assert = require('node:assert/strict');
const {
  buildMemorySessionKey,
  selectConversationContext,
} = require('../services/n8nBotConversationContext.cjs');

const now = Date.UTC(2026, 7, 31, 18, 41, 0);
const row = (minutesAgo, text) => ({ created_at: new Date(now - minutesAgo * 60_000), message_text: text });

const persistent = selectConversationContext([
  row(240, 'foto do item 27'),
  row(239, 'imagem enviada'),
]);
assert.equal(persistent.isIdle, false);
assert.deepEqual(persistent.rows.map((item) => item.message_text), ['foto do item 27', 'imagem enviada']);

const recent = selectConversationContext([
  row(1, 'sim'),
  row(2, 'quer que eu envie a foto?'),
  row(241, 'foto antiga'),
]);
assert.equal(recent.isIdle, false);
assert.deepEqual(recent.rows.map((item) => item.message_text), ['sim', 'quer que eu envie a foto?', 'foto antiga']);

const firstKey = buildMemorySessionKey('fixture@s.whatsapp.net', 0);
assert.equal(firstKey, 'fixture@s.whatsapp.net');
assert.equal(buildMemorySessionKey('fixture@s.whatsapp.net', 3), 'fixture@s.whatsapp.net:r3');

console.log('ok - n8n conversation context is persistent until an explicit reset');
