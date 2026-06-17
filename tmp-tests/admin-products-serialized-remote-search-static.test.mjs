import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('hooks/useProducts.ts', 'utf8');

assert.match(
  source,
  /unitService\.searchByIdentifier\(term\)/,
  'admin product search should query serialized units by IMEI/serial',
);

assert.match(
  source,
  /vpsApiService\.getProductsByIds\(/,
  'admin product search should hydrate products found through unit identifiers',
);

console.log('admin products serialized remote search static ok');
