import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.js', 'utf8');

assert.match(
  source,
  /function getAutoresponderCategoryProductFetchLimit\(pageSize\)/,
  'server must fetch extra category rows before grouping so pageSize means distinct model groups, not raw SKUs'
);

assert.match(
  source,
  /function limitAutoresponderProductsByModelGroups\(products, groupLimit\)/,
  'server must trim category replies by distinct model groups after fetching raw SKU rows'
);

assert.doesNotMatch(
  source,
  /findAutoresponderProductsByCategory\(selectedCategory\.id,\s*pageSize\s*\+\s*1\)/,
  'category catalog replies must not limit raw product rows to pageSize + 1 before model grouping'
);

assert.match(
  source,
  /completeList:\s*isAutoresponderCompleteProductListKeyword\(message\)\s*\|\|\s*isAutoresponderCompleteProductListKeyword\(effectiveCategory\.name\)/,
  'category catalog replies must detect "lista completa" from the customer message, not only the category name'
);

assert.match(
  source,
  /const categorySearchText = String\(message \|\| effectiveCategory\.name \|\| ''\)\.trim\(\);[\s\S]*?getAutoresponderInitialProductPageSize\(categorySearchText\)/,
  'category catalog page size must use text derived from the customer message so "lista completa de celulares" expands the list'
);


assert.match(
  source,
  /async function resolveAutoresponderEffectiveCatalogCategory\(category\)/,
  'server must normalize phone-like catalog categories to the effective Smartphones category before sending products'
);

assert.match(
  source,
  /const effectiveCategory = await resolveAutoresponderEffectiveCatalogCategory\(selectedCategory\);[\s\S]*?if \(!effectiveCategory\?\.id\) return null;/,
  'category catalog replies must use the effective Smartphones category even when the input category is Celulares'
);

assert.doesNotMatch(
  source,
  /formatAutoresponderProductSearchReplies\(products, selectedCategory\.name/,
  'category catalog replies must not send the empty/display category name after normalization; use effectiveCategory.name'
);
console.log('autoresponder complete phone list distinct models static checks passed');

