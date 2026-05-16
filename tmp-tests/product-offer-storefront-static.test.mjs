import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalogService = fs.readFileSync('services/catalogService.ts', 'utf8');
const catalogConfigService = fs.readFileSync('services/catalogConfigService.ts', 'utf8');
const publicProductPage = fs.readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const modernCard = fs.readFileSync('components/catalog/ModernProductCard.tsx', 'utf8');

assert.match(catalogService, /removeHiddenOffers/);
assert.match(catalogService, /offer_visibility !== 'hidden'/);
assert.match(catalogConfigService, /product\.offer_type && product\.offer_visibility === 'hidden'/);
assert.match(publicProductPage, /data\.offer_type && data\.offer_visibility === 'hidden'/);
assert.match(modernCard, /isOfferProduct/);
assert.match(modernCard, /offerBadgeLabel/);

console.log('product offer storefront static checks passed');
