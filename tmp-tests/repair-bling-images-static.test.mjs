import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/repair-bling-images.cjs', import.meta.url), 'utf8');

assert.match(source, /process\.argv\.includes\('--execute'\)/, 'repair must be dry-run unless explicitly executed');
assert.ok(source.includes('orgbling\\.s3\\.amazonaws\\.com'), 'repair must target temporary Bling image URLs');
assert.match(source, /!hasStoredProductImage\(product\)/, 'repair must also target products whose stored image list is empty');
assert.match(source, /status=all&compact=true/, 'repair must inspect active and inactive products without loading image blobs');
assert.match(source, /resource=image-proxy/, 'repair must download Bling images through the safe proxy');
assert.match(source, /image\?\.linkMiniatura/, 'repair must fall back to the Bling thumbnail when the original link is unavailable');
assert.match(source, /if \(!uploaded\.length\)/, 'repair must persist only after at least one image was downloaded');
assert.match(source, /`\$\{API_BASE\}\/images\/upload`/, 'repair must upload multipart directly to the VPS');
assert.match(source, /`\$\{API_BASE\}\/products\/images`/, 'repair must update only the product image list');
assert.match(source, /affectedRows/, 'repair must verify that the product image row was actually updated');
assert.doesNotMatch(source, /console\.log\([^\n]*sourceUrl/, 'repair must not print signed Bling image URLs');

console.log('repair-bling-images static checks passed');
