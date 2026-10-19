'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMetaAttendanceMedia, MAX_MEDIA_BYTES, META_MEDIA_HOSTS } = require('../services/metaAttendanceMedia.cjs');
const URL_FIXTURE = `https://${META_MEDIA_HOSTS[0]}/ig_messaging_cdn/?asset_id=synthetic&signature=private-fixture`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([8, 0, 0, 0]), Buffer.from('WEBPVP8L')]);
function fixture(extra = {}) {
  const attachment = { type: 'image', url: URL_FIXTURE, providerId: 'opaque-provider-id', ...extra };
  return { attachment, event: { channel: 'instagram', surface: 'dm', eventType: 'message', status: 'captured', isEcho: false, attachments: [attachment] } };
}
function response(bytes = PNG, { mime = 'image/png', length, status = 200, chunks, redirected = false, url } = {}) {
  let index = 0;
  const state = { cancelled: false, reads: 0 };
  const pieces = chunks || [bytes];
  const headers = new Headers({ 'content-type': mime });
  if (length !== undefined) headers.set('content-length', String(length));
  return { state, value: { ok: status >= 200 && status < 300, status, redirected, url, headers,
    body: { getReader: () => ({
      read: async () => { state.reads++; return index < pieces.length ? { done: false, value: pieces[index++] } : { done: true }; },
      cancel: async () => { state.cancelled = true; }, releaseLock() {},
    }), cancel: async () => { state.cancelled = true; } },
  } };
}

test('downloads bound normalized image, streams chunks and returns only transient native binary metadata', async () => {
  const f = fixture(), calls = [];
  const remote = response(PNG, { chunks: [PNG.subarray(0, 3), PNG.subarray(3)], length: PNG.length });
  const media = createMetaAttendanceMedia({ fetch: async (url, options) => { calls.push({ url, options }); return remote.value; } });
  const result = await media.download(f);
  assert.equal(result.ok, true);
  assert.deepEqual(Buffer.from(result.data, 'base64'), PNG);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.fileExtension, 'png');
  assert.equal(result.byteLength, PNG.length);
  assert.equal(result.fileName, 'meta-payjoy-print.png');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(JSON.stringify(result).includes('private-fixture'), false);
});

test('supports JPEG and WebP, rejects GIF/SVG/HTML and MIME-signature mismatch', async () => {
  for (const [bytes, mime, extension] of [[JPEG, 'image/jpeg', 'jpg'], [WEBP, 'image/webp', 'webp']]) {
    const media = createMetaAttendanceMedia({ fetch: async () => response(bytes, { mime }).value });
    const result = await media.download(fixture());
    assert.equal(result.ok, true); assert.equal(result.fileExtension, extension);
  }
  for (const [bytes, mime, code] of [
    [Buffer.from('GIF89a'), 'image/gif', 'media_type_not_supported'],
    [Buffer.from('<svg/>'), 'image/svg+xml', 'media_type_not_supported'],
    [Buffer.from('<html>expired</html>'), 'text/html', 'media_type_not_supported'],
    [PNG, 'image/jpeg', 'media_signature_mismatch'],
    [Buffer.from('<svg/>'), 'image/png', 'media_signature_mismatch'],
    [Buffer.from('not a JPEG'), 'image/jpeg', 'media_signature_mismatch'],
  ]) {
    const media = createMetaAttendanceMedia({ fetch: async () => response(bytes, { mime }).value });
    assert.deepEqual(await media.download(fixture()), { ok: false, code });
  }
});

test('Messenger exact attachment CDN supports the same bounded native image path',async()=>{
  const input=fixture({url:'https://scontent.xx.fbcdn.net/v/synthetic.png'});input.event.channel='messenger';
  const media=createMetaAttendanceMedia({fetch:async()=>response().value});
  assert.equal((await media.download(input)).ok,true);
  assert.equal((await media.download(fixture({url:'https://scontent.xx.fbcdn.net.evil.example/x'}))).code,'media_url_not_allowed');
});

