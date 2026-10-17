const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const Fastify = require('fastify');
const { registerMetaAttendanceRoutes, attendanceConfig } = require('../services/metaAttendanceServer.cjs');
const { WEBHOOK_PATH } = require('../services/metaAttendanceCore.cjs');

const config = { enabled: true, appSecret: 'synthetic-app-secret', verifyToken: 'synthetic-verification-token-32-chars' };
function message(mid = 'mid-1', text = 'Tem celulares?') {
  return { sender: { id: 'client-1' }, recipient: { id: 'page-1' }, timestamp: 1792252800000, message: { mid, text } };
}
function payload(messages = [message()]) { return { object: 'page', entry: [{ id: 'page-1', messaging: messages }] }; }
function request(body = payload(), options = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return { method: 'POST', url: WEBHOOK_PATH, payload: raw, headers: {
    'content-type': 'application/json',
    'x-hub-signature-256': `sha256=${createHmac('sha256', config.appSecret).update(raw).digest('hex')}`,
    ...options.headers,
  } };
}

async function fixture(options = {}) {
  const app = Fastify();
  const rows = new Map(), actions = [];
  let staged = null;
  const pool = {
    async query(sql, params = []) {
      actions.push('read');
      if (sql.includes('FROM meta_marketing_connections')) return [[{ selected_page_id: 'page-1', selected_instagram_account_id: 'ig-1' }]];
      if (options.noSchema) throw new Error('secret SQL error with customer data');
      if (sql === 'SELECT id FROM meta_attendance_events LIMIT 0') return [[]];
      if (sql.includes('FROM meta_attendance_events WHERE')) {
        assert.deepEqual(params.slice(0, 2), ['page-1', 'ig-1']);
        assert.match(sql, /channel='messenger' AND account_id=\?/);
        assert.match(sql, /channel='instagram' AND account_id=\?/);
        assert.match(sql, /ORDER BY id DESC LIMIT \d+$/);
        return [[...rows.values()].map((event, i) => ({ id: String(i + 1), normalized_event: JSON.stringify(event) }))];
      }
      throw new Error('Unexpected SQL in fixture');
    },
    async getConnection() {
      actions.push('connection');
      return {
        async beginTransaction() { staged = new Map(rows); actions.push('begin'); },
        async query(sql, params) {
          actions.push('insert');
          assert.match(sql, /ON DUPLICATE KEY UPDATE event_key=VALUES\(event_key\)/);
          if (options.noSchema || params[5] === options.failMessageId) throw new Error('secret insert error');
          const event = JSON.parse(params[9]);
          if (!staged.has(params[0])) staged.set(params[0], event);
          return [{ affectedRows: 1 }];
        },
        async commit() {
          actions.push('commit');
          if (options.failCommit) throw new Error('secret commit failure');
          rows.clear(); for (const [key, value] of staged) rows.set(key, value);
        },
        async rollback() { actions.push('rollback'); staged = null; },
        release() { actions.push('release'); },
      };
    },
  };
  // This parent route proves the buffer parser stays inside the webhook plugin.
  app.post('/unrelated-json', async req => ({ isBuffer: Buffer.isBuffer(req.body), value: req.body.value }));
  registerMetaAttendanceRoutes(app, {
    pool, getConfig: () => ({ ...config, ...options.config }),
    requireAdminBearerToken: async (req, reply) => {
      if (req.headers.authorization !== 'Bearer synthetic-admin') return reply.code(401).send({ error: 'unauthorized' });
    },
  });
  await app.ready();
  return { app, rows, actions };
}

test('feature is off by default; challenge and ingestion fail closed before database access', async t => {
  assert.equal(attendanceConfig({}).enabled, false);
  const f = await fixture({ config: { enabled: false } }); t.after(() => f.app.close());
  assert.equal((await f.app.inject(WEBHOOK_PATH)).statusCode, 503);
  assert.equal((await f.app.inject(request())).statusCode, 503);
  assert.deepEqual(f.actions, []);
});

test('challenge requires exact token and subscribe mode, and returns plain text', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const url = `${WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=abc-123`;
  const response = await f.app.inject(url);
  assert.equal(response.statusCode, 200); assert.equal(response.body, 'abc-123');
  assert.match(response.headers['content-type'], /^text\/plain/);
  assert.equal((await f.app.inject(url.replace('subscribe', 'delete'))).statusCode, 403);
  assert.equal((await f.app.inject(url.replace(config.verifyToken, 'wrong'))).statusCode, 403);
  assert.equal((await f.app.inject(`${WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=${config.verifyToken}`)).statusCode, 403);
  assert.deepEqual(f.actions, []);
});

