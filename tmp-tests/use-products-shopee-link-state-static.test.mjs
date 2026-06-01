import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('hooks/useProducts.ts', 'utf8');

assert.match(
  source,
  /import \{ shopeeProductService \} from '\.\.\/services\/shopeeProducts';/,
  'useProducts should read Shopee link metadata through the VPS service'
);

assert.match(
  source,
  /async function enrichProductsWithShopeeLinks\(products: Product\[\]\): Promise<Product\[\]>/,
  'admin product hook should enrich VPS products with Shopee link metadata'
);

assert.match(
  source,
  /shopeeProductService\.getItemIdByProductIdMap\(\)/,
  'admin product hook should read product_id and shopee_item_id from the VPS service'
);

assert.doesNotMatch(
  source,
  /from\('shopee_products'\)/,
  'admin product hook must not read shopee_products directly from Supabase'
);

assert.match(
  source,
  /shopee_item_id: shopeeItemByProductId\.get\(String\(product\.id\)\) \?\? product\.shopee_item_id/,
  'Shopee link metadata should complete mapped VPS products before they reach ProductCard'
);

assert.match(
  source,
  /data = await enrichProductsWithShopeeLinks\(vpsData\.map\(mapVpsProduct\)\);/,
  'initial admin product load should enrich VPS rows before setting state and cache'
);

assert.match(
  source,
  /const remoteProducts = await enrichProductsWithShopeeLinks\(\[\.\.\.\(searchRows \|\| \[\]\), \.\.\.\(skuRows \|\| \[\]\)\]\.map\(mapVpsProduct\)\);/,
  'search enrichment should also preserve lit Shopee state for newly merged products'
);

console.log('useProducts Shopee link state static checks passed');
