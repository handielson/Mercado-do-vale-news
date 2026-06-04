import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverPaths = [
  path.join(root, 'server.js'),
  path.join(root, 'vps_server.js'),
  path.join(root, 'vps_server.cjs'),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const serverPath of serverPaths) {
  const source = fs.readFileSync(serverPath, 'utf8');
  const filename = path.basename(serverPath);
  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  const purchaseFlowLoad = source.indexOf('const purchaseFlow = await getAutoresponderPurchaseFlow(senderKey);', webhookStart);
  const activeFlowFlag = source.indexOf('const hasActivePurchaseFlow = hasAutoresponderCartItems(purchaseFlow);', webhookStart);
  const replyCountCheck = source.indexOf('const recentReplyCount = await getAutoresponderReplyCount(senderKey, replyWindowHours);', webhookStart);
  const limitGuard = source.indexOf('if (!hasActivePurchaseFlow && !detectedIntent.storeStatusRequest && recentReplyCount >= replyLimit)', webhookStart);
  const cepBranch = source.indexOf("purchaseFlow.status === 'awaiting_delivery_address'", webhookStart);

  assert(webhookStart >= 0, `${filename} must expose autoresponder webhook`);
  assert(purchaseFlowLoad > webhookStart, `${filename} must load purchase flow in webhook`);
  assert(activeFlowFlag > purchaseFlowLoad, `${filename} must derive active purchase flow before reply limit`);
  assert(replyCountCheck > activeFlowFlag, `${filename} must check reply limit after purchase flow is known`);
  assert(limitGuard > replyCountCheck, `${filename} reply limit must not silence active purchase flow or store status questions`);
  assert(cepBranch > limitGuard, `${filename} CEP branch must remain after the guarded reply limit`);
}

console.log('autoresponder purchase flow reply limit static checks passed');
