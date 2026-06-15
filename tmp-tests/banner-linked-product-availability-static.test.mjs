import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/bannerService.ts', 'utf8');

assert.match(
  source,
  /import\s+\{\s*vpsApiService\s*\}\s+from\s+'\.\/vpsApiService'/,
  'bannerService must read linked product availability from the VPS API service',
);

assert.match(
  source,
  /filterBannersByLinkedProductAvailability/,
  'active banner filtering must include linked product availability',
);

assert.match(
  source,
  /vpsApiService\.getProductById\(productId,\s*true\)/,
  'linked banner product lookup must bypass stale cache',
);

assert.match(
  source,
  /vpsApiService\.getProducts\(\{\s*parent_id:\s*String\(parentId\),\s*status:\s*'active',\s*limit:\s*500,\s*noCache:\s*true\s*\}\)/s,
  'linked banner product availability must check active parent_id variations',
);

assert.match(
  source,
  /vpsApiService\.getProducts\(\{\s*model_id:\s*product\.model_id,\s*status:\s*'active',\s*limit:\s*500,\s*noCache:\s*true\s*\}\)/s,
  'linked banner product availability must check active model_id variations when parent_id is missing',
);

assert.match(
  source,
  /product\.track_inventory\s*===\s*false[\s\S]*Number\(product\.stock_quantity\s*\?\?\s*0\)\s*>\s*0/,
  'linked banner products must be visible only when untracked inventory or positive stock is available',
);

assert.match(
  source,
  /const banners = filterActiveBanners\(allBanners,\s*customerType\);[\s\S]*const availableBanners = await filterBannersByLinkedProductAvailability\(banners\);[\s\S]*data: availableBanners/,
  'getActiveBanners must cache the availability-filtered banner list',
);

console.log('banner linked product availability static checks passed');
