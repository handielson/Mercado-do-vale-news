import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['server.js', 'vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /async function normalizeShopeeCatalogImageUploadInputVps/,
    `${file} must normalize Shopee image uploads before multipart`,
  );
  assert.match(
    source,
    /const SHOPEE_CATALOG_DIRECT_IMAGE_MIME_TYPES = new Set\(\['image\/jpeg', 'image\/jpg', 'image\/png'\]\)/,
    `${file} must only pass Shopee-supported image mime types directly`,
  );
  assert.match(
    source,
    /\.jpeg\(\{ quality: 92/,
    `${file} must convert unsupported image formats to JPEG`,
  );
  assert.match(
    source,
    /normalizeShopeeCatalogImageUploadInputVps\(parsed\)/,
    `${file} catalog upload_image must call the normalizer`,
  );
  assert.match(
    source,
    /normalizeShopeeCatalogImageUploadInputVps\(image\)/,
    `${file} actions add_item image upload must call the normalizer`,
  );
}

console.log('Shopee image upload normalization static checks ok');
