import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const files = ['vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function readBlingPayloadStockForWebhookDetailsVps\(/,
    `${file} should keep stock payload metadata so explicit zero totals are distinguishable`
  );

  assert.match(
    source,
    /body\?\.data\?\.saldoFisicoTotal[\s\S]*explicitTotal:\s*true/,
    `${file} should treat Bling webhook saldoFisicoTotal as an explicit total`
  );

  assert.match(
    source,
    /payloadQty === 0 && !payloadStock\.hasExplicitTotal/,
    `${file} should refuse zero fallback only when the payload did not include an explicit stock total`
  );

  assert.match(
    source,
    /readBlingPayloadStockForWebhookDetailsVps\(productData, body\)\.value/,
    `${file} should preserve the old stock payload reader return value`
  );
}

console.log('Bling webhook explicit zero stock guard static test passed');
