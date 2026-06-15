import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const carousel = readFileSync('components/catalog/BannerCarousel.tsx', 'utf8');
assert.match(carousel, /function\s+getBannerProductHref/, 'banner carousel must normalize product links');
assert.match(carousel, /\/produto\//, 'product banner links must route to /produto/:id-or-slug');
assert.match(carousel, /object-contain/, 'public banner images must use object-contain to avoid side cropping');
assert.match(
  carousel,
  /window\.location\.href\s*=\s*getBannerProductHref\(destination\)/,
  'product banner click must use normalized product href',
);

const form = readFileSync('components/admin/BannerForm.tsx', 'utf8');
assert.match(form, /object-contain/, 'admin banner previews must use object-contain');
assert.match(form, /Link,\s*ID ou slug do produto/, 'banner form must accept product link, id, or slug');

const service = readFileSync('services/bannerService.ts', 'utf8');
assert.match(service, /inferBannerLinkType/, 'banner service must infer link type from stored URLs');
assert.match(service, /\/produto\//, 'banner service must recognize full product URLs as product links');
