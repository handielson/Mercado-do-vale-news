'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const {
  buildEvolutionProgram,
  buildMetaProgram,
  remoteCommand,
  parseSummary,
  control,
} = require('../scripts/n8n-upgrade-ingress-control.cjs');

const EVOLUTION_URL = 'https://n8n.mercadodovale.com.br/webhook/whatsapp';
const EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'MESSAGES_UPDATE'];

async function runEvolution(action, initial, clearOnDisable = false) {
  let state = structuredClone(initial);
  const calls = [];
  const output = [];
  const process = { env: { AUTHENTICATION_API_KEY: 'test-secret-never-print' }, exitCode: 0 };
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    assert.equal(options.headers.apikey, process.env.AUTHENTICATION_API_KEY);
    if (url.endsWith('/webhook/find/botmercadodovale')) {
      return { ok: true, json: async () => ({ webhook: structuredClone(state) }) };
    }
    assert.ok(url.endsWith('/webhook/set/botmercadodovale'));
    const body = JSON.parse(options.body).webhook;
    assert.equal(typeof body.byEvents, 'boolean');
    assert.equal(typeof body.base64, 'boolean');
    assert.equal(Object.hasOwn(body, 'webhookByEvents'), false);
    assert.equal(Object.hasOwn(body, 'webhookBase64'), false);
    state = clearOnDisable && !body.enabled
      ? { enabled: false, url: body.url, webhookByEvents: body.byEvents, webhookBase64: body.base64, events: [], headers: null }
      : { ...body, webhookByEvents: body.byEvents, webhookBase64: body.base64 };
    return { ok: true };
  };
  await vm.runInNewContext(buildEvolutionProgram(action), {
    process, fetch, AbortSignal, Date, JSON, Object,
    console: { log: value => output.push(value), error: value => output.push(value) },
  });
  return { state, calls, output, exitCode: process.exitCode };
}

test('Evolution pause preserves the exact webhook contract, reads it back, and never prints the key', async () => {
  const initial = { enabled: true, url: EVOLUTION_URL, webhookByEvents: false,
    webhookBase64: true, events: EVENTS, headers: null };
  const result = await runEvolution('pause', initial);
  assert.equal(result.exitCode, 0);
  assert.equal(result.state.enabled, false);
  assert.deepEqual(result.state.events, initial.events);
  assert.equal(result.state.url, initial.url);
  assert.equal(result.calls.filter(call => call.options.method === 'POST').length, 1);
  assert.doesNotMatch(result.output.join(' '), /test-secret-never-print/);
  assert.equal(JSON.parse(result.output[0]).changed, true);
});

test('Evolution disabled config is recognized and restored from the verified production contract', async () => {
  const initial = { enabled: true, url: EVOLUTION_URL, webhookByEvents: false,
    webhookBase64: true, events: EVENTS, headers: null };
  const paused = await runEvolution('pause', initial, true);
  assert.equal(paused.exitCode, 0);
  assert.equal(JSON.parse(paused.output[0]).disabledConfigCleared, true);
  const restored = await runEvolution('resume', paused.state, true);
  assert.equal(restored.exitCode, 0);
  assert.equal(restored.state.enabled, true);
  assert.equal(restored.state.url, EVOLUTION_URL);
  assert.deepEqual([...restored.state.events].sort(), [...EVENTS].sort());
  assert.equal(restored.state.webhookBase64, true);
});

test('Evolution status cannot mutate and wrong target blocks pause', async () => {
  const initial = { enabled: true, url: 'https://wrong.example/webhook', webhookByEvents: false,
    webhookBase64: true, events: EVENTS };
  const status = await runEvolution('status', initial);
  assert.equal(status.calls.length, 1);
  assert.equal(JSON.parse(status.output[0]).configMatches, false);
  const pause = await runEvolution('pause', initial);
  assert.equal(pause.exitCode, 1);
  assert.equal(pause.calls.length, 1);
  assert.equal(pause.state.enabled, true);
});

async function runMeta(action) {
  const rows = { enabled: 1, activation_event_id: 42, activation_at: '2026-10-18T12:00:00Z' };
  const statements = [];
  const output = [];
  const db = {
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }]];
      if (sql.startsWith('UPDATE meta_attendance_runtime')) {
        rows.enabled = params[0];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('SELECT enabled, activation_event_id')) return [[{ ...rows }]];
      if (sql.includes("WHERE status='planning'")) return [[{ count: 0 }]];
      if (sql.includes("WHERE status='sending'")) return [[{ count: 0 }]];
      if (sql.includes('FROM meta_attendance_jobs')) return [[{ status: 'completed', count: 8 }]];
      if (sql.includes('FROM meta_attendance_outbox')) return [[]];
      throw Error('Unexpected SQL');
    },
    async end() {},
  };
  const require = module => {
    if (module === 'dotenv') return { config() {} };
    if (module === 'mysql2/promise') return { createConnection: async () => db };
    if (module === 'child_process') return {
      execFileSync: () => JSON.stringify([{ name: 'mdv-api',
        pm2_env: { status: 'online', META_ATTENDANCE_REPLIES_ENABLED: 'true' } }]),
    };
    throw Error('Unexpected module');
  };
  const process = { env: { DB_HOST: 'fake', DB_USER: 'fake', DB_PASS: 'never-print',
    DB_NAME: 'fake' }, exitCode: 0 };
  await vm.runInNewContext(buildMetaProgram(action), {
    require, process, Date, Number, JSON,
    console: { log: value => output.push(value), error: value => output.push(value) },
  });
  return { rows, statements, output, exitCode: process.exitCode };
}

