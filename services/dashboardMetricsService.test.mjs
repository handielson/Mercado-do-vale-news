import assert from 'node:assert/strict';
import {
  buildDailyDashboardMetrics,
  isSameLocalDay,
} from './dashboardMetricsService.js';

assert.equal(isSameLocalDay('2026-04-19T10:00:00-03:00', new Date('2026-04-19T22:00:00-03:00')), true);
assert.equal(isSameLocalDay('2026-04-18T23:59:00-03:00', new Date('2026-04-19T08:00:00-03:00')), false);

const metrics = buildDailyDashboardMetrics({
  sales: [
    { created_at: '2026-04-19T09:00:00-03:00', total_amount: 10000, items: [{ quantity: 1, unit_price: 10000, cost_price: 7000 }] },
    { created_at: '2026-04-19T11:00:00-03:00', total_amount: 5000, items: [{ quantity: 2, unit_price: 2500, cost_price: 1500 }] },
    { created_at: '2026-04-18T11:00:00-03:00', total_amount: 9999, items: [{ quantity: 1, unit_price: 9999, cost_price: 1 }] },
  ],
  now: new Date('2026-04-19T18:00:00-03:00'),
});

assert.deepEqual(metrics, {
  revenueCents: 15000,
  profitCents: 5000,
  salesCount: 2,
  referenceDate: '2026-04-19',
  periodMode: 'today',
});

const fallbackMetrics = buildDailyDashboardMetrics({
  sales: [
    { created_at: '2026-04-17T09:00:00-03:00', total_amount: 20000, items: [{ quantity: 1, unit_price: 20000, cost_price: 14000 }] },
    { created_at: '2026-04-17T11:00:00-03:00', total_amount: 7000, items: [{ quantity: 1, unit_price: 7000, cost_price: 4000 }] },
    { created_at: '2026-04-16T11:00:00-03:00', total_amount: 9999, items: [{ quantity: 1, unit_price: 9999, cost_price: 1 }] },
  ],
  now: new Date('2026-04-19T18:00:00-03:00'),
});

assert.deepEqual(fallbackMetrics, {
  revenueCents: 27000,
  profitCents: 9000,
  salesCount: 2,
  referenceDate: '2026-04-17',
  periodMode: 'latest',
});

console.log('dashboardMetricsService.test.mjs: ok');
