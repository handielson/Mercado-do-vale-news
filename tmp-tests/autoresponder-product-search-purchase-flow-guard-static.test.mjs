import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('async function handleAutoresponderEngineProductSearchFlowV2');
  const end = source.indexOf('function buildAutoresponderEnginePurchaseFlowPatch', start);
  assert.ok(start > -1 && end > start, `${file} must define handleAutoresponderEngineProductSearchFlowV2 before purchase patch builder`);
  const block = source.slice(start, end);
  assert.ok(
    block.includes("state.flow !== 'product_search' && String(currentPurchaseFlow?.status || 'idle') !== 'idle'"),
    `${file} product-search V2 must not intercept an active legacy purchase_flow status`
  );
}

console.log('autoresponder product search purchase-flow guard static checks passed');
