import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const legacyMarkers = [
  "intent: 'purchase_product_selected'",
  "intent: 'catalog_category'",
  "intent: 'product_search_priority'",
  "intent: 'greeting_catalog_category'",
  "intent: 'contact_name'",
  "intent: 'store_status'",
  "intent: 'greeting'",
  'const humanReplyText = isAutoresponderStoreInHumanHours(storeStatus)',
  'const matchedRule = await findAutoresponderRuleMatch(message);',
  'const productTagMatch = findAutoresponderProductTagKeyword(message, settings);',
];

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  assert(webhookStart >= 0, `${file}: live autoresponder webhook not found`);

  const webhook = source.slice(webhookStart);
  const aiFirstIndex = webhook.indexOf('const aiFirst = await buildAutoresponderAiFirstReply({ message, contactFirstName, settings, sender: senderKey });');
  assert(aiFirstIndex >= 0, `${file}: live webhook must call AI first`);

  for (const marker of legacyMarkers) {
    const markerIndex = webhook.indexOf(marker);
    assert(markerIndex >= 0, `${file}: expected legacy marker not found for order check: ${marker}`);
    assert(
      aiFirstIndex < markerIndex,
      `${file}: legacy autoresponder branch must not answer before AI: ${marker}`
    );
  }
}

console.log('Live autoresponder webhook routes AI before legacy branches.');
