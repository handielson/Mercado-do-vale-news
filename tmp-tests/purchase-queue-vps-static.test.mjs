import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/purchaseQueueService.js', 'utf8');

assert.match(source, /vpsClient/, 'purchase queue must use the VPS client');
assert.match(source, /\/table-data\/\$\{PURCHASE_QUEUE_TABLE\}/, 'purchase queue must use VPS table-data');
assert.doesNotMatch(source, /import\(['"]\.\/supabase['"]\)|getSupabaseClient|\.from\(PURCHASE_QUEUE_TABLE\)/, 'purchase queue must not use Supabase table reads/writes');

console.log('purchase queue VPS static checks passed');
