import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /isImmutableImageDerivative/,
  'VPS static image headers should identify generated WebP/AVIF derivatives',
);
assert.match(
  source,
  /CDN-Cache-Control', 'public, max-age=31536000, immutable'/,
  'generated derivatives should be cacheable by Cloudflare for a year',
);
assert.match(
  source,
  /CDN-Cache-Control', 'no-store'/,
  'original images should keep conservative CDN caching',
);