test('Meta pause acquires the worker lock, preserves activation markers, and releases the lock', async () => {
  const result = await runMeta('pause');
  assert.equal(result.exitCode, 0);
  assert.equal(result.rows.enabled, 0);
  const sql = result.statements.map(statement => statement.sql);
  const lock = sql.findIndex(query => query.includes('GET_LOCK'));
  const update = sql.findIndex(query => query.startsWith('UPDATE meta_attendance_runtime'));
  const release = sql.findIndex(query => query.includes('RELEASE_LOCK'));
  assert.ok(lock >= 0 && lock < update && update < release);
  assert.equal(JSON.parse(result.output[0]).activationMarkerPreserved, true);
  assert.doesNotMatch(result.output.join(' '), /never-print/);
});

test('Meta status is read-only and does not acquire the worker lock', async () => {
  const result = await runMeta('status');
  assert.equal(result.rows.enabled, 1);
  assert.equal(result.statements.some(({ sql }) => /GET_LOCK|UPDATE meta_attendance_runtime/.test(sql)), false);
});

test('generated SSH commands carry code but no credential value and summaries require readback', () => {
  for (const service of ['evolution', 'meta']) {
    const command = remoteCommand(service, 'status');
    assert.match(command, /node -e/);
    assert.doesNotMatch(command, /test-secret|never-print|AUTHENTICATION_API_KEY=/);
    assert.deepEqual(parseSummary('other log\n' + JSON.stringify({ service, enabled: false }), service),
      { service, enabled: false });
    assert.throws(() => parseSummary('{}', service), /Missing/);
  }
});

test('partial Evolution pause restores the Meta worker to its prior state', async () => {
  const calls = [];
  const conn = {
    exec(command, callback) {
      const service = command.includes('docker exec evolution_api') ? 'evolution' : 'meta';
      const encoded = /Buffer\.from\('([^']+)'/.exec(command)?.[1];
      const program = Buffer.from(encoded, 'base64').toString('utf8');
      const action = /const action = "(status|pause|resume)"/.exec(program)?.[1];
      calls.push(service + ':' + action);
      const stream = new EventEmitter();
      stream.stderr = new EventEmitter();
      callback(null, stream);
      queueMicrotask(() => {
        if (service === 'evolution' && action === 'pause') {
          stream.stderr.emit('data', 'simulated readback failure');
          stream.emit('close', 1);
        } else {
          stream.emit('data', JSON.stringify({ service, enabled: action === 'resume' || (service === 'evolution' && action === 'status'),
            changed: true, beforeEnabled: action === 'pause',
            configMatches: action === 'status', disabledConfigCleared: false }) + '\n');
          stream.emit('close', 0);
        }
      });
    },
  };
  await assert.rejects(control(conn, 'pause'), /simulated readback failure/);
  assert.deepEqual(calls, ['meta:pause', 'evolution:pause', 'evolution:status', 'meta:resume']);
});

test('failed Evolution pause restores a webhook that was disabled before readback failed', async () => {
  const calls = [];
  const conn = {
    exec(command, callback) {
      const service = command.includes('docker exec evolution_api') ? 'evolution' : 'meta';
      const encoded = /Buffer\.from\('([^']+)'/.exec(command)?.[1];
      const program = Buffer.from(encoded, 'base64').toString('utf8');
      const action = /const action = "(status|pause|resume)"/.exec(program)?.[1];
      calls.push(service + ':' + action);
      const stream = new EventEmitter(); stream.stderr = new EventEmitter();
      callback(null, stream);
      queueMicrotask(() => {
        if (service === 'evolution' && action === 'pause') {
          stream.stderr.emit('data', 'simulated readback failure');
          stream.emit('close', 1);
          return;
        }
        stream.emit('data', JSON.stringify({ service, enabled: action === 'resume',
          changed: true, beforeEnabled: action === 'pause',
          disabledConfigCleared: service === 'evolution' && action === 'status' }) + '\n');
        stream.emit('close', 0);
      });
    },
  };
  await assert.rejects(control(conn, 'pause'), /simulated readback failure/);
  assert.deepEqual(calls, ['meta:pause', 'evolution:pause', 'evolution:status', 'evolution:resume', 'meta:resume']);
});
