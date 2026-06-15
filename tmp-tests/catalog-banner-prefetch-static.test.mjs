import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('App.tsx', 'utf8');
const bannerService = readFileSync('services/bannerService.ts', 'utf8');

assert.match(
  bannerService,
  /activeBannersCache/,
  'bannerService should keep an in-flight/cache entry for public active banners',
);

assert.match(
  bannerService,
  /warmActiveBanners:\s*\(/,
  'bannerService should expose a warmActiveBanners helper for early catalog loads',
);

assert.match(
  bannerService,
  /return\s+cached\.promise/,
  'getActiveBanners should reuse an in-flight banner request instead of issuing a duplicate call',
);

assert.match(
  app,
  /import\s+\{\s*bannerService\s*\}\s+from\s+['"]\.\/services\/bannerService['"]/,
  'App should import bannerService to warm catalog banners before the lazy catalog route resolves',
);

assert.match(
  app,
  /isCatalogRouteFallback\(\)[\s\S]*bannerService\.warmActiveBanners\(\)/,
  'App should warm public catalog banners only for catalog landing routes',
);

console.log('catalog banner prefetch static checks passed');
