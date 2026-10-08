const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createBlingConnectionHealth } = require('../services/blingConnectionHealth.cjs');
test('selective deployment preserves remote changes and is idempotent', () => {
  const { patchEntry } = require('../scripts/deploy-bling-connection-health.cjs');
  const baseline = require('node:child_process').execFileSync('git', ['show', 'ac812a85:vps_server.cjs'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const input = baseline + '\n// unrelated remote code\n';
  const updated = patchEntry(input);
  assert.ok(updated.endsWith('// unrelated remote code\n'));
  assert.equal(patchEntry(updated), updated);
  assert.throws(() => patchEntry('unexpected runtime'));
});

test('confirms only a valid provider read and returns no secrets or records', async () => {
  const read = createBlingConnectionHealth({ getAuthHeader: async () => 'secret-token', fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.match(url, /categorias\/produtos/);
    return { ok: true, json: async () => ({ data: [{ id: 'private-record' }] }) };
  } });
  const result = await read();
  assert.equal(result.state, 'connected');
  assert.deepEqual(Object.keys(result).sort(), ['checkedAt', 'state']);
});

test('separates missing authorization, refusal, permission and temporary failures', async () => {
  const empty = createBlingConnectionHealth({ getAuthHeader: async () => '', fetchImpl: () => assert.fail('No network without token') });
  assert.equal((await empty()).state, 'disconnected');
  for (const [status, expected] of [[401, 'disconnected'], [403, 'forbidden'], [429, 'unavailable'], [500, 'unavailable']]) {
    const read = createBlingConnectionHealth({ getAuthHeader: async () => 'secret', fetchImpl: async () => ({ status, ok: false }) });
    assert.equal((await read()).state, expected);
  }
  const malformed = createBlingConnectionHealth({ getAuthHeader: async () => 'secret', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal((await malformed()).state, 'unavailable');
  const offline = createBlingConnectionHealth({ getAuthHeader: async () => { throw Error('secret'); } });
  assert.equal((await offline()).state, 'unavailable');
});

test('concurrent probes share a request and cache expires', async () => {
  let time = 0, calls = 0;
  const read = createBlingConnectionHealth({ now: () => time, getAuthHeader: async () => 'secret', fetchImpl: async () => {
    calls++; return { ok: true, json: async () => ({ data: [] }) };
  } });
  await Promise.all([read(), read()]); await read(); assert.equal(calls, 1);
  time = 30001; await read(); assert.equal(calls, 2);
});

test('all API entries protect health; successful OAuth clears only its debug', () => {
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    assert.match(fs.readFileSync(file, 'utf8'), /connection-status', { preHandler: requireAdminBearerToken }/);
  }
  const page = fs.readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');
  assert.match(page, /params.get\('connected'\) === 'true'\) {\s+clearConnectDebug\(\)/);
  assert.match(page, /sessionStorage.removeItem\(BLING_CONNECT_DEBUG_KEY\)/);
  assert.match(page, /health.state === 'connected'\) {[\s\S]*?clearConnectDebug\(\)/);
});

test('new credentials invalidate a cached refusal after reconnecting', async () => {
  let token = 'old';
  const read = createBlingConnectionHealth({ getAuthHeader: async () => token, fetchImpl: async (_url, options) =>
    options.headers.Authorization === 'old' ? { status: 401, ok: false } : { ok: true, json: async () => ({ data: [] }) }
  });
  assert.equal((await read()).state, 'disconnected');
  token = 'new';
  assert.equal((await read()).state, 'connected');
});
