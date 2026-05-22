import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-image-proxy-live-check.cjs', 'utf8');

assert.match(source, /resource=debug-product/, 'image proxy live check must discover a real product image from debug-product');
assert.match(source, /resource=image-proxy/, 'image proxy live check must call the VPS image-proxy route');
assert.match(source, /127\.0\.0\.1:4000/, 'image proxy live check should call the local VPS API from the VPS');
assert.match(source, /vps-bling-reconcile-dry-run-details-output\.json/, 'image proxy live check should reuse already discovered Bling IDs');
assert.doesNotMatch(source, /Authorization: Bearer|CRON_SECRET|access_token|refresh_token|client_secret/i, 'image proxy live check must not print or manage secrets');
assert.doesNotMatch(source, /console\.log\(.*imageUrl|console\.log\(.*productJson/, 'image proxy live check must not print image URLs or raw products');
assert.match(source, /image URL, product name, SKU, stock, tokens, and raw product bodies are not printed/, 'image proxy live check must document sanitized output');

console.log('vps Bling image proxy live static checks ok');
