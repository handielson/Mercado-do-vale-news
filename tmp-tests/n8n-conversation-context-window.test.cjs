const assert = require('node:assert/strict');
const {
  DEFAULT_CONTEXT_IDLE_MS,
  buildMemorySessionKey,
  selectConversationContext,
} = require('../services/n8nBotConversationContext.cjs');

const now = Date.UTC(2026, 7, 31, 18, 41, 0);
const row = (minutesAgo, text) => ({ created_at: new Date(now - minutesAgo * 60_000), message_text: text });

const stale = selectConversationContext([
  row(240, 'foto do item 27'),
  row(239, 'imagem enviada'),
], { nowMs: now, contextStartedAt: row(240).created_at });
assert.equal(stale.isIdle, true);
assert.deepEqual(stale.rows, []);

const active = selectConversationContext([
  row(1, 'sim'),
  row(2, 'quer que eu envie a foto?'),
  row(241, 'foto antiga'),
], { nowMs: now, contextStartedAt: row(2).created_at });
assert.equal(active.isIdle, false);
assert.deepEqual(active.rows.map((item) => item.message_text), ['sim', 'quer que eu envie a foto?']);

const firstKey = buildMemorySessionKey('fixture@s.whatsapp.net', 0, new Date(now));
const followupKey = buildMemorySessionKey('fixture@s.whatsapp.net', 0, new Date(now - 60_000));
assert.equal(firstKey, followupKey, 'first message and immediate follow-up must share the hourly context key');
assert.match(firstKey, /:c2026083118$/);
assert.match(buildMemorySessionKey('fixture@s.whatsapp.net', 3, new Date(now)), /:r3:c2026083118$/);
assert.equal(DEFAULT_CONTEXT_IDLE_MS, 2 * 60 * 60 * 1000);

console.log('ok - n8n conversation context expires after two idle hours and rotates memory key');
