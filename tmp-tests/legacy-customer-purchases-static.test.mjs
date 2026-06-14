import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/legacyCustomerPurchasesService.ts', 'utf8');
const tab = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');

assert.match(
  service,
  /legacy_customer_purchases/,
  'legacy purchase history must read the informational VPS table'
);

assert.match(
  service,
  /filter\(\(purchase\) => String\(purchase\.customer_id \|\| ''\) === String\(customerId\)\)/,
  'legacy purchase history must be filtered by customer_id before rendering'
);

assert.match(
  tab,
  /Hist[oó]rico do sistema antigo/i,
  'purchase history tab must show a dedicated legacy history section'
);

assert.match(
  tab,
  /Informativo/i,
  'legacy purchases must be labeled as informational'
);

assert.doesNotMatch(
  tab,
  /legacyPurchases[\s\S]{0,120}setSales/,
  'legacy purchases must not be merged into operational sales state'
);

assert.match(
  server,
  /CREATE TABLE IF NOT EXISTS legacy_customer_purchases/,
  'VPS startup migration must create the informational legacy purchase table'
);

assert.match(
  server,
  /uniq_legacy_customer_purchases_sale/,
  'legacy purchase imports must be idempotent by old sale id'
);

console.log('legacy customer purchases static checks passed');
