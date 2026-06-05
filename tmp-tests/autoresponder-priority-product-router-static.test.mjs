import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /async function buildAutoresponderPriorityProductSearchReplyData/,
    `${file} must centralize priority product/model replies`
  );

  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  const priorityProduct = source.indexOf('const priorityProductReply = await buildAutoresponderPriorityProductSearchReplyData', webhookStart);
  const delivery = source.indexOf('const engineDeliveryReply = await handleAutoresponderEngineDeliveryFlowV2', webhookStart);
  const contactFlow = source.indexOf('handleAutoresponderContactNameFlow', webhookStart);

  assert.ok(
    webhookStart >= 0 &&
      priorityProduct > webhookStart &&
      priorityProduct < delivery &&
      priorityProduct < contactFlow,
    `${file} must answer product/model requests before delivery engine and contact-name flows`
  );

  assert.match(
    source,
    /intent: 'product_search_priority'/,
    `${file} must log priority product replies distinctly`
  );
}

console.log('autoresponder priority product router static checks passed');
