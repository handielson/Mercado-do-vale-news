import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/repair-sale-serialized-unit.cjs', 'utf8');

assert.match(source, /process\.argv\.includes\('--execute'\)/, 'repair must be dry-run unless --execute is explicit');
assert.match(source, /beginTransaction\(\)/, 'sale and inventory repair must run in one transaction');
assert.match(source, /FOR UPDATE/, 'sale and unit rows must be locked before validation');
assert.match(source, /equivalent\(oldUnit, newUnit\)/, 'replacement must stay in the same commercial variation');
assert.match(source, /UPDATE sale_items SET product_id=\?, serialized_unit_id=\?, imei=\?, unit_cost=\?/, 'sale item must point to the replacement unit and its cost');
assert.match(source, /status='available'.*sale_id=NULL/s, 'the incorrect unit must return to available stock');
assert.match(source, /status='sold'.*sale_id=\?/s, 'the replacement unit must become sold and link to the sale');
assert.match(source, /hasSwapLogTable[\s\S]*INSERT INTO unit_swap_logs/, 'the repair must use the dedicated audit table when the deployed schema has it');
assert.match(source, /internal_notes=CONCAT_WS[\s\S]*Liberada por correcao administrativa/, 'the repair must always leave an audit trail on the affected units');
assert.match(source, /rollback\(\)/, 'failures and dry runs must roll back');
assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:oldIdentifier|newIdentifier)/, 'logs must not print complete IMEIs');

console.log('sale serialized-unit repair safety checks passed');
