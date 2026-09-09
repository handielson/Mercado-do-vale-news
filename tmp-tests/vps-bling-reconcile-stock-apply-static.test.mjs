import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  const patchHelper = source.match(/async function patchVpsForReconcileVps[\s\S]*?\n}/)?.[0] || '';
  const applyHelper = source.match(/async function applyReconcileStockChangesVps[\s\S]*?\n}/)?.[0] || '';

  assert.match(
    patchHelper,
    /http:\/\/127\.0\.0\.1:\$\{Number\(process\.env\.PORT\) \|\| 4000}/,
    `${file} must send reconcile stock updates directly to the local VPS API`,
  );
  assert.doesNotMatch(
    applyHelper,
    /vpsDbPatch\('products'/,
    `${file} must not bypass the canonical /products/stock stock-location synchronization`,
  );
  assert.match(
    applyHelper,
    /if \(!vpsUpdated\) throw new Error\('VPS stock endpoint rejected reconcile update'\)/,
    `${file} must report a failed canonical stock update instead of counting it as applied`,
  );
}

console.log('vps Bling reconcile stock apply static ok');
