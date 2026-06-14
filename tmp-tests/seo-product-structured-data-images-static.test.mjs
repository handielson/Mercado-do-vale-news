import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['vps_server.js', 'vps_server.cjs', 'server.js'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /function\s+normalizeSeoPublicImages\(/, `${file} must normalize public image URLs for product JSON-LD`);
  assert.match(source, /\(data:\|blob:\)/, `${file} must reject data/blob image URLs from merchant listing schema`);
  assert.match(source, /new URL\(image,\s*baseUrl\)/, `${file} must resolve relative images through URL parsing`);
  assert.match(source, /url\.protocol === 'https:'/, `${file} must keep structured-data images on HTTPS`);
  assert.match(source, /publicImages\.length \? publicImages\.slice\(0,\s*5\) : \[image\]/, `${file} must fall back to a valid image array`);
  assert.doesNotMatch(source, /image:\s*images\.slice\(0,\s*5\)/, `${file} must not inject raw product.images into JSON-LD`);
}

console.log('SEO product structured-data image checks ok');
