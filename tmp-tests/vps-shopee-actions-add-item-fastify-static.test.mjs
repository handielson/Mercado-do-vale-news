import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /case 'add_item'/, `${file} must support Shopee actions add_item`);
  assert.match(source, /function stripShopeeActionsHtmlVps/, `${file} must strip HTML before creating Shopee item descriptions`);
  assert.match(source, /async function resolveShopeeActionsImageInputVps/, `${file} must resolve image data URLs and remote images`);
  assert.match(source, /async function shopeeCatalogMultipartVps/, `${file} must support Shopee multipart image upload`);
  assert.match(source, /async function uploadShopeeActionsProductImagesVps/, `${file} must upload product images before add_item`);
  assert.match(source, /async function assertShopeeActionsProductNotLinkedVps/, `${file} must block duplicate Shopee links before add_item`);
  assert.match(source, /async function persistShopeeActionsItemLinkVps/, `${file} must persist Shopee item id back to VPS`);

  assert.ok(source.includes('/api/v2/media_space/upload_image'), `${file} must call Shopee upload_image endpoint`);
  assert.ok(source.includes('/api/v2/product/add_item'), `${file} must call Shopee add_item endpoint`);
  assert.match(source, /product_id n(?:ÃƒÂ£|Ã£|ã)o fornecido/, `${file} must validate missing product_id`);
  assert.match(source, /Produto j(?:ÃƒÂ¡|Ã¡|á) vinculado/, `${file} must reject already linked products`);
  assert.match(source, /category_id:\s*Number\(payload\.category_id \|\| product\.shopee_category_id \|\| 100013\)/, `${file} must keep category fallback`);
  assert.match(source, /original_price:\s*Number\(product\.price_retail \|\| 0\) \/ 100/, `${file} must convert retail price cents for Shopee`);
  assert.match(source, /normal_stock:\s*product\.track_inventory \? Number\(product\.stock_quantity \|\| 0\) : 999/, `${file} must preserve inventory fallback`);
  assert.match(source, /shopee_item_id: shopeeItemId/, `${file} must persist shopee_item_id`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-actions',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in actions debug payloads`);
  }
}

console.log('vps Shopee actions add_item Fastify static checks ok');
