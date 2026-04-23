import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const productCardSource = readFileSync(path.join(repoRoot, 'components', 'products', 'ProductCard.tsx'), 'utf8');
const serverSource = readFileSync(path.join(repoRoot, 'server.js'), 'utf8');
const {
  buildVideoCdnUrl,
  buildVideoFileName,
  findCaseInsensitiveVideoFileName,
} = require(path.join(repoRoot, 'utils', 'video-file-name.cjs'));

assert.doesNotMatch(
  productCardSource,
  /const\s+normalizedSku\s*=\s*product\.sku\.trim\(\)\.replace\([^;]+\.toUpperCase\(\)/,
  'ProductCard video lookup must preserve SKU casing because Synology/CDN filenames are case-sensitive',
);

assert.doesNotMatch(
  productCardSource,
  /product\.sku\.toUpperCase\(\)/,
  'ProductCard video upload must preserve SKU casing so future detection checks the same filename it uploaded',
);

assert.match(
  serverSource,
  /async function checkVideoCdnHead\(/,
  'VPS video check must have a CDN HEAD fallback for files that exist publicly but are missed by FileStation',
);

assert.match(
  serverSource,
  /checkVideoCdnHead\(canonicalUrl\)/,
  'VPS video routes must call the CDN HEAD fallback before reporting exists=false',
);

assert.match(
  serverSource,
  /findSynologyVideoFileNameCaseInsensitive/,
  'VPS video checks must resolve Synology filenames case-insensitively before falling back to exists=false',
);

assert.equal(
  buildVideoFileName(' MO-689-Z ', '.mp4'),
  'MO-689-Z.mp4',
  'Video filename builder must preserve SKU casing while trimming whitespace',
);

assert.equal(
  findCaseInsensitiveVideoFileName(
    [{ name: 'manual.pdf' }, { name: 'Mo-689-Z.mp4' }, { name: 'MO-689-Z.webp' }],
    'MO-689-Z.mp4',
  ),
  'Mo-689-Z.mp4',
  'Video filename resolver must find the real filename even when the SKU casing differs',
);

assert.equal(
  buildVideoCdnUrl('Mo-689-Z.mp4'),
  'https://videos.mercadodovale.com.br/Mo-689-Z.mp4',
  'Video CDN URL must use the actual filename casing returned by Synology',
);

console.log('video detection case regression ok');
