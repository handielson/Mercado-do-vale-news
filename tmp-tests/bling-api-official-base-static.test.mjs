import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeFiles = [
  'vps_server.js',
  'vps_server.cjs',
  'services/blingService.ts',
];

for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /https:\/\/www\.bling\.com\.br\/Api\/v3/,
    `${file} must not call the discontinued Bling API host`,
  );
  assert.match(
    source,
    /https:\/\/api\.bling\.com\.br\/Api\/v3/,
    `${file} must use the official Bling API v3 host`,
  );
}

console.log('Bling official API base regression checks passed');
