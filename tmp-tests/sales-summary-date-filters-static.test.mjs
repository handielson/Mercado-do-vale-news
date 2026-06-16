import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');

assert.match(
  source,
  /if\s*\(\s*dateFrom\s*\)\s*\{[\s\S]*activeFilters\.start_date\s*=\s*`\$\{dateFrom\}T00:00:00`/,
  'SalesPage must send the selected start date to the sales query',
);

assert.match(
  source,
  /if\s*\(\s*dateTo\s*\)\s*\{[\s\S]*activeFilters\.end_date\s*=\s*`\$\{dateTo\}T23:59:59`/,
  'SalesPage must send the selected end date to the sales query',
);

assert.match(
  source,
  /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*loadData\(\);[\s\S]*\},\s*\[\s*filters\s*,\s*statusFilter\s*,\s*dateFrom\s*,\s*dateTo\s*\]\s*\)/,
  'SalesPage must reload remote sales when date filters change',
);

assert.match(
  source,
  /const\s+summaryStats\s*=\s*useMemo\(\s*\(\)\s*=>\s*\{[\s\S]*dateFrom[\s\S]*dateTo[\s\S]*total_revenue[\s\S]*profit_margin[\s\S]*\},\s*\[\s*sales\s*,\s*dateFrom\s*,\s*dateTo\s*,\s*statusFilter\s*\]\s*\)/,
  'SalesPage summary cards must be derived from the date-filtered sales shown on the page',
);

assert.doesNotMatch(
  source,
  /\{summary\s*\?\s*formatCurrency\(summary\.(?:total_revenue|total_profit|average_ticket)\)/,
  'SalesPage summary cards must not render stale remote summary totals',
);

assert.doesNotMatch(
  source,
  /getSalesSummary/,
  'SalesPage must not fetch a separate summary that can race with the filtered sales list',
);

assert.match(
  source,
  /getSaleCollectedTotal/,
  'SalesPage revenue cards must use the same collected-total helper as sale details',
);

assert.match(
  source,
  /getSaleRealProfit/,
  'SalesPage profit cards must use the same real-profit helper as sale details',
);

assert.doesNotMatch(
  source,
  /sum, sale\) => sum \+ sale\.profit/,
  'SalesPage summary must not add stale persisted sale.profit values',
);

console.log('sales summary date filters static checks passed');
