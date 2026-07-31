import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /async function recoverBlingWebhookStockTargetsVps[\s\S]*reconcileProductStockLocationsToTotal[\s\S]*getShopeeStockTargetsForProductIds/,
    `${file} must recover a failed webhook self-call by reconciling local totals and rebuilding marketplace targets`,
  );
  assert.match(
    source,
    /async function recoverBlingWebhookStockTargetsVps[\s\S]*isSerializedMatch[\s\S]*syncProductStock\(canonical\.id\)[\s\S]*resetProductStockLocationsToIncoming/,
    `${file} must preserve serialized stock semantics and the existing stock re-entry rule`,
  );
  assert.match(
    source,
    /async function syncTikTokStockFromBlingTargetsVps[\s\S]*\/product\/202309\/products\/\$\{encodeURIComponent\(remoteProductId\)\}\/inventory\/update/,
    `${file} must update TikTok inventory through the official v202309 endpoint`,
  );
  assert.match(
    source,
    /formatTikTokShopBusinessErrorsVps\(result\.payload\?\.data\?\.errors\)/,
    `${file} must treat TikTok business errors inside HTTP-success responses as failures`,
  );
  assert.match(
    source,
    /syncMarketplaceStockFromBlingTargetsVps[\s\S]*syncShopeeStockFromBlingTargetsVps[\s\S]*syncTikTokStockFromBlingTargetsVps/,
    `${file} must send every Bling stock change to both marketplaces`,
  );
  assert.match(
    source,
    /stockRecoveryApplied:[\s\S]*shopeeStockSync:[\s\S]*tiktokStockSync:/,
    `${file} must expose recovery and both marketplace outcomes in the webhook response`,
  );

  const stockEventSection = source.slice(
    source.indexOf('const isStockEvent ='),
    source.indexOf('const isProductEvent =', source.indexOf('const isStockEvent =')),
  );
  assert.match(
    stockEventSection,
    /selfCallResult[\s\S]*recoverBlingWebhookStockTargetsVps[\s\S]*syncMarketplaceStockFromBlingTargetsVps/,
    `${file} must recover the local update before synchronizing marketplaces`,
  );
  assert.doesNotMatch(
    stockEventSection,
    /await vpsDbPatch\('products'/,
    `${file} must not use the old partial direct-product fallback in stock events`,
  );
}

console.log('Bling marketplace stock fallback static checks passed');
