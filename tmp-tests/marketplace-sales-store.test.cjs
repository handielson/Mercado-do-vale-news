'use strict';
// Integracao opcional: MDV_MYSQL_TEST_URL=mysql://... roda contra um banco descartavel.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMarketplaceSalesStore, toMysqlDate, fromMysqlDate } = require('../services/marketplaceSalesStore.cjs');

test('datas MySQL sao UTC e reversiveis', () => {
  const stamp = toMysqlDate('2026-11-03T12:34:56.789Z');
  assert.equal(stamp, '2026-11-03 12:34:56.789');
  assert.equal(fromMysqlDate(stamp).toISOString(), '2026-11-03T12:34:56.789Z');
  assert.equal(toMysqlDate('lixo'), null);
});

function fakePool() {
  const state = new Map();
  const queries = [];
  return {
    queries,
    state,
    async query(sql, params = []) {
      queries.push(sql.replace(/\s+/g, ' ').trim().slice(0, 60));
      if (/^SELECT \* FROM marketplace_sales_sync_state/.test(sql)) return [[state.get(params[0])].filter(Boolean)];
      if (/INSERT INTO marketplace_sales_sync_state \(source_key, last_success_at/.test(sql)) {
        const [key, success, deep, full] = params;
        const prev = state.get(key) || {};
        state.set(key, { ...prev, last_success_at: success, last_deep_at: deep || prev.last_deep_at, last_full_at: full || prev.last_full_at, last_error: null });
      } else if (/INSERT INTO marketplace_sales_sync_state \(source_key, last_error/.test(sql)) {
        state.set(params[0], { ...(state.get(params[0]) || {}), last_error: params[1] });
      }
      if (/INSERT INTO marketplace_sales_cache/.test(sql)) return [{ affectedRows: params[0].length }];
      return [[]];
    },
  };
}

test('primeira sincronizacao e completa, depois profunda periodica, depois so recente', async () => {
  let clock = Date.parse('2026-11-03T12:00:00Z');
  const calls = [];
  const pool = fakePool();
  const source = { channel: 'shopee', connectionId: 'primary', label: 'Shopee MV', load: async (args) => { calls.push(args); return [{ external_id: 'A', occurred_at: '2026-11-03T10:00:00Z', status: 'READY' }]; } };
  const store = createMarketplaceSalesStore({ pool, listSources: async () => [source], now: () => clock, logger: { warn() {} } });
  assert.equal((await store.syncSource(source)).mode, 'full');
  assert.equal(calls[0].limit, 500);
  assert.equal(calls[0].startDate, new Date(clock - 366 * 86400000).toISOString());
  clock += 2 * 60 * 1000;
  assert.equal((await store.syncSource(source)).mode, 'recent');
  assert.equal(calls[1].limit, 150);
  assert.equal(calls[1].startDate, new Date(clock - 3 * 86400000).toISOString());
  clock += 6 * 60 * 60 * 1000;
  assert.equal((await store.syncSource(source)).mode, 'deep');
  assert.equal(calls[2].startDate, new Date(clock - 60 * 86400000).toISOString());
});

test('falha de um canal fica registrada e nao derruba os outros', async () => {
  const pool = fakePool();
  const ok = { channel: 'tiktok', connectionId: '', label: 'TikTok Shop', load: async () => [] };
  const bad = { channel: 'mercado_livre', connectionId: '', label: 'Mercado Livre', load: async () => { throw new Error('Conecte a conta'); } };
  const store = createMarketplaceSalesStore({ pool, listSources: async () => [ok, bad], logger: { warn() {} } });
  const results = await store.syncAll();
  assert.deepEqual(results.map((r) => r.ok), [true, false]);
  assert.equal(pool.state.get('mercado_livre:').last_error, 'Conecte a conta');
});

test('chamadas simultaneas do mesmo canal reaproveitam a mesma sincronizacao', async () => {
  const pool = fakePool();
  let loads = 0;
  const source = { channel: 'tiktok', connectionId: '', label: 'TikTok', load: async () => { loads += 1; await new Promise((r) => setTimeout(r, 20)); return []; } };
  const store = createMarketplaceSalesStore({ pool, listSources: async () => [source], logger: { warn() {} } });
  await Promise.all([store.syncSource(source), store.syncSource(source), store.syncAll()]);
  assert.equal(loads, 1);
});

test('servidor expoe leitura do cache e sincroniza so em segundo plano', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const server = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(server, /marketplace-sales-store-v1/);
    assert.match(server, /fastify\.get\('\/admin\/marketplace-sales'/);
    assert.match(server, /syncInBackgroundIfStale\(\);\s*const result = await marketplaceSalesStoreVps\.listSales/);
    assert.match(server, /fastify\.post\('\/admin\/marketplace-sales\/sync'/);
  }
  const deploy = fs.readFileSync(path.join(__dirname, '..', 'deploy-vps-server-only.cjs'), 'utf8');
  assert.match(deploy, /services\/marketplaceSalesStore\.cjs/, 'deploy precisa enviar o servico do cache');
});

test('SQL real (opcional)', { skip: !process.env.MDV_MYSQL_TEST_URL }, async () => {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool(process.env.MDV_MYSQL_TEST_URL);
  try {
    let clock = Date.parse('2026-11-03T12:00:00Z');
    let payload = [{ external_id: 'X1', occurred_at: '2026-11-02T10:00:00Z', status: 'READY', total_cents: 100 }, { external_id: 'X2', occurred_at: '2026-10-01T10:00:00Z', status: 'COMPLETED' }];
    const source = { channel: 'shopee', connectionId: 'primary', label: 'Shopee MV', load: async () => payload };
    const store = createMarketplaceSalesStore({ pool, listSources: async () => [source], now: () => clock, logger: { warn() {} } });
    await store.syncSource(source);
    let listed = await store.listSales({});
    assert.equal(listed.sales.length, 2);
    assert.equal(listed.sales[0].external_id, 'X1');
    assert.equal(listed.sales[0].source_channel, 'shopee');
    assert.equal(listed.sources[0].initial_sync_done, true);
    const since = listed.server_time;
    clock += 60_000;
    payload = [{ ...payload[0], status: 'CANCELLED' }, payload[1]];
    await store.syncSource(source);
    listed = await store.listSales({ changedSince: since });
    assert.deepEqual(listed.sales.map((s) => [s.external_id, s.status]), [['X1', 'CANCELLED']], 'delta traz so o que mudou');
    listed = await store.listSales({ startDate: '2026-10-15T00:00:00Z' });
    assert.deepEqual(listed.sales.map((s) => s.external_id), ['X1']);
  } finally {
    await pool.end();
  }
});
