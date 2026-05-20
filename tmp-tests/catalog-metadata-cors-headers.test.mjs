import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/catalogMetadataService.ts', 'utf8');
const metadataFetchBlock = source.match(/fetch\(buildVpsUrl\(`\/catalog\/metadata\?_t=\$\{timestamp\}`\), \{[\s\S]*?\n\s*\}\);/);

assert.ok(metadataFetchBlock, 'catalog metadata fetch block should exist');
assert.ok(
  !metadataFetchBlock[0].includes('Cache-Control'),
  'catalog metadata request must not send Cache-Control header because VPS CORS does not allow it',
);
assert.ok(
  !metadataFetchBlock[0].includes('Pragma'),
  'catalog metadata request must not send Pragma header because it triggers a CORS preflight',
);
assert.ok(
  metadataFetchBlock[0].includes("headers: { Accept: 'application/json' }"),
  'catalog metadata request should keep only the simple Accept header',
);

console.log('ok');
