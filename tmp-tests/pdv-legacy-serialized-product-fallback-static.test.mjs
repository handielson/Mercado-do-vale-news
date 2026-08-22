import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const search = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');
const inventory = readFileSync('services/pdvSerializedInventory.ts', 'utf8');
const sale = readFileSync('services/saleService.ts', 'utf8');

assert.match(search, /unitService\.searchByIdentifier\(query\)/, 'IMEI search must query real unit rows');
assert.match(search, /unit\.status !== UnitStatus\.AVAILABLE/, 'IMEI search must reject sold or reserved units');
assert.match(search, /buildPdvUnitOption\(unit\)/, 'IMEI search must add the real unit id to the cart');
assert.doesNotMatch(inventory, /legacy-unit:/, 'PDV must never manufacture a selectable fake unit from product specs');
assert.match(inventory, /hasLegacySerializedIdentifier/, 'legacy identifiers must be detected and blocked until migration');
assert.match(inventory, /if \(groupHasUnitHistory\) return \[\]/, 'a migrated product with no available unit must disappear from sale search');
assert.match(sale, /hasIdentifier && !serialized\?\.unitId/, 'finalization must reject legacy identifiers that have no real unit id');

console.log('PDV serialized legacy safety checks passed');
