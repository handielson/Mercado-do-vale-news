import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  !/if\s*\(\s*dbVideoUrl\s*\)\s*\{\s*setVideoInfo\(\{\s*exists:\s*true,\s*url:\s*dbVideoUrl,\s*checking:\s*false\s*\}\)/s.test(source),
  'ProductCard must not trust product.video_url as existing without checking the CDN/Synology first.',
);

assert(
  source.includes('const isSynologyVideoUrl') &&
    source.includes('const getSkuFromSynologyVideoUrl') &&
    source.includes('checkVideoBySku(videoSku)'),
  'ProductCard should verify saved Synology video URLs through checkVideoBySku before showing Ver video.',
);

assert(
  source.includes('return { exists: false, url: null };'),
  'ProductCard should fall back to Enviar video when the saved Synology video URL is missing.',
);

console.log('product-card video_url verification static checks passed');
