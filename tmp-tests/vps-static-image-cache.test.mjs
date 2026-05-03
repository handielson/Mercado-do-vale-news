import assert from 'node:assert/strict';
import fs from 'node:fs';

const sources = ['vps_server.cjs', 'vps_server.js'].map((file) => ({
  file,
  source: fs.readFileSync(file, 'utf8'),
}));

for (const { file, source } of sources) {
  assert.match(
    source,
    /isImmutableImageDerivative/,
    `${file} should identify generated WebP/AVIF derivatives`,
  );
  assert.match(
    source,
    /CDN-Cache-Control', 'public, max-age=31536000, immutable'/,
    `${file} should make generated derivatives cacheable by Cloudflare for a year`,
  );
  assert.match(
    source,
    /CDN-Cache-Control', 'no-store'/,
    `${file} should keep original images conservative for CDN caching`,
  );
}
