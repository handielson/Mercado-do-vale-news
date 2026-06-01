import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/units.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'unit service must not use Supabase directly for swap logs');
assert.match(source, /vpsClient/, 'unit service must use vpsClient for swap logs');
assert.match(source, /\/table-data\/unit_swap_logs/, 'unit swap logs must use the VPS table-data endpoint');
assert.match(source, /company_id/, 'unit swap logs must preserve company filtering');
assert.match(source, /old_unit_id|new_unit_id/, 'unit swap logs must preserve unit filtering');

console.log('unit swap logs VPS static checks passed');
