import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
const handlerStart = source.indexOf('const handleAutoGenerateVideos');
const handlerEnd = source.indexOf('return (', handlerStart);
const handler = source.slice(handlerStart, handlerEnd);

assert.ok(handlerStart > -1, 'ProductListPage should have handleAutoGenerateVideos');

assert.match(
  source,
  /import\s+\{\s*vpsApiService\s+\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/services\/vpsApiService['"]/,
  'ProductListPage should import vpsApiService for product reads',
);

assert.match(
  handler,
  /vpsApiService\.getProducts\(\s*\{[\s\S]*status:\s*['"]all['"][\s\S]*limit:\s*5000[\s\S]*noCache:\s*true[\s\S]*\}\s*\)/,
  'auto video generation should load candidate products from VPS',
);

assert.match(
  handler,
  /\.filter\([\s\S]*video_url[\s\S]*sku/,
  'auto video generation should filter missing video_url and non-empty sku in memory',
);

assert.doesNotMatch(
  handler,
  /\.from\(['"]products['"]\)[\s\S]*\.select\(['"]id,\s*sku['"]\)[\s\S]*\.is\(['"]video_url['"],\s*null\)/,
  'auto video generation should not read candidate products directly from Supabase',
);

console.log('product list video VPS read static checks passed');
