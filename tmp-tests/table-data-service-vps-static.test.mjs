import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/table-data.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'table-data service must not use Supabase directly');
assert.match(source, /vpsClient/, 'table-data service must use vpsClient');
assert.match(source, /\/table-data\/\$\{encodeURIComponent\(tableName\)\}/, 'table-data service must call the protected VPS table-data endpoint');
assert.match(source, /rows/, 'table-data service must read rows returned by the VPS table-data response');

console.log('table-data service VPS static checks passed');
