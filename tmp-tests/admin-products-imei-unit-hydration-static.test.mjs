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

console.log('admin products IMEI unit hydration static ok');
