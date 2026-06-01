import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/coinPromotionService.ts', 'utf8');

assert.match(source, /vpsClient/, 'coin promotions must use the VPS client for table operations');
assert.match(source, /\/table-data\/coin_promotions/, 'coin promotions must use VPS table-data');
assert.doesNotMatch(source, /\.from\(['"]coin_promotions['"]\)/, 'coin promotions must not read/write the table through Supabase');
assert.doesNotMatch(source, /increment_coin_promo_uses/, 'coin promotion use counters must not call the old Supabase RPC');
assert.match(source, /addCoins\(/, 'coin bonus crediting must use the VPS coin ledger helper');
assert.doesNotMatch(source, /supabase\.rpc\(['"]add_coins['"]/, 'coin bonus crediting must not call the old Supabase RPC');
assert.match(source, /pk=id/, 'VPS table-data updates must use the explicit primary key');

console.log('coin promotion VPS static checks passed');
