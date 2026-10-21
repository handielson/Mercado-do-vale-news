import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /N8N_BOT_CONVERSATION_STATE_KEYS[\s\S]*'salesPostList'[\s\S]*'pendingDeviceClarification'[\s\S]*'optionalCustomerName'/, `${file} must allow only the conversation state owned by the sales flow`);
  assert.match(source, /N8N_BOT_CONVERSATION_STATE_MAX_BYTES = 512 \* 1024/, `${file} must bound persisted state size`);
  assert.match(source, /fastify\.post\('\/n8n-bot\/client-control\/conversation-state', \{ preHandler: requireSyncKey \}/, `${file} must protect the persistence endpoint`);
  assert.match(source, /expectedRevision deve ser um inteiro maior ou igual a zero/, `${file} must require optimistic concurrency`);
  assert.match(source, /eventVersion deve ser um inteiro positivo/, `${file} must validate the inbound event ordering key`);
  assert.match(source, /SELECT conversation_state_revision, conversation_state_event_version[\s\S]*FOR UPDATE/, `${file} must lock the client row before updating state`);
  assert.match(source, /reply\.code\(409\).*conversation_state_revision_conflict/, `${file} must reject stale writes`);
  assert.match(source, /stale_or_duplicate_event/, `${file} must ignore events older than the persisted state`);
  assert.match(source, /conversation_state_revision = conversation_state_revision \+ 1/, `${file} reset must invalidate concurrent stale writes`);
  assert.match(source, /conversation_state_event_version = CAST\(UNIX_TIMESTAMP\(CURRENT_TIMESTAMP\(3\)\) \* 1000000 AS UNSIGNED\)/, `${file} reset must invalidate already-running older events`);
  assert.match(source, /conversation_state = NULL/, `${file} reset must clear the persisted conversation state`);
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'conversation_state', 'JSON NULL'\)/, `${file} must prepare the JSON column`);
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'conversation_state_revision', 'BIGINT NOT NULL DEFAULT 0'\)/, `${file} must prepare the revision column`);
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'conversation_state_event_version', 'BIGINT NOT NULL DEFAULT 0'\)/, `${file} must prepare the event-order column`);

  const start = source.indexOf('const N8N_BOT_CONVERSATION_STATE_KEYS');
  const end = source.indexOf('function mapN8nBotControlRow', start);
  assert.ok(start >= 0 && end > start, `${file} must expose an extractable state normalizer`);
  const normalizerSource = source.slice(start, end);
  const buildStateFunctions = new Function(
    'parsePublicJson',
    'Buffer',
    `${normalizerSource}\nreturn { normalizeN8nBotConversationState, decideN8nBotConversationStateWrite };`
  );
  const { normalizeN8nBotConversationState: normalize, decideN8nBotConversationStateWrite: decideWrite } = buildStateFunctions(
    (value, fallback) => {
      try { return JSON.parse(value); } catch { return fallback; }
    },
    Buffer
  );

  assert.deepEqual(
    decideWrite({ currentRevision: 4, currentEventVersion: 0, expectedRevision: 3, eventVersionProvided: false, eventVersion: 0 }),
    { action: 'conflict', currentRevision: 4 },
    `${file} must preserve revision conflicts for legacy callers`
  );
  assert.deepEqual(
    decideWrite({ currentRevision: 4, currentEventVersion: 2000, expectedRevision: 3, eventVersionProvided: true, eventVersion: 3000 }),
    { action: 'conflict', currentRevision: 4 },
    `${file} must rebase a newer event instead of overwriting state computed from a stale read`
  );
  assert.deepEqual(
    decideWrite({ currentRevision: 4, currentEventVersion: 2000, expectedRevision: 4, eventVersionProvided: true, eventVersion: 3000 }),
    { action: 'apply', nextRevision: 5, nextEventVersion: 3000 },
    `${file} must apply the newer event after rehydration of the current revision`
  );
  assert.equal(source.includes('body.allowRebase !== true'), true, `${file} must opt in to a rebase response without changing legacy conflict semantics`);
  assert.match(source, /reason: 'revision_conflict'/, `${file} must identify the rebase outcome distinctly from stale events`);
  assert.deepEqual(
    decideWrite({ currentRevision: 4, currentEventVersion: 3000, expectedRevision: 3, eventVersionProvided: true, eventVersion: 2000 }),
    { action: 'ignore', currentRevision: 4, currentEventVersion: 3000 },
    `${file} must ignore an older message that finishes later`
  );
  assert.deepEqual(
    decideWrite({ currentRevision: 4, currentEventVersion: 3000, expectedRevision: 4, eventVersionProvided: true, eventVersion: 3000 }),
    { action: 'ignore', currentRevision: 4, currentEventVersion: 3000 },
    `${file} must make duplicate event writes idempotent`
  );

  const future = Date.now() + 60_000;
  const active = normalize({
    salesPostList: { step: 'awaiting_quantity', expiresAt: future },
    pendingDeviceClarification: { brand: 'Poco', expiresAt: future },
  }, { strict: true });
  assert.equal(active.salesPostList.step, 'awaiting_quantity');
  assert.equal(active.pendingDeviceClarification.brand, 'Poco');
  const payjoy = { status: 'approved', approvedAmountCents: 160000, entryPercentBp: 2000, updatedAt: Date.now(), expiresAt: future };
  assert.deepEqual(normalize({ payjoyByJid: payjoy }, { strict: true }).payjoyByJid, payjoy,
    `${file} must round-trip canonical PayJoy continuation without modifying approval cents`);
  assert.deepEqual(normalize({ payjoyByJid: { ...payjoy, expiresAt: Date.now()-1 } }, { strict: true }), {});
  assert.throws(() => normalize({ payjoyByJid: 'invalid' }, { strict: true }), /deve ser um objeto/);

  const expired = normalize({ salesPostList: { expiresAt: Date.now() - 1 } }, { strict: true });
  assert.deepEqual(expired, {}, `${file} must discard expired entries while hydrating or saving`);
  assert.throws(
    () => normalize({ botSentMessageIds: {} }, { strict: true }),
    /campos nao permitidos/,
    `${file} must reject unrelated global workflow caches`
  );
  assert.throws(
    () => normalize({ optionalCustomerName: 'invalid' }, { strict: true }),
    /deve ser um objeto/,
    `${file} must reject malformed state entries`
  );
  assert.throws(
    () => normalize('{invalid-json', { strict: true }),
    /JSON valido/,
    `${file} must reject malformed JSON strings`
  );
  assert.throws(
    () => normalize('{invalid-json', { strict: true }),
    /JSON valido/,
    `${file} must reject malformed serialized JSON`
  );
  assert.throws(
    () => normalize({ salesPostList: { payload: 'x'.repeat(513 * 1024) } }, { strict: true }),
    /512 KB/,
    `${file} must reject oversized state`
  );
}

// Entry points can legitimately load different unrelated modules. Protect the
// actual conversation-state implementation and route in both representations.
for (const [start, end] of [
  ['const N8N_BOT_CONVERSATION_STATE_KEYS', 'function mapN8nBotControlRow'],
  ["fastify.post('/n8n-bot/client-control/conversation-state'", "fastify.post('/n8n-bot/client-control/reset'"],
]) {
  const sections = serverFiles.map(file => {
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.equal(from >= 0 && to > from, true, `${file} must contain the conversation-state contract`);
    return source.slice(from, to);
  });
  assert.equal(sections[0] === sections[1], true, 'conversation-state implementations must remain identical');
}

console.log('n8n conversation state API static checks passed');
