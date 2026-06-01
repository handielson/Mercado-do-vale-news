import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/inventory/SerializedUnitsPage.tsx', 'utf8');

assert.doesNotMatch(source, /\.from\(['"]unit_swap_logs['"]\)/, 'serialized units page must not read unit_swap_logs through Supabase directly');
assert.match(source, /unitService\.getSwapLogs/, 'serialized units page must read swap logs through the VPS-backed unit service');
assert.match(source, /old_unit/, 'serialized units page must keep old unit display enrichment');
assert.match(source, /new_unit/, 'serialized units page must keep new unit display enrichment');

console.log('serialized units swap logs VPS static checks passed');
