import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs', 'utf8');

assert.match(source, /Range: '0-49'/, 'diagnostic must use the same bounded page');
assert.match(source, /bodyPreview/, 'diagnostic must print only a bounded body preview');
assert.match(source, /\[REDACTED\]/, 'diagnostic must redact long token-like strings');
assert.doesNotMatch(source, /console\.log\(.*key|console\.log\(.*Authorization|console\.log\(.*apikey/i, 'diagnostic must not print keys or headers');

console.log('vps Bling sync-prices Supabase diagnostic static ok');
