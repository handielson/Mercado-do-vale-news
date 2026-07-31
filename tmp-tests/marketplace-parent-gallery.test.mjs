import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMarketplaceParentGallery } from '../services/marketplaceParentGallery.js';

const shopeePage = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
assert.match(shopeePage, /buildMarketplaceParentGallery/, 'Shopee publishing must use the shared parent-gallery composer');
assert.match(shopeePage, /minimumCount:\s*3,\s*maxCount:\s*9/, 'Shopee must fill a parent listing to three photos without exceeding nine');

const parent = {
  images: ['https://cdn.test/parent.jpg', 'https://cdn.test/shared.jpg'],
};
const children = [
  { images: ['https://cdn.test/shared.jpg', 'https://cdn.test/red.jpg'] },
  { images: ['https://cdn.test/blue.jpg', 'https://cdn.test/green.jpg'] },
];

assert.deepEqual(
  buildMarketplaceParentGallery(parent, children, { minimumCount: 3, maxCount: 9 }),
  ['https://cdn.test/parent.jpg', 'https://cdn.test/shared.jpg', 'https://cdn.test/red.jpg'],
  'Shopee must preserve parent images and fill its three-photo target from children without duplicates'
);

assert.deepEqual(
  buildMarketplaceParentGallery({ images: [] }, children, { minimumCount: 3, maxCount: 9 }),
  ['https://cdn.test/shared.jpg', 'https://cdn.test/red.jpg', 'https://cdn.test/blue.jpg'],
  'A structural parent without photos must inherit enough child photos for the listing gallery'
);

const nineChildren = Array.from({ length: 12 }, (_, index) => ({
  images: [`https://cdn.test/child-${index + 1}.jpg`],
}));
assert.equal(
  buildMarketplaceParentGallery({ images: [] }, nineChildren, { minimumCount: 9, maxCount: 9 }).length,
  9,
  'TikTok gallery completion must stop at the official maximum of nine photos'
);

console.log('marketplace parent gallery tests passed');
