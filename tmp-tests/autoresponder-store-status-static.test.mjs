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

  assert(
    source.includes('function isAutoresponderStoreStatusRequest(message)'),
    `${filename} must detect store status questions`
  );
  assert(
    source.includes('storeStatusRequest: isAutoresponderStoreStatusRequest(message)'),
    `${filename} must include storeStatusRequest in detected intent`
  );
  assert(
    source.includes('function buildAutoresponderStoreStatusReply(storeStatus)'),
    `${filename} must build a native store status reply`
  );
  assert(
    source.includes("intent: 'store_status'"),
    `${filename} must return/log store_status intent`
  );

  const testReplyStoreStatus = source.indexOf('if (detectedIntent.storeStatusRequest)');
  const testReplyHuman = source.indexOf('if (detectedIntent.humanRequest)', testReplyStoreStatus);
  const testReplyRule = source.indexOf('const matchedRule = await findAutoresponderRuleMatch(message);', testReplyStoreStatus);
  assert(
    testReplyStoreStatus >= 0 && testReplyHuman > testReplyStoreStatus && testReplyRule > testReplyStoreStatus,
    `${filename} test reply must answer store status before human/rule/product fallback flow`
  );

  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  const webhookStoreStatus = source.indexOf('if (detectedIntent.storeStatusRequest)', webhookStart);
  const webhookPurchaseFlow = source.indexOf('const purchaseFlow = await getAutoresponderPurchaseFlow(senderKey);', webhookStart);
  const webhookRule = source.indexOf('const matchedRule = await findAutoresponderRuleMatch(message);', webhookStart);
  assert(
    webhookStart >= 0 && webhookStoreStatus > webhookStart && webhookStoreStatus < webhookPurchaseFlow && webhookStoreStatus < webhookRule,
    `${filename} webhook must answer store status before purchase/rule/product fallback flow`
  );
}

console.log('autoresponder store status static checks passed');
