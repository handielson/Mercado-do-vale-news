import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/catalog/BannerCarousel.tsx', 'utf8');

assert.match(
  source,
  /buildResponsiveImageSources/,
  'BannerCarousel should build AVIF/WebP sources for VPS banner images',
);
assert.match(source, /<picture>/, 'banner image should render through picture for typed sources');
assert.match(source, /type="image\/avif"/, 'banner should offer AVIF first');
assert.match(source, /type="image\/webp"/, 'banner should offer WebP as fallback');
assert.match(
  source,
  /kind:\s*'banner'/,
  'banner derivatives must use banner widths and sizes',
);
