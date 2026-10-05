const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const mysql = require('mysql2/promise');
const { createBlingStockWebhookQueue, isBlingStockEvent } = require('../services/blingStockWebhookQueue.cjs');

const docker = (...args) => execFileSync('docker', ['--context', 'desktop-linux', ...args],
  { encoding: 'utf8', timeout: 180000, windowsHide: true }).trim();
const source = fs.readFileSync(require.resolve('../vps_server.cjs'), 'utf8');
const wrapper = source.slice(source.indexOf('async function handleBlingWebhookVps('), source.indexOf('async function processBlingWebhookVps('));
const loadHandler = queue => vm.runInNewContext(`${wrapper}; handleBlingWebhookVps`, {
  blingStockWebhookQueue: queue, isBlingStockEvent, isMercadoPagoWebhookPayload: () => false,
  processBlingWebhookVps: async (request, reply) => reply.code(200).send({ ok: true, delegated: true }),
  console: { error() {} },
});
function call(handler, body) {
  const response = { status: 0, body: null, code(value) { this.status = value; return this; }, send(value) { this.body = value; return value; } };
  return handler({ method: 'POST', body, headers: { host: 'localhost' }, url: '/api/bling-webhook', query: {} }, response).then(() => response);
}

test('failed durable receipt returns 503 so Bling can retry', async () => {
  const result = await call(loadHandler({ enqueue: async () => { throw Error('DB unavailable'); } }), { event: 'stock.updated' });
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
});

test('stock receipt acknowledges before processing; durable deduplication, retry, restart and worker exclusion', { timeout: 120000 }, async t => {
  const password = `test-${randomUUID()}`;
  const container = docker('run', '--rm', '-d', '--name', `mdv-webhook-test-${randomUUID()}`,
    '-e', `MYSQL_ROOT_PASSWORD=${password}`, '-e', 'MYSQL_ROOT_HOST=%', '-e', 'MYSQL_DATABASE=mdv_webhook_test',
    '-p', '127.0.0.1::3306', 'mysql:8.4');
  t.after(() => docker('rm', '-f', '-v', container));
  const port = Number(docker('port', container, '3306/tcp').split(':').pop());
  const config = { host: '127.0.0.1', port, user: 'root', password, database: 'mdv_webhook_test', connectionLimit: 6 };
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const db = await mysql.createConnection(config); await db.end(); break; }
    catch (error) { if (attempt === 49) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  const pool = mysql.createPool(config);
  t.after(() => pool.end());
  let count = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const queue = createBlingStockWebhookQueue({ pool, processEvent: async () => { count++; await gate; return { ok: true }; } });
  const handler = loadHandler(queue);
  const body = { eventId: 'test-1', event: 'stock.updated', data: { id: 'synthetic' } };
  const started = Date.now();
  const response = await call(handler, body);
  assert.equal(response.status, 200);
  assert.equal(response.body.queued, true);
  assert.equal(count, 0);
  assert.ok(Date.now() - started < 4000, 'ack must be sent within the Bling five second deadline');
  const duplicate = await call(handler, body);
  assert.equal(duplicate.body.duplicate, true);
  const [[receipt]] = await pool.query('SELECT status FROM bling_stock_webhook_inbox');
  assert.equal(receipt.status, 'pending');
  const working = queue.tick();
  while (count === 0) await new Promise(resolve => setTimeout(resolve, 10));
  const competing = createBlingStockWebhookQueue({ pool, processEvent: async () => { throw Error('Concurrent worker must not run'); } });
  await competing.tick();
  assert.equal(count, 1);
  release(); await working;
  await queue.tick(); assert.equal(count, 1);
  const delegated = await call(handler, { event: 'product.updated' });
  assert.equal(delegated.body.delegated, true);
  let failures = 0;
  const failing = createBlingStockWebhookQueue({ pool, logger: { warn() {}, error() {} }, processEvent: async () => { failures++; return { ok: false, reason: 'Bling unavailable' }; } });
  await failing.enqueue({ body: { ...body, eventId: 'test-2' }, headers: {}, query: {} });
  await failing.tick();
  const [[failed]] = await pool.query("SELECT status,attempts,last_error,next_attempt_at>NOW(3) AS retry_scheduled FROM bling_stock_webhook_inbox WHERE status<>'done'");
  assert.equal(failed.status, 'pending'); assert.equal(failed.attempts, 1); assert.equal(failed.last_error, 'Bling unavailable'); assert.equal(failed.retry_scheduled, 1);
  await pool.query("UPDATE bling_stock_webhook_inbox SET status='processing',updated_at=DATE_SUB(NOW(3),INTERVAL 11 MINUTE),next_attempt_at=NOW(3) WHERE status='pending'");
  const restarted = createBlingStockWebhookQueue({ pool, processEvent: async () => ({ ok: true }) });
  await restarted.tick();
  const [[finished]] = await pool.query("SELECT COUNT(*) AS total FROM bling_stock_webhook_inbox WHERE status='done'");
  assert.equal(finished.total, 2); assert.equal(failures, 1);
});

