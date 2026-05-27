import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.js', 'utf8');
const fnMatch = source.match(/async function fetchBlingSalesOrderDetailForSerialSyncVps[\s\S]*?\n}\n/);

assert.ok(fnMatch, 'sale detail fetch helper must exist');

const fn = fnMatch[0];

assert.match(fn, /for\s*\(\s*let\s+attempt\s*=\s*0/, 'sale detail fetch must retry transient upstream failures');
assert.match(fn, /response\.status\s*===\s*429/, 'sale detail fetch must detect Bling 429 rate limits');
assert.match(fn, /sleepBlingReconcileVps\(/, 'sale detail fetch must wait before retrying after 429');
assert.match(fn, /attempt\s*<\s*3/, 'sale detail fetch must allow multiple retry attempts');
assert.match(fn, /Bling sale detail fetch failed/, 'sale detail fetch must keep actionable error context after retries are exhausted');

console.log('vps Bling reconcile sale detail rate-limit checks ok');
