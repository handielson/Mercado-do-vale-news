import assert from 'node:assert/strict';
import { buildShopeeDashboardLinks } from './dashboardShopeeService.js';

const links = buildShopeeDashboardLinks({
  pendingShipment: 4,
  shipped: 8,
  newOrders: 3,
  cancelled: 1,
  returnsOrComplaints: 2,
});

assert.deepEqual(links.map((entry) => ({
  key: entry.key,
  count: entry.count,
  href: entry.href,
})), [
  { key: 'new', count: 3, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
  { key: 'pending', count: 4, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
  { key: 'shipped', count: 8, href: '/admin/settings/shopee?tab=orders&status=PROCESSED' },
  { key: 'cancelled', count: 1, href: '/admin/settings/shopee?tab=orders&status=CANCELLED' },
  { key: 'returns', count: 2, href: '/admin/settings/shopee?tab=orders&status=IN_CANCEL' },
]);

console.log('dashboardShopeeService.test.mjs: ok');
