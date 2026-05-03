import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/catalog/ModernProductCard.tsx', 'utf8');

assert.match(
  source,
  /buildResponsiveImageSources/,
  'ModernProductCard should build AVIF/WebP sources for VPS product images',
);
assert.match(source, /<picture>/, 'card image should render through picture for typed sources');
assert.match(
  source,
  /setOptimizedImageFailed\(true\)/,
  'failed derivatives should fall back to the original image before using placeholder',
);
assert.match(source, /type="image\/avif"/, 'AVIF should be offered first');
assert.match(source, /type="image\/webp"/, 'WebP should be offered as fallback');
