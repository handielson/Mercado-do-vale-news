import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listPage = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
const productList = readFileSync('components/products/ProductList.tsx', 'utf8');
const productCard = readFileSync('components/products/ProductCard.tsx', 'utf8');
const bulk = readFileSync('pages/admin/settings/components/TikTokShopBulkPreparation.tsx', 'utf8');
const service = readFileSync('services/tiktokShopService.ts', 'utf8');

assert.match(
  listPage,
  /products\.flatMap\(\(product\) => \[product\.id, product\.parent_id\]/,
  'the products page must request TikTok links for visible variations and their parents',
);
assert.match(
  productList,
  /tiktokProductLinks\[product\.id\][\s\S]*product\.parent_id \? tiktokProductLinks\[product\.parent_id\]/,
  'a variation card must inherit the TikTok link stored on its parent product',
);
assert.match(
  productCard,
  /productId=\{currentTikTokProductLink\?\.product_id \|\| product\.id\}/,
  'clicking a variation with an inherited TikTok link must open the linked parent instead of creating a duplicate child draft',
);
assert.match(
  productCard,
  /Variacao incluida no anuncio do produto pai/,
  'the product card must explain when its TikTok state belongs to the grouped parent listing',
);
assert.match(
  bulk,
  /notifyTikTokProductLinksUpdated\(completed\)/,
  'bulk draft creation must notify other product pages after persisting links',
);
assert.match(
  bulk,
  /notifyTikTokProductLinksUpdated\(publishedLinks\.map\(\(link\) => link\.product_id\)\)/,
  'bulk publication must notify other product pages after status changes',
);
assert.match(
  service,
  /localStorage\.setItem\(TIKTOK_PRODUCT_LINKS_UPDATED_STORAGE_KEY/,
  'bulk link notifications must cross browser tabs',
);
assert.match(
  service,
  /for \(let index = 0; index < ids\.length; index \+= 100\)/,
  'TikTok link loading must include catalogs larger than one API batch',
);
assert.match(
  listPage,
  /window\.addEventListener\('storage', handleStorage\)/,
  'an already-open products tab must refresh when a bulk operation finishes',
);
assert.match(
  listPage,
  /onClick=\{handleRefresh\}/,
  'the manual refresh action must also reload TikTok product links',
);

console.log('TikTok Shop bulk-to-product-list refresh checks passed');
