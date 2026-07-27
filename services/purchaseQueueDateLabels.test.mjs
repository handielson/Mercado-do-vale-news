import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatPurchaseQueueSalesLabel,
  formatQueueDigestDate,
} from './purchaseQueueDateLabels.js';

const now = new Date('2026-04-19T18:00:00-03:00');

assert.equal(formatQueueDigestDate(now), '2026-04-19');
assert.equal(
  formatPurchaseQueueSalesLabel(
    { last_digest_quantity: 1, last_digest_date: '2026-04-19' },
    now,
  ),
  '1 vendida hoje',
);
assert.equal(
  formatPurchaseQueueSalesLabel(
    { last_digest_quantity: 3, last_digest_date: '2026-04-17' },
    now,
  ),
  '3 vendidas em 17/04/2026',
);
assert.equal(
  formatPurchaseQueueSalesLabel(
    { last_digest_quantity: 2, last_digest_date: 'data-invalida' },
    now,
  ),
  '2 vendidas na ultima atualizacao',
);

const component = readFileSync('components/admin/dashboard/DashboardPurchaseQueue.tsx', 'utf8');
const service = readFileSync('services/purchaseQueueService.js', 'utf8');

assert.match(
  component,
  /formatPurchaseQueueSalesLabel\(item\)/,
  'the purchase queue must render the persisted digest date instead of always saying today',
);
assert.match(
  service,
  /Vendas: \$\{formatPurchaseQueueSalesLabel\(item\)\}/,
  'the copied purchase list must include the real digest date',
);

console.log('purchaseQueueDateLabels.test.mjs: ok');
