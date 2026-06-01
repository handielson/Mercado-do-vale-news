import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/cashbackService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /\.from\('cashback_settings'\)|supabase\.from\('cashback_settings'\)/,
  'cashback_settings must not be queried through Supabase',
);

assert.match(
  service,
  /\/table-data\/cashback_settings\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'cashback settings must be listed through paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<CashbackSettings>\(`\/table-data\/cashback_settings\/\$\{current\.id\}`/,
  'cashback settings updates must PATCH the existing VPS table-data row',
);

console.log('cashback settings VPS static checks passed');
