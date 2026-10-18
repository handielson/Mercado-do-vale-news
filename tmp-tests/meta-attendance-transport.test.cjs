'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createHash, createHmac } = require('node:crypto');
const { createMetaAttendanceTransport } = require('../services/metaAttendanceTransport.cjs');
const NOW = Date.parse('2026-10-18T12:00:00Z');
const SECRET = 'synthetic-app-secret';
const KEY = 'synthetic-encryption-key';
const USER = 'synthetic-oauth-token';
const PAGE = 'synthetic-page-token';
function encrypted(token = USER) {
  const iv = Buffer.alloc(12, 7);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(KEY).digest(), iv);
  const bytes = Buffer.concat([cipher.update(token), cipher.final()]);
  return { token_ciphertext: bytes.toString('base64'), token_iv: iv.toString('base64'), token_auth_tag: cipher.getAuthTag().toString('base64') };
}
const event = (extra = {}) => ({ channel: 'messenger', accountId: 'page:001', participantId: '00012345678901234567890',
  providerEventId: 'mid:opaque/1', surface: 'dm', eventType: 'message', status: 'captured', isEcho: false,
  occurredAt: new Date(NOW - 10000).toISOString(), receivedAt: new Date(NOW - 9000).toISOString(),
  activationAt: new Date(NOW - 60000).toISOString(), ...extra });
const text = { type: 'text', text: 'Olá, posso ajudar? 🌿' };
const reply = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
function setup({ responses, row: rowOverride, ...options } = {}) {
  const calls = [];
  const row = { selected_page_id: 'page:001', selected_instagram_account_id: 'ig:001', ...encrypted(), ...rowOverride };
  const results = responses || [reply(200, { id: 'page:001', access_token: PAGE, instagram_business_account: { id: 'ig:001' } }), reply(200, { recipient_id: event().participantId, message_id: 'sent:001' })];
  const transport = createMetaAttendanceTransport({
    fetch: async (url, init) => { calls.push({ url, ...init }); const result = results.shift(); if (result instanceof Error) throw result; if (!result) throw new Error('unexpected fetch'); return result; },
    graphVersion: 'v25.0', appId: 'synthetic-app-id', appSecret: SECRET, encryptionKey: KEY,
    loadConnection: async () => row, now: () => NOW, ...options,
  });
  return { transport, calls };
}

test('decrypts OAuth privately, resolves Page token and sends opaque PSID with bearer headers', async () => {
  const { transport, calls } = setup();
  const result = await transport.send({ event: event(), message: { ...text, recipient: 'attacker', recipientId: 'attacker' } });
  assert.deepEqual(result, { ok: true, status: 'sent', providerMessageId: 'sent:001', channel: 'messenger' });
  assert.equal(calls.length, 2);
  const lookup = new URL(calls[0].url);
  assert.equal(lookup.origin, 'https://graph.facebook.com');
  assert.equal(lookup.pathname, '/v25.0/page%3A001');
  assert.equal(lookup.searchParams.get('fields'), 'access_token,instagram_business_account');
  assert.equal(lookup.searchParams.get('appsecret_proof'), createHmac('sha256', SECRET).update(USER).digest('hex'));
  assert.equal(calls[0].headers.Authorization, `Bearer ${USER}`);
  assert.equal(calls[1].headers.Authorization, `Bearer ${PAGE}`);
  assert.equal(calls[1].url, 'https://graph.facebook.com/v25.0/page%3A001/messages');
  for (const call of calls) {
    assert.equal(new URL(call.url).searchParams.has('access_token'), false);
    assert.ok(!call.url.includes(USER) && !call.url.includes(PAGE));
    assert.equal(call.redirect, 'error');
    assert.ok(call.signal instanceof AbortSignal);
  }
  const body = JSON.parse(calls[1].body);
  assert.deepEqual(body.recipient, { id: event().participantId });
  assert.deepEqual(body.message, { text: text.text });
  assert.equal(body.messaging_type, 'RESPONSE');
  assert.equal(body.appsecret_proof, createHmac('sha256', SECRET).update(PAGE).digest('hex'));
  assert.ok(!JSON.stringify(result).includes('token'));
});

test('Instagram Facebook Login uses Page endpoint, linked IG asset and image body without messaging_type', async () => {
  const { transport, calls } = setup();
  const result = await transport.send({ event: event({ channel: 'instagram', accountId: 'ig:001' }), message: { type: 'image', url: 'https://api.xiaomipetrolina.com.br/images/catalog/photo.jpg' } });
  assert.equal(result.ok, true);
  assert.equal(result.channel, 'instagram');
  const body = JSON.parse(calls[1].body);
  assert.equal(body.messaging_type, undefined);
  assert.deepEqual(body.message, { attachment: { type: 'image', payload: { url: 'https://api.xiaomipetrolina.com.br/images/catalog/photo.jpg' } } });
});

test('rejects forged events, old queue, future timestamps, wrong assets and replay without fetch', async () => {
  for (const changed of [
    { surface: 'comment' }, { eventType: 'read' }, { status: 'unsupported' }, { status: 'sent' },
    { isEcho: true }, { accountId: 'foreign' }, { channel: 'whatsapp' }, { participantId: 123 },
    { isReplay: true }, { replayed: true }, { occurredAt: undefined },
    { occurredAt: new Date(NOW - 86400000).toISOString() }, { occurredAt: new Date(NOW + 1).toISOString() },
    { receivedAt: 'invalid' }, { receivedAt: new Date(NOW - 86400000).toISOString() },
    { activationAt: new Date(NOW - 1000).toISOString() },
  ]) {
    const { transport, calls } = setup();
    const result = await transport.send({ event: event(changed), message: text });
    assert.equal(result.ok, false, JSON.stringify(changed));
    assert.equal(result.status, 'rejected');
    assert.equal(calls.length, 0, JSON.stringify(changed));
  }
});

