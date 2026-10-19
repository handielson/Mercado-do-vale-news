import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const shareBlock = page.slice(page.indexOf('const getShareText'), page.indexOf('const handleShareInstagram'));

assert.match(shareBlock, /generateProductShareMessage\(/, 'PDP must reuse the catalog sharing formatter');
assert.match(shareBlock, /selectedVariantId,/, 'sharing must respect the selected variation');
assert.match(shareBlock, /variants: sellableVariantOptions/, 'family sharing must use the sellable variation pool');
assert.match(shareBlock, /getPublicProductVariantRouteTarget\(item, variantPool\)/, 'each shared configuration must link to its own unambiguous public route');
assert.match(shareBlock, /getEffectivePrice\(item, customer\)/, 'family prices must use the current customer context');
assert.doesNotMatch(shareBlock, /toFixed\(|variantNames/, 'PDP must not concatenate all variations under a single price');
assert.match(shareBlock, /www\.mercadodovale\.com\.br\/produto\//, 'sharing must use the canonical product URL');
assert.doesNotMatch(shareBlock, /window\.location\.href/, 'sharing must not expose the UUID from the browser URL');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /async function loadSeoProductImages\(product, baseUrl[,)]/, `${file} must resolve SEO images`);
  assert.match(source, /FROM model_color_images mci[\s\S]*INNER JOIN colors c/, `${file} must load the selected model/color image`);
  assert.match(source, /const publicImages = await loadSeoProductImages\(product, baseUrl\)/, `${file} must expose resolved images to Open Graph`);
}

console.log('product WhatsApp share regression contract: OK');
