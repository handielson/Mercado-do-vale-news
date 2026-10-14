const test = require('node:test');
const assert = require('node:assert/strict');
const { sendWahaStatusMedia } = require('../services/whatsappStatusSender.cjs');
const { shouldRetrySocialStoryFailure } = require('../services/marketingCampaignApi.cjs');
test('deploy includes and checks the shared sender before switching runtime', () => {
  const source = require('node:fs').readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.ok(source.includes("'services/whatsappStatusSender.cjs'"));
  assert.ok(source.includes('node --check ${appDir}/services/whatsappStatusSender.cjs'));
  assert.ok(source.indexOf("'services/whatsappStatusSender.cjs'") < source.lastIndexOf("await upload(localServer, `${appDir}/server.js`)"));
});
const input = { baseUrl: 'http://localhost', apiKey: 'private-key', session: 'session', type: 'image', mediaUrl: 'https://example.com/image.jpg', caption: 'test', timeoutMs: 10000 };
test('session recovery defaults read-only, validates exact target and never sends Status', () => {
  const { recoveryScript } = require('../scripts/recover-whatsapp-status-session.cjs');
  assert.throws(() => recoveryScript(['--restart']), /Explicit/);
  assert.throws(() => recoveryScript(['--send']), /Unknown/);
  const script = recoveryScript([]);
  assert.match(script, /restart=false/);
  assert.match(script, /if\(!restart\)return/);
  assert.match(script, /session!==expected/);
  assert.doesNotMatch(script, /status\/image|status\/video|DELETE|logout/);
  new Function(script);
});
function provider(post, calls = []) {
  return async (url, options) => {
    calls.push(options.method);
    if (url.includes('/sessions/')) return { ok: true, json: async () => ({ status: 'WORKING', me: {} }) };
    if (options.method === 'GET') return { ok: true, json: async () => [] };
    return post(options);
  };
}
test('hung status read prevents any POST and is safely retryable', async () => {
  const methods = [];
  await assert.rejects(sendWahaStatusMedia({ ...input, fetchImpl: async (url, options) => {
    methods.push(options.method);
    if (url.includes('/sessions/')) return { ok: true, json: async () => ({ status: 'WORKING', me: {} }) };
    throw new Error('private-key');
  } }), e => e.code === 'WAHA_STATUS_PREFLIGHT_UNAVAILABLE');
  assert.deepEqual(methods, ['GET', 'GET']);
});
test('successful image or video returns a confirmed normalized provider id', async () => {
  for (const idBody of [{ id: 'status-id' }, { id: { _serialized: 'status-id' } }, { key: { id: 'status-id' } }]) {
    const result = await sendWahaStatusMedia({ ...input, type: 'video', fetchImpl: provider(async options => {
      assert.equal(JSON.parse(options.body).convert, true);
      return { ok: true, status: 201, text: async () => JSON.stringify(idBody) };
    }) });
    assert.equal(result.id, 'status-id');
  }
});
test('POST timeout, unreadable body, server error, or missing id remains uncertain and never retries', async () => {
  for (const post of [
    async () => { throw Object.assign(new Error('private-key'), { name: 'TimeoutError' }); },
    async () => ({ ok: true, status: 201, text: async () => { throw Error('body timeout'); } }),
    async () => ({ ok: false, status: 504, text: async () => '{}' }),
    async () => ({ ok: true, status: 201, text: async () => '{}' }),
  ]) {
    const calls = [];
    await assert.rejects(sendWahaStatusMedia({ ...input, fetchImpl: provider(post, calls) }), e => {
      assert.equal(shouldRetrySocialStoryFailure(e, { attempt_count: 0 }), false);
      assert.ok(!e.message.includes('private-key'));
      return e.code === 'WAHA_STATUS_OUTCOME_UNCERTAIN';
    });
    assert.equal(calls.filter(x => x === 'POST').length, 1);
  }
});
test('preflight retries stop after three attempts and media retry still works', () => {
  const error = { code: 'WAHA_STATUS_PREFLIGHT_UNAVAILABLE' };
  assert.equal(shouldRetrySocialStoryFailure(error, { attempt_count: 0 }), true);
  assert.equal(shouldRetrySocialStoryFailure(error, { attempt_count: 1 }), true);
  assert.equal(shouldRetrySocialStoryFailure(error, { attempt_count: 2 }), false);
  assert.equal(shouldRetrySocialStoryFailure({ code: 'SOCIAL_STORY_MEDIA_UNAVAILABLE' }, { attempt_count: 0 }), true);
});
