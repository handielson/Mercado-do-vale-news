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
  /const \[shopeeItemByProductId, shopeeStoreCodesByProductId\] = await Promise\.all\(\[[\s\S]*shopeeProductService\.getItemIdByProductIdMap\(\)/,
  'product list should get Shopee item ids indexed by product id from the VPS service'
);

assert.match(
  source,
  /shopee_item_id: shopeeItemByProductId\.get\(String\(row\.id\)\) \?\? row\.shopee_item_id/,
  'Shopee link metadata should override/complete VPS product rows'
);

const hookSource = readFileSync('hooks/useProducts.ts', 'utf8');
const filtersSource = readFileSync('components/products/ProductFilters.tsx', 'utf8');
assert.match(
  hookSource,
  /shopeeProductService\.getStoreCodesByProductIdMap\(\)/,
  'admin product cards should load all Shopee store codes'
);
assert.match(
  hookSource,
  /shopee_store_codes: shopeeStoreCodesByProductId\.get\(String\(product\.id\)\) \|\| \[\]/,
  'admin product cards should receive M/G badge metadata'
);
assert.match(
  hookSource,
  /channel === 'shopee'[\s\S]*shopeeProductService\.getStoreCodesByProductIdMap\(\)/,
  'Shopee channel filter should include linked products from both stores'
);
assert.match(filtersSource, /shopeeStore: 'all' \| 'M' \| 'G'/, 'filters should expose the two Shopee stores');
assert.match(filtersSource, /aria-label="Loja Shopee"/, 'product filters should expose the Shopee store selector');
assert.match(filtersSource, /<option value="M">Mercado do Vale<\/option>/, 'Shopee M must be identified as Mercado do Vale');
assert.match(filtersSource, /<option value="G">Glaucia<\/option>/, 'Shopee G must be identified as Glaucia');
assert.doesNotMatch(filtersSource, /shopeeStore !== 'all' \? \{ salesChannel: 'shopee' as const, channelStatus: 'linked'/, 'selecting a Shopee store must not force only linked products');
assert.match(filtersSource, /Situação na loja/, 'a selected Shopee store should expose a clearly named store status filter');
assert.match(filtersSource, /Ainda não enviado/, 'store status should offer the not-yet-sent option');
assert.match(filtersSource, /grid grid-cols-1 gap-2\.5[\s\S]*xl:grid-cols-6/, 'product filters should use compact responsive cards');

assert.match(
  source,
  /const enrichedRows = await enrichProductsWithShopeeLinks\(rows\);[\s\S]*return enrichedRows\.map\(transformFromDB\)/,
  'list() should transform enriched rows so ProductCard receives shopee_item_id'
);

console.log('product list shopee link state static checks passed');
