import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMediaUrl,
  isCanonicalVpsImageUrl,
  redactMediaUrl,
  shouldMigrateMediaUrl,
} from '../services/mediaOrigin.js';

test('classifies canonical VPS product images as already migrated', () => {
  const result = classifyMediaUrl('https://api.xiaomipetrolina.com.br/images/products/123/img-1.webp');

  assert.equal(result.origin, 'vps');
  assert.equal(result.shouldMigrate, false);
  assert.equal(isCanonicalVpsImageUrl(result.normalizedUrl), true);
  assert.equal(shouldMigrateMediaUrl(result.normalizedUrl), false);
});

test('classifies canonical VPS banners as already migrated', () => {
  const result = classifyMediaUrl('https://api.xiaomipetrolina.com.br/banners/banner.webp');

  assert.equal(result.origin, 'vps');
  assert.equal(result.shouldMigrate, false);
});

test('classifies non-media VPS API URLs as external review items', () => {
  const result = classifyMediaUrl('https://api.xiaomipetrolina.com.br/products/123');

  assert.equal(result.origin, 'external');
  assert.equal(result.shouldMigrate, true);
});

test('classifies legacy external storage images as migration candidates', () => {
  const result = classifyMediaUrl(
    'https://legacy-media.example.com/storage/catalog-banners/banner.png',
  );

  assert.equal(result.origin, 'external');
  assert.equal(result.shouldMigrate, true);
  assert.match(result.reason, /External image/);
});

test('classifies non-image API URLs as external review items', () => {
  const result = classifyMediaUrl(
    'https://legacy-api.example.com/rest/v1/company_settings?select=*',
  );

  assert.equal(result.origin, 'external');
  assert.equal(result.shouldMigrate, true);
});

test('classifies Synology image hostname as legacy candidate', () => {
  const result = classifyMediaUrl('https://imagens.xiaomipetrolina.com.br/products/sku.jpg');

  assert.equal(result.origin, 'synology-legacy');
  assert.equal(result.shouldMigrate, true);
});

test('classifies video hostname as external, not image-canonical', () => {
  const result = classifyMediaUrl('https://videos.mercadodovale.com.br/SKU.mp4');

  assert.equal(result.origin, 'external');
  assert.equal(result.shouldMigrate, true);
});

test('classifies Imgur as migration candidate', () => {
  const result = classifyMediaUrl('https://i.imgur.com/rmKwr7K.png');

  assert.equal(result.origin, 'imgur');
  assert.equal(result.shouldMigrate, true);
});

test('classifies direct Bling S3 as migration candidate', () => {
  const result = classifyMediaUrl('https://orgbling.s3.amazonaws.com/abc/image.jpg?AWSAccessKeyId=x&Signature=secret');

  assert.equal(result.origin, 'bling-s3');
  assert.equal(result.shouldMigrate, true);
  assert.equal(result.redactedUrl.includes('Signature=REDACTED'), true);
});

test('classifies local Bling image proxy and extracts original URL', () => {
  const original = 'https://orgbling.s3.amazonaws.com/abc/image.jpg?AWSAccessKeyId=x&Signature=secret';
  const result = classifyMediaUrl(`/api/bling?resource=image-proxy&url=${encodeURIComponent(original)}`);

  assert.equal(result.origin, 'bling-s3-proxy');
  assert.equal(result.shouldMigrate, true);
  assert.equal(result.sourceUrl, original);
  assert.equal(result.redactedUrl.includes('Signature=REDACTED'), true);
});

test('classifies data URLs as migration candidates and blob URLs as runtime media', () => {
  const dataResult = classifyMediaUrl('data:image/png;base64,abc');
  const blobResult = classifyMediaUrl('blob:https://mercadodovale.com.br/abc');

  assert.equal(dataResult.origin, 'inline-data');
  assert.equal(dataResult.shouldMigrate, true);
  assert.equal(blobResult.origin, 'browser-blob');
  assert.equal(blobResult.shouldMigrate, false);
});

test('classifies relative app paths as non-migration candidates', () => {
  const result = classifyMediaUrl('/brand/logo.png');

  assert.equal(result.origin, 'relative');
  assert.equal(result.shouldMigrate, false);
});

test('classifies empty and invalid values safely', () => {
  assert.equal(classifyMediaUrl('').origin, 'empty');
  assert.equal(classifyMediaUrl(null).origin, 'empty');
  assert.equal(classifyMediaUrl('https://').origin, 'invalid');
});

test('classifies unknown external HTTP URLs as migration candidates', () => {
  const result = classifyMediaUrl('https://example.com/image.jpg');

  assert.equal(result.origin, 'external');
  assert.equal(result.shouldMigrate, true);
});

test('redacts signed or sensitive query parameters', () => {
  const result = redactMediaUrl('https://example.com/a.jpg?token=abc&Signature=secret&x=1');

  assert.equal(result, 'https://example.com/a.jpg?token=REDACTED&Signature=REDACTED&x=1');
});
