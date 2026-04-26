import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  validateMediaUploadPath,
  ALLOWED_MEDIA_UPLOAD_PREFIXES,
} = require('../services/vpsUploadPathPolicy.cjs');

test('allows existing product upload paths', () => {
  assert.equal(
    validateMediaUploadPath('products/ABC-123/img-1.webp').safePath,
    'products/ABC-123/img-1.webp',
  );
});

test('allows migration media prefixes needed for large scale cleanup', () => {
  const paths = [
    'model-color/row-1/abc123.webp',
    'company/company-1/logo-abc123.png',
    'legacy/external/imgur/abc123.jpg',
    'banners/migrated/banner-abc123.webp',
  ];

  for (const input of paths) {
    assert.equal(validateMediaUploadPath(input).safePath, input);
  }

  assert.deepEqual(
    ALLOWED_MEDIA_UPLOAD_PREFIXES,
    ['products/', 'model-color/', 'company/', 'legacy/', 'banners/'],
  );
});

test('blocks traversal and absolute paths', () => {
  const invalid = [
    '../secret.webp',
    'products/../../secret.webp',
    '/etc/passwd',
    'C:\\temp\\file.webp',
    'products\\..\\secret.webp',
  ];

  for (const input of invalid) {
    assert.equal(validateMediaUploadPath(input).ok, false, input);
  }
});

test('blocks unknown prefixes and non-image extensions', () => {
  assert.equal(validateMediaUploadPath('avatars/a.webp').ok, false);
  assert.equal(validateMediaUploadPath('legacy/external/imgur/file.exe').ok, false);
  assert.equal(validateMediaUploadPath('legacy/external/imgur/file').ok, false);
  assert.equal(validateMediaUploadPath('legacy/external/imgur/file.svg').ok, false);
});