test('signature is verified against original UTF-8 bytes before parsing or any database call', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const raw = JSON.stringify(payload([message('mid-spaces', 'Olá, João 👋')]), null, 2);
  const good = request(raw);
  const tampered = { ...good, payload: raw.replace('João', 'José') };
  assert.equal((await f.app.inject(tampered)).statusCode, 403);
  assert.deepEqual(f.actions, []);
  assert.equal((await f.app.inject(good)).statusCode, 200);
  assert.equal([...f.rows.values()][0].text, 'Olá, João 👋');
  const noSignature = request(); delete noSignature.headers['x-hub-signature-256'];
  assert.equal((await f.app.inject(noSignature)).statusCode, 403);
});

test('valid signature does not make malformed JSON, invalid envelope or oversized body acceptable', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  assert.equal((await f.app.inject(request('{broken'))).statusCode, 400);
  assert.deepEqual(f.actions, []);
  assert.equal((await f.app.inject(request({ object: 'whatsapp_business_account', entry: [] }))).statusCode, 400);
  assert.equal((await f.app.inject(request(' '.repeat(1024 * 1024 + 1)))).statusCode, 413);
  assert.equal(f.rows.size, 0);
});

test('entire batch is committed before ACK and replay never overwrites the first received message', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  let response = await f.app.inject(request(payload([message('a'), message('b')])));
  assert.equal(response.statusCode, 200); assert.equal(response.body, 'EVENT_RECEIVED');
  assert.deepEqual(f.actions, ['read', 'connection', 'begin', 'insert', 'insert', 'commit', 'release']);
  assert.equal(f.rows.size, 2);
  response = await f.app.inject(request(payload([message('a', 'Replay with changed text')])));
  assert.equal(response.statusCode, 200); assert.equal(f.rows.size, 2);
  assert.equal([...f.rows.values()].find(event => event.providerEventId === 'a').text, 'Tem celulares?');
});

test('partial write and commit failure return retryable 503, rollback and retain no partial batch', async t => {
  for (const option of [{ failMessageId: 'b' }, { failCommit: true }]) {
    const f = await fixture(option); t.after(() => f.app.close());
    const response = await f.app.inject(request(payload([message('a'), message('b')])));
    assert.equal(response.statusCode, 503); assert.equal(response.headers['retry-after'], '30');
    assert.equal(response.json().error, 'meta_attendance_storage_unavailable');
    assert.doesNotMatch(response.body, /secret|SQL|Tem celulares/);
    assert.equal(f.rows.size, 0); assert.deepEqual(f.actions.slice(-2), ['rollback', 'release']);
  }
});

test('foreign assets are ACKed without storing, while missing schema never discards accepted account messages', async t => {
  const f = await fixture({ noSchema: true }); t.after(() => f.app.close());
  assert.equal((await f.app.inject(request({ object: 'page', entry: [{ id: 'foreign-page', messaging: [message()] }] }))).statusCode, 200);
  assert.equal(f.rows.size, 0); assert.equal(f.actions.includes('insert'), false);
  assert.equal((await f.app.inject(request())).statusCode, 503);
});

test('raw parser does not change existing JSON routes', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const response = await f.app.inject({ method: 'POST', url: '/unrelated-json', payload: { value: 'preserved' } });
  assert.deepEqual(response.json(), { isBuffer: false, value: 'preserved' });
});

test('malformed change in an otherwise valid batch is recorded as unsupported without retrying valid events', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const body = payload(); body.entry[0].changes = [null, { field: 'future-field', value: null }];
  const response = await f.app.inject(request(body));
  assert.equal(response.statusCode, 200); assert.equal(f.rows.size, 3);
  assert.equal([...f.rows.values()].filter(row => row.status === 'unsupported').length, 2);
});

test('admin-only status cannot expose secrets or imply n8n integration or outbound capability', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const url = '/admin/marketing/meta/attendance/status';
  assert.equal((await f.app.inject(url)).statusCode, 401);
  const response = await f.app.inject({ url, headers: { authorization: 'Bearer synthetic-admin' } });
  const status = response.json(); assert.equal(status.mode, 'capture_only');
  assert.equal(status.n8nConnected, false); assert.equal(status.outboundEnabled, false); assert.equal(status.storageReady, true);
  assert.doesNotMatch(response.body, new RegExp(`${config.appSecret}|${config.verifyToken}`));
  const missing = await fixture({ noSchema: true }); t.after(() => missing.app.close());
  assert.equal((await missing.app.inject({ url, headers: { authorization: 'Bearer synthetic-admin' } })).json().storageReady, false);
});

test('private event list requires administrator, constrains assets and validates filters', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const url = '/admin/marketing/meta/attendance/events';
  assert.equal((await f.app.inject(url)).statusCode, 401);
  await f.app.inject(request());
  const headers = { authorization: 'Bearer synthetic-admin' };
  const response = await f.app.inject({ url: `${url}?channel=messenger`, headers });
  assert.equal(response.statusCode, 200); assert.equal(response.json().rows[0].normalized_event.text, 'Tem celulares?');
  for (const query of ['channel=whatsapp', 'limit=0', 'limit=101', 'limit=-1', 'limit=1%20OR%201=1']) {
    assert.equal((await f.app.inject({ url: `${url}?${query}`, headers })).statusCode, 400);
  }
});
