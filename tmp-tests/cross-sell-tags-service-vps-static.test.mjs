import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/cross-sell-tags.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'cross-sell tags service must not use Supabase directly');
assert.match(source, /vpsClient/, 'cross-sell tags service must use vpsClient');
assert.match(source, /\/table-data\/cross_sell_tags/, 'cross-sell tags service must call the VPS table-data endpoint');
assert.match(source, /encodeURIComponent\(id\)/, 'cross-sell tag row mutations must safely address ids');
assert.match(source, /updated_at:\s*new Date\(\)\.toISOString\(\)/, 'cross-sell tag updates must preserve updated_at behavior');
assert.match(source, /findExistingTag/, 'cross-sell tag create must preserve existing tag lookup before insert');

console.log('cross-sell tags service VPS static checks passed');
