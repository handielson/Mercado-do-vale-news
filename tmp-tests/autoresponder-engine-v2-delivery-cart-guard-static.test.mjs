import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('async function handleAutoresponderEngineDeliveryFlowV2');
  const end = source.indexOf('function isAutoresponderEngineV2Enabled', start);
  assert.ok(start > -1 && end > start, `${file} must define handleAutoresponderEngineDeliveryFlowV2 before the rollout gate`);
  const block = source.slice(start, end);
  assert.ok(
    block.includes('if (hasAutoresponderCartItems(currentPurchaseFlow)) return null;'),
    `${file} delivery engine v2 must not intercept an active cart`
  );
}

console.log('autoresponder engine v2 delivery cart guard static checks passed');
