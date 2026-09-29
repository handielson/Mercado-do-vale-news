import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('components/products/ProductCard.tsx', 'utf8');
const familyList = readFileSync('components/products/ProductFamilyList.tsx', 'utf8');
const channels = readFileSync('components/products/ProductPublicationChannels.tsx', 'utf8');
const products = readFileSync('services/products.ts', 'utf8');

assert.match(card, /ShopeeStoreBadges/, 'product cards must render account badges');
assert.match(card, /Shopee Mercado do Vale/, 'the official Mercado do Vale store must use M');
assert.match(card, /code === 'G'/, 'the Glaucia store must use G');
assert.match(familyList, /shopeeM[\s\S]*shopeeG/, 'family rows must distinguish both Shopee stores');
assert.match(channels, /Shopee M[\s\S]*Shopee G/, 'publication details must distinguish both Shopee stores');
assert.match(products, /getStoreCodesByProductIdMap/, 'product loading must include store badges from Shopee links');

console.log('Shopee product store badge static checks passed');