test('safe text blocks count Unicode characters and require caller splitting', async () => {
  const accepted = setup();
  assert.equal((await accepted.transport.send({ event: event(), message: { type: 'text', text: '🌿'.repeat(900) } })).ok, true);
  for (const message of [{ type: 'text', text: 'a'.repeat(901) }, { type: 'text', text: ' ' }, { type: 'file', url: 'https://imagens.xiaomipetrolina.com.br/a' }]) {
    const { transport, calls } = setup();
    assert.equal((await transport.send({ event: event(), message })).code, 'invalid_message');
    assert.equal(calls.length, 0);
  }
});

test('image URL allowlist rejects credentials, prefix attacks, redirects-to-external syntax and non-HTTPS', async () => {
  for (const url of ['https://imagens.xiaomipetrolina.com.br/photo.jpg', 'https://api.xiaomipetrolina.com.br/images/a.jpg']) {
    assert.equal((await setup().transport.send({ event: event(), message: { type: 'image', url } })).ok, true);
  }
  for (const url of [
    'http://imagens.xiaomipetrolina.com.br/a', 'https://imagens.xiaomipetrolina.com.br.evil.test/a',
    'https://user:pass@imagens.xiaomipetrolina.com.br/a', 'https://api.xiaomipetrolina.com.br/images-evil/a',
    'https://api.xiaomipetrolina.com.br/images/../admin', 'https://api.xiaomipetrolina.com.br/other/a',
    'https://api.xiaomipetrolina.com.br:444/images/a', 'https://imagens.xiaomipetrolina.com.br/a#fragment',
    'https://api.xiaomipetrolina.com.br/images/%252e%252e%252fadmin',
    'https://api.xiaomipetrolina.com.br/images/%2e%2e%2fadmin',
  ]) {
    const { transport, calls } = setup();
    assert.equal((await transport.send({ event: event(), message: { type: 'image', url } })).code, 'invalid_message', url);
    assert.equal(calls.length, 0);
  }
});

test('invalid encryption credentials fail safely without Graph traffic', async () => {
  for (const options of [{ encryptionKey: 'wrong' }, { row: { token_auth_tag: Buffer.alloc(16).toString('base64') } }, { row: { token_iv: 'bad' } }, { loadConnection: async () => { throw new Error(USER); } }]) {
    const { transport, calls } = setup(options);
    const result = await transport.send({ event: event(), message: text });
    assert.equal(result.code, 'connection_credentials_unavailable');
    assert.equal(calls.length, 0);
    assert.ok(!JSON.stringify(result).includes(USER));
  }
});

test('Page lookup verifies selected Page and IG linkage before POST', async () => {
  for (const data of [
    { id: 'foreign-page', access_token: PAGE, instagram_business_account: { id: 'ig:001' } },
    { id: 'page:001', access_token: PAGE, instagram_business_account: { id: 'foreign-ig' } },
    { id: 'page:001', access_token: PAGE }, { id: 'page:001' }, { error: { message: USER } },
  ]) {
    const { transport, calls } = setup({ responses: [reply(200, data)] });
    const result = await transport.send({ event: event({ channel: 'instagram', accountId: 'ig:001' }), message: text });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(result).includes(USER));
  }
});

test('lookup failures never count as ambiguous send and do not retry', async () => {
  for (const response of [reply(403, { error: { message: USER } }), reply(429, {}), reply(503, {}), new Error(USER)]) {
    const { transport, calls } = setup({ responses: [response] });
    const result = await transport.send({ event: event(), message: text });
    assert.equal(result.status, 'failed');
    assert.equal(result.retryable, false);
    assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(result).includes(USER));
  }
});

test('POST 5xx/network/timeouts are ambiguous; 4xx and 429 are sanitized failures with no retry', async () => {
  for (const [response, expected] of [
    [new Error(`timeout ${PAGE}`), 'result_unknown'], [reply(500, { secret: PAGE }), 'result_unknown'],
    [reply(403, { error: { message: PAGE, code: 10 } }), 'failed'], [reply(429, { message: USER }), 'failed'],
    [reply(400, { error: { message: PAGE, code: 190 } }), 'failed'],
  ]) {
    const { transport, calls } = setup({ responses: [reply(200, { access_token: PAGE }), response] });
    const result = await transport.send({ event: event(), message: text });
    assert.equal(result.status, expected);
    assert.equal(result.retryable, false);
    assert.equal(calls.length, 2);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(USER) && !serialized.includes(PAGE) && !serialized.includes('http:'));
  }
});

test('successful HTTP without valid receipt is ambiguous', async () => {
  for (const data of [{}, { error: { message: PAGE } }, { message_id: 'id', recipient_id: 'wrong' }]) {
    const { transport } = setup({ responses: [reply(200, { access_token: PAGE }), reply(200, data)] });
    assert.equal((await transport.send({ event: event(), message: text })).status, 'result_unknown');
  }
});

test('rechecks window after Page-token resolution latency', async () => {
  let checks = 0;
  const { transport, calls } = setup({ now: () => checks++ === 0 ? NOW : NOW + 86400000 });
  assert.equal((await transport.send({ event: event(), message: text })).code, 'messaging_window_closed');
  assert.equal(calls.length, 1);
});

test('invalid configuration never emits credentials or performs I/O', async () => {
  const { transport, calls } = setup({ graphVersion: 'v25.0/../../evil' });
  assert.equal((await transport.send({ event: event(), message: text })).code, 'transport_not_configured');
  assert.equal(calls.length, 0);
});
