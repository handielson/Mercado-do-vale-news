import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/rebuild-smartphone-serialized-units.cjs', 'utf8');

assert.match(source, /--cleanup-legacy-products/, 'legacy product cleanup must require an explicit flag');
assert.match(source, /product\.id !== canonical\.id[\s\S]*sourceUnits\.length === 0[\s\S]*existingUnit\.product_id === canonical\.id/, 'cleanup candidates must be migrated non-canonical products without units');
assert.match(source, /units\/by-identifier\//, 'cleanup must revalidate the serialized identifier immediately before mutation');
assert.match(source, /source product owns units and cannot be archived automatically/, 'products that own units must never be archived by cleanup');
assert.match(source, /status: 'inactive'[\s\S]*stock_quantity: 0[\s\S]*hide_from_catalog: 1/, 'verified legacy products must be neutralized without deleting history');
assert.doesNotMatch(source, /method:\s*'DELETE'/, 'legacy cleanup must not delete product history');

console.log('serialized legacy product cleanup static checks passed');
