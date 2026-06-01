import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/cashbackService.ts', 'utf8');
const cashbackPage = readFileSync('pages/admin/CashbackPage.tsx', 'utf8');

for (const source of [service, cashbackPage]) {
  assert.doesNotMatch(
    source,
    /\.from\('coin_balances'\)|supabase\.from\('coin_balances'\)/,
    'coin_balances must not be queried through Supabase',
  );
}

assert.match(
  service,
  /\/table-data\/coin_balances\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'coin balances must be listed through paged VPS table-data',
);

assert.match(
  service,
  /export async function listCoinBalances/,
  'cashback service must expose a VPS-backed balance list for dashboard totals',
);

assert.match(
  service,
  /vpsClient\.post<CoinBalance>\('\/table-data\/coin_balances'/,
  'new coin balances must be created through VPS table-data',
);

assert.match(
  cashbackPage,
  /listCoinBalances/,
  'cashback dashboard must calculate circulation through the centralized VPS-backed balance list',
);

console.log('coin balances VPS static checks passed');
