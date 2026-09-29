import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('components/products/ProductCard.tsx', 'utf8');
const familyList = readFileSync('components/products/ProductFamilyList.tsx', 'utf8');
const channels = readFileSync('components/products/ProductPublicationChannels.tsx', 'utf8');
const products = readFileSync('services/products.ts', 'utf8');
const legacyFormSection = readFileSync('components/products/sections/ShopeeLinkSection.tsx', 'utf8');

assert.match(card, /ShopeeStoreBadges/, 'product cards must render account badges');
assert.match(card, /Shopee Mercado do Vale/, 'the official Mercado do Vale store must use M');
assert.match(card, /code === 'G'/, 'the Glaucia store must use G');
assert.match(card, /Escolha a loja Shopee/, 'product card publishing must require an explicit store choice');
assert.match(card, /getItemIdByProductId\(product\.id, connectionId\)/, 'product card must look up links in the selected store');
assert.match(card, /withShopeeConnection[\s\S]*get_item_base_info/, 'product card must validate the item with the selected store credentials');
assert.match(card, /deleteByProductId\(product\.id, connectionId\)/, 'stale-link cleanup must affect only the selected store');
assert.match(card, /connectionId=\{selectedShopeeConnectionId\}/, 'product card publish modal must receive the selected store');
assert.match(familyList, /shopeeM[\s\S]*shopeeG/, 'family rows must distinguish both Shopee stores');
assert.match(channels, /Shopee M[\s\S]*Shopee G/, 'publication details must distinguish both Shopee stores');
assert.match(products, /getStoreCodesByProductIdMap/, 'product loading must include store badges from Shopee links');
assert.match(legacyFormSection, /Escolher loja M\/G e publicar/, 'the legacy product form must route publishing through an explicit M/G choice');
assert.doesNotMatch(legacyFormSection, /action:\s*['"]add_item['"]/, 'the legacy form must not silently publish to the primary account');

console.log('Shopee product store badge static checks passed');
