import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/checkinService.ts', 'utf8');

assert.match(source, /vpsClient/, 'checkin service must use the VPS client');
assert.match(source, /\/table-data\/checkin_logs\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'checkin logs must be listed through paged VPS table-data');
assert.match(source, /\/table-data\/checkin_logs['"]/, 'checkin creation must post through VPS table-data');
assert.doesNotMatch(source, /\.from\('checkin_logs'\)|supabase\.from\('checkin_logs'\)/, 'checkin service must not use Supabase for checkin_logs');
assert.match(source, /addCoins\(/, 'checkin coin crediting must use the VPS coin ledger helper');
assert.doesNotMatch(source, /supabase\.rpc\('add_coins'/, 'checkin coin crediting must not call the old Supabase RPC');

console.log('checkin service VPS static checks passed');
