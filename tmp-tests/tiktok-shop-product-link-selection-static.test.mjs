import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const preparation = readFileSync(
  new URL('../pages/admin/settings/components/TikTokShopProductPreparation.tsx', import.meta.url),
  'utf8',
);
const page = readFileSync(
  new URL('../pages/admin/settings/TikTokShopPage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  preparation,
  /clearTikTokProductLink\(\);[\s\S]*selectedProduct\?\.id/,
  'Changing the selected product must clear the previous TikTok link immediately',
);
assert.match(
  page,
  /useState\(\(\) => new URLSearchParams\(window\.location\.search\)\.get\('product_id'\)\)/,
  'The deep-linked product must be captured only once during the current page load',
);
assert.match(
  page,
  /cleanUrl\.searchParams\.delete\('product_id'\)/,
  'The consumed product parameter must be removed from the address bar',
);
assert.match(
  page,
  /window\.history\.replaceState/,
  'Removing the consumed product parameter must not reload the page',
);
assert.match(
  preparation,
  /getProductLinks\(\[productId\]\)/,
  'The TikTok link lookup must use the currently selected product',
);
assert.match(
  preparation,
  /getProductStatus\(productId\)/,
  'The remote status lookup must use the currently selected product',
);
assert.match(
  preparation,
  /if \(!cancelled\) applyTikTokProductLink\(current\)/,
  'A stale status response must not overwrite the new product selection',
);

console.log('TikTok Shop selected product link checks passed');
