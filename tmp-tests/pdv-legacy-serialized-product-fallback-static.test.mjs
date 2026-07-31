import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const search = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');
const inventory = readFileSync('services/pdvSerializedInventory.ts', 'utf8');
const sale = readFileSync('services/saleService.ts', 'utf8');

assert.match(search, /unitService\.searchByIdentifier\(query\)/, 'IMEI search must query real unit rows');
assert.match(search, /unit\.status !== UnitStatus\.AVAILABLE/, 'IMEI search must reject sold or reserved units');
assert.match(search, /buildPdvUnitOption\(unit\)/, 'IMEI search must add the real unit id to the cart');
assert.match(inventory, /units\.length === 0 \? buildLegacyProductUnitOption/, 'legacy specs are allowed only before any unit history exists');
assert.match(inventory, /if \(groupHasUnitHistory\) return \[\]/, 'a migrated product with no available unit must disappear from sale search');
assert.match(sale, /hasIdentifier && !serialized\?\.unitId/, 'finalization must reject legacy identifiers that have no real unit id');

console.log('PDV serialized legacy safety checks passed');
