import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../utils/product-video-playlist.ts', import.meta.url), 'utf8');

assert.match(source, /product\.video_url\?\.trim\(\) \|\| product\.marketing_video_url\?\.trim\(\)/);
assert.match(source, /export function orderProductVideoSiblings/);
assert.match(source, /export function isSafeProductVideoSibling/);
assert.match(source, /modelId !== String\(sibling\.model_id/);
assert.match(source, /siblingName\.startsWith\(`\$\{productName\} `\)/);
assert.match(source, /normalizeVariantSpec\(left\.specs\?\.ram\) === productRam/);
assert.match(source, /normalizeVariantSpec\(left\.specs\?\.storage\) === productStorage/);
assert.match(source, /sibling\.video_url\?\.trim\(\) \|\| sibling\.marketing_video_url\?\.trim\(\)/);

console.log('product video sibling fallback regression ok');
