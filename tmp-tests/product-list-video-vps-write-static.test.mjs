import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
const handlerStart = source.indexOf('const handleAutoGenerateVideos');
const handlerEnd = source.indexOf('return (', handlerStart);
const handler = source.slice(handlerStart, handlerEnd);

assert.ok(handlerStart > -1, 'ProductListPage should have handleAutoGenerateVideos');

assert.match(
  handler,
  /vpsApiService\.updateProduct\(\s*prod\.id\s*,\s*\{[\s\S]*\.\.\.prod[\s\S]*video_url:\s*candidateUrl[\s\S]*\}\s*\)/,
  'auto video generation should persist generated video_url through VPS product update',
);

assert.doesNotMatch(
  handler,
  /supabase\s*\.[\s\S]*from\(['"]products['"]\)[\s\S]*update\(\s*\{\s*video_url:\s*candidateUrl\s*\}\s*\)/,
  'auto video generation should not write product video_url directly to Supabase',
);

assert.doesNotMatch(
  source,
  /import\s+\{\s*supabase\s+\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/services\/supabase['"]/,
  'ProductListPage should not import Supabase after moving video writes to VPS',
);

console.log('product list video VPS write static checks passed');
