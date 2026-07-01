import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /const attributeSearchValueName\s*=\s*query\.value_name\s*\|\|\s*query\.keyword\s*\|\|\s*''/,
    `${file} must accept value_name from the frontend and keyword from older clients.`
  );

  assert.match(
    source,
    /value_name:\s*attributeSearchValueName/,
    `${file} must forward searchable attribute text as Shopee value_name.`
  );
}

console.log('shopee searchable attribute backend param static checks passed');
