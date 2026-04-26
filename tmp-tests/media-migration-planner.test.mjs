import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMediaMigrationPlan,
  canonicalPayloadPath,
  decodeInlineDataImage,
  plannedPathForRef,
} from '../services/mediaMigrationPlanner.js';

const tinyPng = 'data:image/png;base64,aGVsbG8=';

test('decodes inline data images with mime, bytes, hash, and extension', () => {
  const decoded = decodeInlineDataImage(tinyPng);

  assert.equal(decoded.ok, true);
  assert.equal(decoded.mimeType, 'image/png');
  assert.equal(decoded.extension, 'png');
  assert.equal(decoded.byteLength, 5);
  assert.equal(decoded.sha256.length, 64);
});

test('blocks non-image inline data', () => {
  const decoded = decodeInlineDataImage('data:text/plain;base64,aGVsbG8=');

  assert.equal(decoded.ok, false);
  assert.match(decoded.reason, /not a supported raster image/);
});

test('blocks svg inline data because public uploads only accept raster images', () => {
  const decoded = decodeInlineDataImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');

  assert.equal(decoded.ok, false);
  assert.match(decoded.reason, /not a supported raster image/);
});

test('creates deterministic paths by entity type', () => {
  const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  assert.equal(
    plannedPathForRef({ entityType: 'model_color_images', entityId: 'row-1', field: 'images[0]' }, { sha256: hash, extension: 'png' }),
    'model-color/row-1/0123456789abcdef.png',
  );
  assert.equal(
    plannedPathForRef({ entityType: 'product', entityId: 'prod-1', field: 'images[2]' }, { sha256: hash, extension: 'webp' }),
    'products/migrated/prod-1/0123456789abcdef.webp',
  );
  assert.equal(
    plannedPathForRef({ entityType: 'company_settings', entityId: 'company-1', field: 'logo' }, { sha256: hash, extension: 'jpg' }),
    'company/company-1/logo-0123456789abcdef.jpg',
  );
});

test('builds inline-data dry-run actions and dedupes repeated payloads', () => {
  const report = {
    refs: [
      { entityType: 'model_color_images', entityId: 'row-1', field: 'images[0]', origin: 'inline-data', shouldMigrate: true, url: tinyPng, redactedUrl: 'data:REDACTED' },
      { entityType: 'model_color_images', entityId: 'row-1', field: 'images[1]', origin: 'inline-data', shouldMigrate: true, url: tinyPng, redactedUrl: 'data:REDACTED' },
      { entityType: 'product', entityId: 'prod-1', field: 'images[0]', origin: 'imgur', shouldMigrate: true, url: 'https://i.imgur.com/a.png', redactedUrl: 'https://i.imgur.com/a.png' },
    ],
  };

  const plan = buildMediaMigrationPlan(report, { scope: 'inline-data' });

  assert.equal(plan.summary.totalCandidates, 2);
  assert.equal(plan.summary.planned, 2);
  assert.equal(plan.summary.uniquePayloads, 1);
  assert.equal(plan.actions[0].status, 'planned');
  assert.equal(plan.actions[0].mode, 'dry-run');
  assert.match(plan.actions[0].plannedUrl, /^https:\/\/api\.xiaomipetrolina\.com\.br\/images\/legacy\/inline\//);
  assert.equal(plan.actions[0].plannedPath, plan.actions[1].plannedPath);
  assert.equal(plan.actions[1].duplicateOf, plan.actions[0].plannedUrl);
});

test('creates canonical payload paths for duplicate-safe upload planning', () => {
  const path = canonicalPayloadPath({
    sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    extension: 'jpg',
  });

  assert.equal(path, 'legacy/inline/0123456789abcdef.jpg');
});
