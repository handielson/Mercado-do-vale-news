import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const deliveryStart = source.indexOf('async function handleAutoresponderEngineDeliveryFlowV2');
  assert.notEqual(deliveryStart, -1, `${file} must define handleAutoresponderEngineDeliveryFlowV2`);
  const deliveryBody = source.slice(deliveryStart, source.indexOf('function isAutoresponderEngineV2Enabled', deliveryStart));

  assert.ok(
    deliveryBody.includes("state.flow === 'purchase'") && deliveryBody.includes("state.step === 'awaiting_fulfillment'"),
    `${file} delivery engine must not steal purchase fulfillment replies`,
  );
  assert.ok(
    deliveryBody.includes("currentPurchaseFlow?.status === 'summary_ready'"),
    `${file} delivery engine must not steal legacy summary_ready fulfillment replies`,
  );
  assert.ok(
    deliveryBody.indexOf("state.flow === 'purchase'") < deliveryBody.indexOf('deliveryFlowHandler.canHandle'),
    `${file} purchase fulfillment guard must run before delivery canHandle`,
  );
}

console.log('autoresponder purchase fulfillment before delivery static checks passed');
