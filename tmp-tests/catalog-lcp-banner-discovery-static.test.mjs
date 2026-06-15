import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const scriptIndex = html.indexOf('<script type="module" src="/index.tsx"></script>');
const preloadIndex = html.indexOf('rel="preload"');
const shellImageIndex = html.indexOf('class="initial-banner-image"');

assert.notEqual(scriptIndex, -1, 'index.html should keep the Vite entry script');
assert.notEqual(preloadIndex, -1, 'index.html should preload the first public banner image');
assert.ok(
  preloadIndex < scriptIndex,
  'the public LCP banner preload should be discoverable before the app bundle',
);

assert.match(
  html,
  /href="https:\/\/api\.xiaomipetrolina\.com\.br\/images\/banners\/1774302661895-1280\.avif"/,
  'the current public LCP banner AVIF should be preloaded directly from the initial document',
);
assert.match(
  html,
  /imagesrcset="[^"]*1774302661895-768\.avif 768w[^"]*1774302661895-1280\.avif 1280w"/,
  'the LCP preload should expose a responsive AVIF srcset for mobile and desktop widths',
);
assert.match(
  html,
  /fetchpriority="high"/,
  'the LCP preload and initial image should keep high fetch priority',
);

assert.notEqual(
  shellImageIndex,
  -1,
  'the initial catalog shell should render the real first banner image instead of only a skeleton block',
);
assert.ok(
  shellImageIndex < scriptIndex,
  'the first banner image should be present before React hydrates the catalog',
);
assert.match(
  html,
  /<picture class="initial-banner-picture">[\s\S]*type="image\/avif"[\s\S]*type="image\/webp"[\s\S]*<img[\s\S]*class="initial-banner-image"/,
  'the initial banner should use AVIF/WebP sources with an image fallback',
);
