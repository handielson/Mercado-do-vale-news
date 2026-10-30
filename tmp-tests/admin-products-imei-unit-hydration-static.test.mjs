import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('hooks/useProducts.ts', 'utf8');

assert.match(
  source,
  /const unitsByProductId = new Map/,
  'admin product search by IMEI must index matched serialized units by product id',
);

assert.match(
  source,
  /available_units:\s*\[[\s\S]*matchedUnits[\s\S]*\]/,
  'admin product search by IMEI must attach matched units to hydrated products so local filtering keeps the result',
);

assert.match(source, /setSearchDataRevision\(revision => revision \+ 1\)/,
  'refreshing the full catalog must invalidate an active IMEI lookup');
assert.match(source, /\[filters\.search, searchDataRevision\]/,
  'an active IMEI lookup must rerun after the full catalog replaces its hydrated rows');
assert.match(source, /setIsRemoteSearching\(term\.length >= 2\)/,
  'the UI must distinguish a pending remote identifier lookup from no match');

console.log('admin products IMEI unit hydration static ok');
