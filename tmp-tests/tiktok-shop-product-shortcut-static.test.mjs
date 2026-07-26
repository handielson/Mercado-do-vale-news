import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['server.js', 'vps_server.js', 'vps_server.cjs'];

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS tiktok_shop_products/,
    `${file} must persist TikTok product links separately`,
  );
  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS tiktok_shop_category_mappings/,
    `${file} must persist local-to-TikTok category mappings`,
  );
  assert.match(
    source,
    /fastify\.put\('\/tiktok-shop\/catalog\/category-mappings\/:localCategoryId', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose the protected proxy-safe category mapping write`,
  );
  assert.match(
    source,
    /fastify\.get\('\/api\/tiktok-shop\/products\/links', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must protect the API product links route`,
  );
  assert.match(
    source,
    /fastify\.get\('\/tiktok-shop\/products\/links', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose the proxy-safe product links route`,
  );
  assert.match(
    source,
    /AND COALESCE\(status, ''\) <> 'DELETED'/,
    `${file} must not light deleted TikTok links`,
  );
}

const service = readFileSync('services/tiktokShopService.ts', 'utf8');
assert.match(service, /getProductLinks\(productIds: string\[\]\)/, 'frontend service must read TikTok links in bulk');
assert.match(service, /getCategoryMapping\(localCategoryId: string\)/, 'frontend service must read category mappings');
assert.match(service, /saveCategoryMapping\(input:/, 'frontend service must persist confirmed category mappings');
assert.doesNotMatch(
  service,
  /['"]\/api\/tiktok-shop\/products\/links/,
  'frontend service must use the proxy-safe product links path',
);

const listPage = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
assert.match(listPage, /tiktokShopService\.getProductLinks\(productIds\)/, 'product list must load TikTok links');
assert.match(listPage, /tiktokProductLinks=\{tiktokProductLinks\}/, 'product list must pass link state to cards');
assert.match(
  listPage,
  /\}, \[visibleProductIdsKey\]\);/,
  'TikTok link loading must depend on stable product ids instead of the paginated array identity',
);

const card = readFileSync('components/products/ProductCard.tsx', 'utf8');
assert.match(card, /Enviar para o TikTok Shop/, 'product card must expose the TikTok shortcut');
assert.match(
  card,
  /setIsTikTokModalOpen\(true\)/,
  'TikTok shortcut must open synchronization in the product card',
);
assert.match(card, /isTikTokSynced/, 'product card must render a linked visual state');
assert.match(card, /bg-emerald-400 ring-2 ring-white/, 'linked TikTok icon must show a confirmation dot');
assert.match(card, /TikTokShopSyncModal/, 'product card must render the TikTok synchronization modal');

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const preparation = readFileSync(
  'pages/admin/settings/components/TikTokShopProductPreparation.tsx',
  'utf8',
);
const modal = readFileSync(
  'pages/admin/settings/components/TikTokShopSyncModal.tsx',
  'utf8',
);
assert.match(page, /get\('product_id'\)/, 'TikTok page must read the selected product from the URL');
assert.match(page, /initialProductId=\{initialProductId\}/, 'TikTok page must forward the selected product');
assert.match(
  preparation,
  /productService\.getById\(initialProductId\)/,
  'TikTok preparation must hydrate the selected product',
);
assert.match(
  preparation,
  /tiktokShopService\.getCategoryMapping\(localCategoryId\)/,
  'TikTok preparation must reuse a saved category mapping',
);
assert.match(
  preparation,
  /normalizeCategoryName\(category\.name\) === normalizedLocalName/,
  'TikTok preparation must only auto-confirm an exact normalized category name',
);
assert.match(
  preparation,
  /tiktokShopService\.saveCategoryMapping/,
  'TikTok preparation must persist the category after confirmation',
);
assert.match(modal, /role="dialog"/, 'TikTok synchronization must open as a dialog');
assert.match(modal, /initialProductId=\{productId\}/, 'TikTok modal must load the clicked product');

console.log('TikTok Shop product shortcut static checks ok');
