import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/typeUpgradeRequests.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]/, 'type upgrade requests must not import Supabase');
assert.doesNotMatch(source, /supabase\s*\./, 'type upgrade requests must not call Supabase directly');
assert.match(source, /vpsClient/, 'type upgrade requests must use the VPS client');
assert.match(source, /\/table-data\/customer_type_requests/, 'type upgrade requests must use the VPS table-data endpoint');
assert.match(source, /\/table-data\/customers/, 'approval must update the customer through VPS table-data');
assert.match(source, /pk=id/, 'VPS table-data updates must use the explicit primary key');

console.log('type upgrade requests VPS static checks passed');
