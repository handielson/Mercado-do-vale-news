import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');

assert.match(
  source,
  /if\s*\(\s*dateFrom\s*\)\s*\{[\s\S]*activeFilters\.start_date\s*=\s*`\$\{dateFrom\}T00:00:00`/,
  'SalesPage must send the selected start date to getSales and getSalesSummary',
);

assert.match(
  source,
  /if\s*\(\s*dateTo\s*\)\s*\{[\s\S]*activeFilters\.end_date\s*=\s*`\$\{dateTo\}T23:59:59`/,
  'SalesPage must send the selected end date to getSales and getSalesSummary',
);

assert.match(
  source,
  /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*loadData\(\);[\s\S]*\},\s*\[\s*filters\s*,\s*statusFilter\s*,\s*dateFrom\s*,\s*dateTo\s*\]\s*\)/,
  'SalesPage must reload remote sales and summary when date filters change',
);

console.log('sales summary date filters static checks passed');
