import assert from 'node:assert/strict';
import {
  buildResponsiveImageSources,
  deriveImageVariantUrl,
} from '../utils/responsive-image-sources.js';

const productUrl = 'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1.png?v=123';
const webpProductUrl = 'https://api.xiaomipetrolina.com.br/images/products/SKU/photo.webp';
const legacyProductUrl = 'https://api.xiaomipetrolina.com.br/images/legacy/external/external/e3771d34b703c814.png';
const legacyInlineProductUrl = 'https://api.xiaomipetrolina.com.br/images/legacy/inline/8ea8b186ab613115.jpg';

assert.equal(
  deriveImageVariantUrl(productUrl, 320, 'webp'),
  'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-320.webp?v=123',
);

const productSources = buildResponsiveImageSources(productUrl, { kind: 'product' });
assert.deepEqual(productSources, {
  avifSrcSet: [
    'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-320.avif?v=123 320w',
    'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-480.avif?v=123 480w',
    'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-800.avif?v=123 800w',
  ].join(', '),
  webpSrcSet: [
    'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-320.webp?v=123 320w',
    'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-480.webp?v=123 480w',
    'https://api.xiaomipetrolina.com.br/images/products/SKU/img-1-800.webp?v=123 800w',
  ].join(', '),
  sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 242px',
});

assert.equal(
  deriveImageVariantUrl(webpProductUrl, 320, 'webp'),
  'https://api.xiaomipetrolina.com.br/images/products/SKU/photo-320.webp',
  'existing WebP originals should still receive width-specific derivatives',
);

const legacyProductSources = buildResponsiveImageSources(legacyProductUrl, { kind: 'product' });
assert.match(
  legacyProductSources.webpSrcSet,
  /\/images\/legacy\/external\/external\/e3771d34b703c814-320\.webp 320w/,
  'legacy external images should use product derivative sources',
);

assert.equal(
  buildResponsiveImageSources(legacyInlineProductUrl, { kind: 'product' }),
  null,
  'legacy inline images do not have generated derivatives and should render through the original URL',
);

const bannerSources = buildResponsiveImageSources(
  'https://api.xiaomipetrolina.com.br/images/banners/home.png',
  { kind: 'banner' },
);
assert.match(bannerSources.avifSrcSet, /home-768\.avif 768w/);
assert.match(bannerSources.avifSrcSet, /home-1280\.avif 1280w/);

assert.equal(
  buildResponsiveImageSources('/api/bling?resource=image-proxy&url=x', { kind: 'product' }),
  null,
  'proxied Bling images do not have local derivatives yet',
);

assert.equal(
  buildResponsiveImageSources('data:image/svg+xml;base64,AAAA', { kind: 'product' }),
  null,
  'inline placeholders must not receive derivative sources',
);
