import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMediaMigrationPlan,
  createEmptyMediaMigrationCheckpoint,
  stripUploadPayloadsFromPlan,
} from '../services/mediaMigrationApply.js';
import { buildMediaMigrationPlan } from '../services/mediaMigrationPlanner.js';

const tinyPng = 'data:image/png;base64,aGVsbG8=';

function buildPlan() {
  return buildMediaMigrationPlan({
    refs: [
      { entityType: 'model_color_images', entityId: 'row-1', field: 'images[0]', origin: 'inline-data', shouldMigrate: true, url: tinyPng, redactedUrl: 'data:REDACTED' },
      { entityType: 'model_color_images', entityId: 'row-2', field: 'images[0]', origin: 'inline-data', shouldMigrate: true, url: tinyPng, redactedUrl: 'data:REDACTED' },
    ],
  }, { scope: 'inline-data', includeUploadPayloads: true });
}

test('uploads each unique inline payload once and dedupes repeated payloads', async () => {
  const plan = buildPlan();
  const uploads = [];
  const checkpoint = createEmptyMediaMigrationCheckpoint();

  const result = await applyMediaMigrationPlan(plan, {
    checkpoint,
    uploader: async (action) => {
      uploads.push(action);
      return { url: action.plannedUrl, path: action.plannedPath };
    },
  });

  assert.equal(uploads.length, 1);
  assert.equal(result.summary.uploaded, 1);
  assert.equal(result.summary.deduped, 1);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.results[0].status, 'uploaded');
  assert.equal(result.results[1].status, 'deduped');
  assert.equal(result.checkpoint.uploadsBySha[plan.actions[0].sha256].url, plan.actions[0].plannedUrl);
});

test('skips upload when checkpoint already has the payload hash', async () => {
  const plan = buildPlan();
  const checkpoint = createEmptyMediaMigrationCheckpoint();
  checkpoint.uploadsBySha[plan.actions[0].sha256] = {
    url: plan.actions[0].plannedUrl,
    path: plan.actions[0].plannedPath,
    uploadedAt: '2026-04-26T00:00:00.000Z',
  };

  const result = await applyMediaMigrationPlan(plan, {
    checkpoint,
    uploader: async () => {
      throw new Error('uploader should not be called');
    },
  });

  assert.equal(result.summary.alreadyUploaded, 2);
  assert.equal(result.summary.uploaded, 0);
  assert.equal(result.results[0].status, 'already-uploaded');
  assert.equal(result.results[1].status, 'already-uploaded');
});

test('strips inline upload payloads before writing reports', () => {
  const plan = buildPlan();
  assert.ok(plan.actions[0].uploadPayloadBase64);

  const stripped = stripUploadPayloadsFromPlan(plan);

  assert.equal(stripped.actions[0].uploadPayloadBase64, undefined);
  assert.equal(stripped.actions[0].uploadContentType, 'image/png');
});
