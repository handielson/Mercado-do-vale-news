const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createWhatsAppStatusHealth, registerWhatsAppStatusHealthRoute } = require('../services/whatsappStatusHealth.cjs');
const moduleStub = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('services/systemStatusModel.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(moduleStub.exports);
const { interpretSystemStatus: state, initialSystemStatusChecks, failedSystemStatusCheck } = moduleStub.exports;
const now = new Date('2026-10-07T13:00:00Z');
const env = { WAHA_STATUS_SESSION: 'private/session', WAHA_STATUS_API_KEY: 'private-key', WAHA_STATUS_SERVER_URL: 'http://localhost:18082/' };

test('health probes only GET and returns no account or credential data', async () => {
  const read = createWhatsAppStatusHealth({ env, now: () => now.getTime(), fetchImpl: async (url, options) => {
    assert.equal(url, 'http://localhost:18082/api/sessions/private%2Fsession');
    assert.equal(options.method, 'GET'); assert.equal(options.headers['X-Api-Key'], env.WAHA_STATUS_API_KEY);
    return { ok: true, json: async () => ({ status: 'WORKING', me: { id: 'secret-phone', name: 'private-name' }, config: { apiKey: 'private-key' } }) };
  } });
  assert.deepEqual(await read(), { configured: true, connected: true, state: 'WORKING', checkedAt: now.toISOString() });
});
test('unconfigured WAHA never calls network', async () => {
  const read = createWhatsAppStatusHealth({ env: {}, fetchImpl: () => { throw Error('Must not call'); } });
  assert.equal((await read()).configured, false);
});
test('WORKING without account is not ready', async () => {
  const read = createWhatsAppStatusHealth({ env, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'WORKING' }) }) });
  assert.equal((await read()).connected, false);
});
test('QR, stopped and unrecognized provider states cannot be healthy', async () => {
  for (const providerState of ['SCAN_QR_CODE', 'STOPPED', 'private-session-data']) {
    const read = createWhatsAppStatusHealth({ env, now: () => now.getTime(), fetchImpl: async () => ({ ok: true, json: async () => ({ status: providerState, me: {} }) }) });
    const data = await read(); assert.equal(data.connected, false); assert.notEqual(state('waha', data, now).state, 'healthy');
    assert.ok(!JSON.stringify(data).includes('private-session-data'));
  }
});
test('WAHA errors omit raw provider messages and credentials', async () => {
  const read = createWhatsAppStatusHealth({ env, fetchImpl: async () => { throw Error('private-key private-phone'); } });
  assert.equal((await read()).state, 'UNAVAILABLE'); assert.ok(!JSON.stringify(await read()).includes('private-key'));
});
test('health uses cache and single-flight with expiration', async () => {
  let time = now.getTime(); let calls = 0;
  const read = createWhatsAppStatusHealth({ env, now: () => time, fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ status: 'WORKING', me: {} }) }; } });
  await Promise.all([read(), read(), read()]); await read(); assert.equal(calls, 1);
  time += 30001; await read(); assert.equal(calls, 2);
});
test('WAHA route requires admin auth and no-store', async () => {
  const admin = () => {}; let route;
  registerWhatsAppStatusHealthRoute({ get: (path, options, handler) => { route = { path, options, handler }; } }, admin, { env: {} });
  assert.equal(route.path, '/admin/whatsapp-status-health'); assert.equal(route.options.preHandler, admin);
  await route.handler({}, { header: (key, value) => { assert.equal(key, 'Cache-Control'); assert.equal(value, 'no-store'); } });
});
test('failed source replaces previous healthy state and drops stale heartbeat', () => {
  const check = { ...initialSystemStatusChecks()[0], state: 'healthy', sourceAt: now.toISOString() };
  const failed = failedSystemStatusCheck(check, now.toISOString()); assert.equal(failed.state, 'unknown'); assert.equal(failed.sourceAt, null);
});
test('empty and malformed responses never indicate healthy or configured', () => {
  for (const c of initialSystemStatusChecks().filter(c => c.source)) {
    assert.equal(state(c.id, null, now).state, 'unknown');
    assert.equal(state(c.id, {}, now).state, 'unknown', c.id);
  }
});
test('cached heartbeat cannot turn bot or WAHA green', () => {
  const checkedAt = '2026-10-06T13:00:00Z';
  assert.equal(state('bot', { status: 'online', checkedAt }, now).state, 'unknown');
  assert.equal(state('waha', { configured: true, connected: true, state: 'WORKING', checkedAt }, now).state, 'unknown');
});
test('WhatsApp bot pause and broken webhook are distinct from disconnection', () => {
  assert.equal(state('attendance', { evolution: { state: 'open' }, control: { paused: true }, webhook: { valid: true } }, now).label, 'Bot pausado');
  assert.equal(state('attendance', { evolution: { state: 'open' }, control: {}, webhook: { valid: false } }, now).state, 'warning');
  assert.equal(state('attendance', { evolution: { state: 'close' } }, now).state, 'error');
});
test('stored authorization and payment configuration never claim live health', () => {
  assert.equal(state('ml', { configured: true, connected: true }, now).state, 'configured');
  assert.equal(state('payments', [{ is_active: true, access_token: 'secret' }], now).state, 'configured');
  assert.ok(!JSON.stringify(state('payments', [{ is_active: true, access_token: 'secret' }], now)).includes('secret'));
});
test('Instagram missing publishing permission and expired tokens need attention', () => {
  assert.equal(state('instagram', { connection: { configured: true, status: 'connected', selectedInstagramAccountId: '1', missingPublishingScopes: ['instagram_content_publish'] } }, now).state, 'warning');
  assert.equal(state('ml', { configured: true, connected: true, tokenExpiresAt: '2026-10-06T13:00:00Z' }, now).label, 'Token expirado');
  assert.equal(state('tiktok', { configured: true, connected: true, access_token_expires_at: String(now.getTime() / 1000 - 3600) }, now).label, 'Token expirado');
});
test('story failures are restricted to today in Brasilia and detect overdue pending', () => {
  const data = { items: [{ items: [
    { scheduled_at: '2026-10-07T01:00:00Z', deliveries: [{ status: 'failed' }] }, // Yesterday in Brasilia.
    { scheduled_at: '2026-10-07T11:00:00Z', deliveries: [{ status: 'published' }] },
    { scheduled_at: '2026-10-08T11:00:00Z', deliveries: [{ status: 'failed' }] },
  ] }] };
  assert.equal(state('stories', data, now).state, 'healthy');
  data.items[0].items.push({ scheduled_at: '2026-10-07T12:00:00Z', deliveries: [{ status: 'pending' }] });
  assert.equal(state('stories', data, now).label, 'Envios atrasados');
});
test('old backup, disabled schedule and disk thresholds produce attention', () => {
  assert.equal(state('backup', { config: { enabled: true }, status: { state: 'success', finishedAt: '2026-10-04T13:00:00Z' } }, now).state, 'warning');
  assert.equal(state('backup', { config: { enabled: false }, status: { state: 'success', finishedAt: now.toISOString() } }, now).state, 'warning');
  assert.equal(state('disk', { disk: { total_gb: 100, free_gb: 4 } }, now).state, 'error');
  assert.equal(state('disk', { disk: { total_gb: 100, free_gb: 14 } }, now).state, 'warning');
});
test('every detail link targets an existing admin route, including legacy VPS', () => {
  const routes = fs.readFileSync('routes/index.tsx', 'utf8');
  for (const check of initialSystemStatusChecks()) assert.ok(routes.includes(`path: "${check.href.split('?')[0]}"`), check.href);
  assert.ok(routes.includes('path: "/admin/settings/system-status"'));
  for (const entry of ['server.js', 'vps_server.js', 'vps_server.cjs']) assert.ok(fs.readFileSync(entry, 'utf8').includes('registerWhatsAppStatusHealthRoute(fastify, requireAdminBearerToken)'));
});
