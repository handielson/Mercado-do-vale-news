import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['../vps_server.cjs', '../vps_server.js', '../server.js']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');

  assert.match(source, /function safeShopeeStockFromBlingTargetVps/, `${file} must clamp Shopee stock quantities`);
  assert.match(source, /return Math\.trunc\(parsed\)/, `${file} must send integer stock to Shopee`);
  assert.match(source, /function groupShopeeStockTargetsByItemVps/, `${file} must group linked Shopee models by item`);
  assert.match(source, /seller_stock:\s*\[\{\s*stock:\s*safeShopeeStockFromBlingTargetVps/, `${file} must use Shopee seller_stock payload`);
  assert.match(source, /SELECT product_id, shopee_item_id, shopee_model_id[\s\S]*FROM shopee_products/, `${file} must load Shopee links`);
  assert.match(source, /shopeeCatalogPostVps\('\/api\/v2\/product\/update_stock'/, `${file} must call Shopee update_stock`);
  assert.match(source, /markShopeeStockLinksSyncedFromBlingVps/, `${file} must mark successful link syncs`);
  assert.doesNotMatch(source, /vps_webhook_local_shopee_sync_pending/, `${file} must not leave Shopee sync pending`);
}

console.log('bling shopee stock sync tests passed');
