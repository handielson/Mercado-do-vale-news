import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('hooks/useProducts.ts', 'utf8');

assert.match(
  source,
  /import \{ supabase \} from '\.\.\/services\/supabase';/,
  'useProducts should be able to read Shopee link metadata directly'
);

assert.match(
  source,
  /async function enrichProductsWithShopeeLinks\(products: Product\[\]\): Promise<Product\[\]>/,
  'admin product hook should enrich VPS products with Shopee link metadata'
);

assert.match(
  source,
  /from\('shopee_products'\)[\s\S]*select\('product_id,\s*shopee_item_id'\)/,
  'admin product hook should read product_id and shopee_item_id from shopee_products'
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