test('exact observed CDN host allowlist rejects SSRF targets without network', async () => {
  let calls = 0;
  const media = createMetaAttendanceMedia({ fetch: async () => { calls++; return response().value; } });
  for (const url of [
    'http://lookaside.fbsbx.com/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://169.254.169.254/a',
    'https://2130706433/a', 'https://0x7f000001/a', 'https://localhost/a',
    'https://lookaside.fbsbx.com.evil.example/a', 'https://evil.lookaside.fbsbx.com/a',
    'https://lookaside.fbsbx.com@evil.example/a', 'https://user:password@lookaside.fbsbx.com/a',
    'https://lookaside.fbsbx.com:443/a', 'https://lookaside.fbsbx.com:8443/a',
    'https://lookaside.fbsbx.com./a', 'https://lookaside.fbsbx.com/a#fragment',
    'https://lookaside.fbsbx.com\\@127.0.0.1/a', 'file:///etc/passwd',
  ]) {
    assert.deepEqual(await media.download(fixture({ url })), { ok: false, code: 'media_url_not_allowed' });
  }
  assert.equal(calls, 0);
});

test('attachment must belong to captured inbound DM and cannot be chosen by caller alone', async () => {
  let calls = 0;
  const media = createMetaAttendanceMedia({ fetch: async () => { calls++; return response().value; } });
  for (const changes of [{ isEcho: true }, { status: 'ignored' }, { surface: 'comment' }, { eventType: 'message_echo' }, { channel: 'whatsapp' }, { attachments: [] }]) {
    const f = fixture(); f.event = { ...f.event, ...changes };
    assert.equal((await media.download(f)).code, 'ineligible_media');
  }
  const unbound = fixture(); unbound.attachment = { ...unbound.attachment, url: `${URL_FIXTURE}&other=1` };
  assert.equal((await media.download(unbound)).code, 'ineligible_media');
  assert.equal(calls, 0);
});

test('redirects never followed and expired responses are sanitized', async () => {
  for (const options of [{ status: 302 }, { redirected: true }, { url: 'https://evil.example/a' }]) {
    let calls = 0;
    const media = createMetaAttendanceMedia({ fetch: async () => { calls++; return response(PNG, options).value; } });
    assert.deepEqual(await media.download(fixture()), { ok: false, code: 'media_redirect_not_allowed' });
    assert.equal(calls, 1);
  }
  for (const status of [401, 403, 404, 410]) {
    const media = createMetaAttendanceMedia({ fetch: async () => response(PNG, { status }).value });
    assert.deepEqual(await media.download(fixture()), { ok: false, code: 'media_expired_or_unavailable' });
  }
  const media = createMetaAttendanceMedia({ fetch: async () => { throw Error(URL_FIXTURE); } });
  assert.deepEqual(await media.download(fixture()), { ok: false, code: 'media_download_failed' });
});

test('declared oversized body rejected before reading and cancelled', async () => {
  const remote = response(PNG, { length: MAX_MEDIA_BYTES + 1 });
  const media = createMetaAttendanceMedia({ fetch: async () => remote.value });
  assert.equal((await media.download(fixture())).code, 'media_too_large');
  assert.equal(remote.state.reads, 0);
  assert.equal(remote.state.cancelled, true);
});

test('actual streaming limit enforced despite absent or misleading content-length', async () => {
  for (const length of [undefined, 1]) {
    const remote = response(PNG, { length, chunks: [Buffer.alloc(MAX_MEDIA_BYTES), Buffer.from([1]), PNG] });
    const media = createMetaAttendanceMedia({ fetch: async () => remote.value });
    assert.equal((await media.download(fixture())).code, 'media_too_large');
    assert.equal(remote.state.reads, 2);
    assert.equal(remote.state.cancelled, true);
  }
});

test('empty or unbounded non-stream responses are rejected', async () => {
  const empty = createMetaAttendanceMedia({ fetch: async () => response(Buffer.alloc(0)).value });
  assert.equal((await empty.download(fixture())).code, 'media_empty');
  let arrayBufferCalled = false;
  const nonstream = createMetaAttendanceMedia({ fetch: async () => ({ ...response().value, body: null, arrayBuffer: () => { arrayBufferCalled = true; } }) });
  assert.equal((await nonstream.download(fixture())).code, 'media_stream_required');
  assert.equal(arrayBufferCalled, false);
});

test('total deadline bounds stalled fetch and stalled stream with abort', async () => {
  let signal;
  const waiting = createMetaAttendanceMedia({ timeoutMs: 15, fetch: (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  assert.deepEqual(await waiting.download(fixture()), { ok: false, code: 'media_download_timeout' });
  assert.equal(signal.aborted, true);
  let cancelled = false;
  const stalled = createMetaAttendanceMedia({ timeoutMs: 15, fetch: async () => ({ ...response().value,
    body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => { cancelled = true; }, releaseLock() {} }) },
  }) });
  assert.deepEqual(await stalled.download(fixture()), { ok: false, code: 'media_download_timeout' });
  assert.equal(cancelled, true);
});
