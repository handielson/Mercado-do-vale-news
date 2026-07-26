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
  /\/admin\/settings\/tiktok-shop\?product_id=/,
  'TikTok shortcut must include the selected local product',
);
assert.match(card, /isTikTokSynced/, 'product card must render a linked visual state');
assert.match(card, /bg-emerald-400 ring-2 ring-white/, 'linked TikTok icon must show a confirmation dot');

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const preparation = readFileSync(
  'pages/admin/settings/components/TikTokShopProductPreparation.tsx',
  'utf8',
);
assert.match(page, /get\('product_id'\)/, 'TikTok page must read the selected product from the URL');
assert.match(page, /initialProductId=\{initialProductId\}/, 'TikTok page must forward the selected product');
assert.match(
  preparation,
  /productService\.getById\(initialProductId\)/,
  'TikTok preparation must hydrate the selected product',
);

console.log('TikTok Shop product shortcut static checks ok');
