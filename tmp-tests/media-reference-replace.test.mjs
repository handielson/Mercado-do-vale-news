import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMediaReferenceReplacementPlan,
  parseIndexedMediaField,
} from '../services/mediaReferenceReplace.js';
import { buildMediaMigrationPlan } from '../services/mediaMigrationPlanner.js';

const firstPng = 'data:image/png;base64,aGVsbG8=';
const secondPng = 'data:image/png;base64,d29ybGQ=';

function buildPlan() {
  return buildMediaMigrationPlan({
    refs: [
      { entityType: 'product', entityId: 'p1', field: 'images[0]', origin: 'inline-data', shouldMigrate: true, url: firstPng, redactedUrl: 'data:REDACTED' },
      { entityType: 'product', entityId: 'p1', field: 'images[1]', origin: 'inline-data', shouldMigrate: true, url: secondPng, redactedUrl: 'data:REDACTED' },
    ],
  }, { scope: 'inline-data' });
}

test('parses indexed media fields', () => {
  assert.deepEqual(parseIndexedMediaField('images[12]'), { baseField: 'images', index: 12 });
  assert.equal(parseIndexedMediaField('image_url'), null);
});

test('builds product image replacements only for matching uploaded hashes', () => {
  const plan = buildPlan();
  const checkpoint = {
    uploadsBySha: {
      [plan.actions[0].sha256]: {
        url: plan.actions[0].plannedUrl,
        path: plan.actions[0].plannedPath,
      },
      [plan.actions[1].sha256]: {
        url: plan.actions[1].plannedUrl,
        path: plan.actions[1].plannedPath,
      },
    },
  };

  const replacement = buildMediaReferenceReplacementPlan(plan, {
    checkpoint,
    rowsByEntity: {
      'product:p1': {
        id: 'p1',
        sku: 'SKU1',
        images: [firstPng, secondPng, 'https://example.com/kept.jpg'],
      },
    },
  });

  assert.equal(replacement.summary.ready, 2);
  assert.equal(replacement.summary.mutations, 1);
  assert.deepEqual(replacement.mutations[0], {
    entityType: 'product',
    entityId: 'p1',
    sku: 'SKU1',
    field: 'images',
    nextValue: [
      plan.actions[0].plannedUrl,
      plan.actions[1].plannedUrl,
      'https://example.com/kept.jpg',
    ],
    replacements: [
      { index: 0, sha256: plan.actions[0].sha256, from: 'data:REDACTED', to: plan.actions[0].plannedUrl },
      { index: 1, sha256: plan.actions[1].sha256, from: 'data:REDACTED', to: plan.actions[1].plannedUrl },
    ],
  });
});

test('skips unsafe replacements when checkpoint is missing or current hash differs', () => {
  const plan = buildPlan();
  const checkpoint = {
    uploadsBySha: {
      [plan.actions[0].sha256]: {
        url: plan.actions[0].plannedUrl,
        path: plan.actions[0].plannedPath,
      },
    },
  };

  const replacement = buildMediaReferenceReplacementPlan(plan, {
    checkpoint,
    rowsByEntity: {
      'product:p1': {
        id: 'p1',
        sku: 'SKU1',
        images: [secondPng, secondPng],
      },
    },
  });

  assert.equal(replacement.summary.ready, 0);
  assert.equal(replacement.summary.skipped, 2);
  assert.equal(replacement.mutations.length, 0);
  assert.deepEqual(replacement.results.map((result) => result.status), ['hash-mismatch', 'missing-upload']);
});
