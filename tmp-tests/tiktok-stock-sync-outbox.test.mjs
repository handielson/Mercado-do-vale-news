import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createTikTokStockSyncQueue } = require('../services/tiktokStockSyncQueue.cjs');

const versions = new Map();
const states = new Map();
const pool = {
  async query(sql, params = []) {
    if (sql.startsWith('CREATE TABLE')) return [{}];
    if (sql.startsWith('INSERT INTO tiktok_stock_sync_outbox')) {
      const id = params[0];
      versions.set(id, (versions.get(id) || 0) + 1);
      states.set(id, 'pending');
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT product_id,version')) {
      return [[...versions].map(([product_id, version]) => ({ product_id, version }))];
    }
    if (sql.startsWith("UPDATE tiktok_stock_sync_outbox\n        SET status='done'")) {
      if (versions.get(params[0]) === params[1]) states.set(params[0], 'done');
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
const queue = createTikTokStockSyncQueue({ pool, loadTargets: async () => [], syncTargets: async () => ({ ok: true }) });
const first = await queue.enqueue(['product-1'], 'sale');
const second = await queue.enqueue(['product-1'], 'newer_sale');
await queue.complete(first);
assert.equal(states.get('product-1'), 'pending', 'old completion must not close a newer desired stock version');
await queue.complete(second);
assert.equal(states.get('product-1'), 'done');

const service = readFileSync('services/tiktokStockSyncQueue.cjs', 'utf8');
assert.match(service, /status='processing'/);
assert.match(service, /status='pending'/);
assert.match(service, /version=version\+1/);
assert.match(service, /Math\.min\(1800, 5 \* 2 \*\*/);
assert.match(service, /GET_LOCK\('mdv_tiktok_stock_outbox'/);
const deploy = readFileSync('deploy-vps-server-only.cjs', 'utf8');
assert.match(deploy, /services\/tiktokOrderStockProtection\.cjs/);
assert.match(deploy, /services\/tiktokStockSyncQueue\.cjs/);
for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /tiktokStockSyncQueueVps\.enqueue/);
  assert.match(source, /syncTikTokStockFromBlingTargetsVps\(stockTargets = \[\], \{ skipQueue = false \} = \{\}\)/);
  assert.match(source, /hourly_reconciliation/);
  assert.match(source, /startup_reconciliation/);
  assert.match(source, /\/api\/tiktok-shop\/stock-protection\/status/);
}

console.log('TikTok stock outbox checks passed.');
