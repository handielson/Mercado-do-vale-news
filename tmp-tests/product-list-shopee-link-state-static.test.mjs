import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/products.ts', 'utf8');

assert.match(
  source,
  /async function enrichProductsWithShopeeLinks\(rows: any\[\]\): Promise<any\[\]>/,
  'products service should enrich VPS rows with Shopee link metadata'
);

assert.match(
  source,
  /shopeeProductService\.getItemIdByProductIdMap\(\)/,
  'product list should read product_id and shopee_item_id through the VPS service'
);

assert.doesNotMatch(
  source,
  /from\('shopee_products'\)/,
  'product list must not read shopee_products directly from Supabase'
);

assert.match(
  source,
  /const shopeeItemByProductId = await shopeeProductService\.getItemIdByProductIdMap\(\)/,
  'product list should get Shopee item ids indexed by product id from the VPS service'
);

assert.match(
  source,
  /shopee_item_id: shopeeItemByProductId\.get\(String\(row\.id\)\) \?\? row\.shopee_item_id/,
  'Shopee link metadata should override/complete VPS product rows'
);

assert.match(
  source,
  /const enrichedRows = await enrichProductsWithShopeeLinks\(rows\);[\s\S]*return enrichedRows\.map\(transformFromDB\)/,
  'list() should transform enriched rows so ProductCard receives shopee_item_id'
);

console.log('product list shopee link state static checks passed');
