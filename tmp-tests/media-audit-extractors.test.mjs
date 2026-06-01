import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractMediaRefsFromCatalogBanners,
  extractMediaRefsFromCompanySettings,
  extractMediaRefsFromModelColorImages,
  extractMediaRefsFromProducts,
  summarizeMediaRefs,
} from '../services/mediaAuditExtractors.js';

test('extracts product image_url, images, and custom_images in stable order', () => {
  const refs = extractMediaRefsFromProducts([
    {
      id: 'p1',
      sku: 'SKU1',
      name: 'Produto 1',
      image_url: 'https://i.imgur.com/a.png',
      images: ['https://api.xiaomipetrolina.com.br/images/products/p1/a.webp', ''],
      custom_images: ['https://legacy-media.example.com/products/a.png'],
    },
  ]);

  assert.deepEqual(refs.map((ref) => ref.field), ['image_url', 'images[0]', 'custom_images[0]']);
  assert.equal(refs[0].entityType, 'product');
  assert.equal(refs[0].entityId, 'p1');
  assert.equal(refs[0].label, 'SKU1 - Produto 1');
  assert.equal(refs[0].origin, 'imgur');
});

test('extracts model-color image arrays', () => {
  const refs = extractMediaRefsFromModelColorImages([
    {
      id: 'mci1',
      model_id: 'm1',
      color_id: 'c1',
      images: ['https://imagens.xiaomipetrolina.com.br/legacy/a.jpg'],
    },
  ]);

  assert.equal(refs.length, 1);
  assert.equal(refs[0].entityType, 'model_color_images');
  assert.equal(refs[0].field, 'images[0]');
  assert.equal(refs[0].origin, 'synology-legacy');
});

test('extracts known company image fields and skips empty values', () => {
  const refs = extractMediaRefsFromCompanySettings({
    id: 'company',
    name: 'Mercado do Vale',
    logo: 'https://example.com/logo.png',
    favicon: '',
    about_us_image_url: null,
    watermark_url: 'data:image/png;base64,abc',
  });

  assert.equal(refs.length, 2);
  assert.deepEqual(refs.map((ref) => ref.field), ['logo', 'watermark_url']);
  assert.equal(refs[0].entityType, 'company_settings');
});

test('extracts banner image fields without assuming schema completeness', () => {
  const refs = extractMediaRefsFromCatalogBanners([
    {
      id: 'b1',
      title: 'Banner 1',
      image_url: 'https://api.xiaomipetrolina.com.br/banners/a.webp',
      desktop_image_url: 'https://legacy-media.example.com/catalog-banners/a.png',
      mobile_image_url: undefined,
    },
  ]);

  assert.deepEqual(refs.map((ref) => ref.field), ['image_url', 'desktop_image_url']);
  assert.equal(refs[1].origin, 'external');
});

test('summarizes refs by origin and entity type', () => {
  const summary = summarizeMediaRefs([
    { origin: 'vps', entityType: 'product', shouldMigrate: false },
    { origin: 'external', entityType: 'product', shouldMigrate: true },
    { origin: 'external', entityType: 'catalog_banner', shouldMigrate: true },
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.migrationCandidates, 2);
  assert.equal(summary.alreadyCanonical, 1);
  assert.equal(summary.byOrigin.vps, 1);
  assert.equal(summary.byOrigin.external, 2);
  assert.equal(summary.byEntityType.product, 2);
  assert.equal(summary.byEntityType.catalog_banner, 1);
});
