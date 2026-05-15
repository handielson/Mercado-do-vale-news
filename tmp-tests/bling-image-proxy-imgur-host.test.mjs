import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../api/bling.ts', import.meta.url), 'utf8');

assert.match(
  source,
  /'i\.imgur\.com'/,
  'Bling image proxy must allow legacy i.imgur.com product images for Shopee media upload'
);

console.log('bling image proxy imgur host guard ok');
