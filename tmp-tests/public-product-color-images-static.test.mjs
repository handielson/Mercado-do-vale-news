import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
assert.match(page, /modelColorImagesService/, 'public product page must load color-specific model images');
assert.match(page, /colorService/, 'public product page must resolve color names to color ids');
assert.match(page, /resolveModelColorImagesForProduct/, 'public product page must have a color-image resolver');
assert.match(
  page,
  /const\s+handleVariantChange\s*=\s*async/,
  'variant change must be async so it can load the selected color gallery',
);
assert.match(
  page,
  /setSelectedImage\(.*resolvedImages\[0\]/s,
  'public page must select the resolved color-specific image when available',
);
