import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { classifySaleAlerts } from '../services/saleAlertFeed.js';

const require = createRequire(import.meta.url);
const { createMobileSalesPushService } = require('../services/mobileSalesPushService.cjs');

test('browser seeds existing events and alerts only for fresh unseen sales', () => {
  const now = Date.parse('2026-09-23T16:00:00.000Z');
  const old = { id: 'old', created_at: new Date(now - 60_000).toISOString() };
  const newSale = { id: 'new', created_at: new Date(now - 10_000).toISOString() };
  const initial = classifySaleAlerts([old], [], false, now);
  assert.deepEqual(initial.alerts, []);
  const next = classifySaleAlerts([newSale, old], initial.seenIds, true, now);
  assert.deepEqual(next.alerts.map((sale) => sale.id), ['new']);
  assert.deepEqual(classifySaleAlerts([newSale, old], next.seenIds, true, now).alerts, []);
});

test('browser does not raise historical or future-dated popups', () => {
  const now = Date.parse('2026-09-23T16:00:00.000Z');
  const stale = { id: 'stale', created_at: new Date(now - 31 * 60_000).toISOString() };
  const future = { id: 'future', created_at: new Date(now + 6 * 60_000).toISOString() };
  const result = classifySaleAlerts([stale, future], [], true, now);
  assert.deepEqual(result.alerts, []);
  assert.deepEqual(result.seenIds, ['stale', 'future']);
});

test('authenticated feed returns minimal sale identifiers with a bounded query', async () => {
  let queryText = '';
  let queryLimit = 0;
  const service = createMobileSalesPushService({
    pool: {
      query: async (sql, params) => {
        queryText = sql;
        queryLimit = params[0];
        return [[{
          id: 'event-id', channel: 'tiktok', external_id: 'order-id',
          display_id: 'MUST-NOT-EXPOSE',
          occurred_at: new Date('2026-09-23T15:00:00.000Z'),
          created_at: new Date('2026-09-23T15:01:00.000Z'),
          customer_name: 'Must not be exposed',
        }]];
      },
    },
  });
  const sales = await service.listRecentSaleAlerts(500);
  assert.match(queryText, /FROM mobile_sale_events/);
  assert.equal(queryLimit, 100);
  assert.deepEqual(Object.keys(sales[0]), ['id', 'channel', 'external_id', 'display_id', 'occurred_at', 'created_at']);
  assert.equal(sales[0].display_id, '');
});

test('PDV alert uses the receipt-facing sale code without exposing event details', async () => {
  const service = createMobileSalesPushService({
    pool: { query: async () => [[{
      id: 'event-id', channel: 'pdv',
      external_id: 'a4eaf564-6dd5-40b6-a0fc-c1c0ebec49c4',
      display_id: 'A4EAF564',
      occurred_at: new Date('2026-09-23T15:00:00.000Z'),
      created_at: new Date('2026-09-23T15:01:00.000Z'),
    }]] },
  });
  const [alert] = await service.listRecentSaleAlerts();
  assert.equal(alert.display_id, 'A4EAF564');
  assert.equal(alert.external_id, 'a4eaf564-6dd5-40b6-a0fc-c1c0ebec49c4');
  const component = readFileSync(new URL('../components/admin/SaleAlerts.tsx', import.meta.url), 'utf8');
  assert.match(component, /alert\.display_id \|\| alert\.external_id\.split\('-'\)\[0\]\.toUpperCase\(\)/);
});

test('API route stays admin-only and TikTok poller has an idempotent alert fallback', () => {
  const server = readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');
  assert.match(server, /fastify\.get\('\/admin\/sale-alerts', \{ preHandler: requireAdminBearerToken \}/);
  assert.match(server, /recordSaleEvent\(normalizeMobileTikTokOrderVps\(freshOrder\)\)/);
  assert.match(server, /recordSaleEvent\(normalizeMobileTikTokOrderVps\(freshOrder\)\)[\s\S]{0,180}catch/);
});

test('Android sale notification is allowed to peek on screen', () => {
  const messaging = readFileSync(new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/push/SalesMessagingService.kt', import.meta.url), 'utf8');
  assert.match(messaging, /NotificationManager\.IMPORTANCE_HIGH/);
  assert.match(messaging, /NotificationCompat\.PRIORITY_HIGH/);
  assert.doesNotMatch(messaging, /\.setSilent\(true\)/);
});
