import assert from 'node:assert/strict';
import {
  buildDailyDashboardMetrics,
  buildProductCostLookup,
  calculateSaleProfitCents,
} from '../services/dashboardMetricsService.js';

const productCostById = buildProductCostLookup([
  { id: 'phone-1', price_cost: 35000 },
  { id: 'case-1', price_cost: 1200 },
]);

assert.equal(
  calculateSaleProfitCents({
    total: 59710,
    profit: 0,
    items: [
      { product_id: 'phone-1', quantity: 1, unit_price: 57000 },
      { product_id: 'case-1', quantity: 1, unit_price: 2710 },
    ],
  }, productCostById),
  23510,
);

const metrics = buildDailyDashboardMetrics({
  now: new Date('2026-06-09T18:30:00-03:00'),
  productCostById,
  sales: [
    {
      id: 'sale-1',
      created_at: '2026-06-09T16:00:00-03:00',
      status: 'completed',
      total: 59710,
      profit: 0,
      items: [
        { product_id: 'phone-1', quantity: 1, unit_price: 57000 },
        { product_id: 'case-1', quantity: 1, unit_price: 2710 },
      ],
    },
  ],
});

assert.deepEqual(metrics, {
  revenueCents: 59710,
  profitCents: 23510,
  salesCount: 1,
  referenceDate: '2026-06-09',
  periodMode: 'today',
});

console.log('dashboard-profit-metrics.test.mjs: ok');
