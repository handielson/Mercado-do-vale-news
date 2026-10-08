import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerSmartphonePhotoIntakeRoutes } from '../services/smartphonePhotoIntakeServer.cjs';

async function fixture(t, status = 'review_required', options = {}) {
  const app = Fastify();
  const directory = mkdtempSync(join(tmpdir(), 'mdv-queue-removal-'));
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  const intake = { id: 'entry', status, unit_id: status === 'completed' ? 'unit' : null,
    matched_product_id: 'product', matched_model_id: 'model', matched_color_id: 'color',
    detected_ram: '8GB', detected_storage: '256GB', completed_at: status === 'completed' ? '2026-10-01' : null,
    photo_private_path: 'smartphone-intakes/photo.png', photo_sha256: 'hash' };
  const commercial = { products: [{ id: 'product', stock_quantity: 3 }], units: [{ id: 'unit', intake_id: 'entry', status: 'available' }], sales: [{ id: 'sale' }] };
  const sqls = [];
  let snapshot;
  const query = async (sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    sqls.push(q);
    if (/^(CREATE|ALTER|SHOW)/.test(q)) return [[]];
    if (q.includes('WHERE status IN')) return [[]]; // existing startup repair, no pending fixtures
    if (q.startsWith('SELECT * FROM smartphone_photo_intakes')) {
      if (q.includes('WHERE id')) return [params[0] === 'missing' ? [] : [{ ...intake }]];
      return [q.includes("status <> 'cancelled'") && intake.status === 'cancelled' ? [] : [{ ...intake }]];
    }
    if (q === 'UPDATE smartphone_photo_intakes SET status=? WHERE id=?') {
      intake.status = params[0]; return [{ affectedRows: 1 }];
    }
    if (q.includes('SET status=?, error_message=NULL') && options.removeBeforeAnalysisClaim) {
      intake.status = 'cancelled'; return [{ affectedRows: 0 }];
    }
    throw new Error(`Unexpected mutation/query: ${q}`);
  };
  const connection = { query, beginTransaction: async () => { snapshot = { ...intake }; },
    commit: async () => {}, rollback: async () => Object.assign(intake, snapshot), release() {} };
  registerSmartphonePhotoIntakeRoutes(app, { pool: { query, getConnection: async () => connection },
    requireSyncKey: async (request, reply) => {
      if (request.headers['x-sync-key'] !== 'test') return reply.code(401).send({ error: 'Unauthorized' });
    }, baseDir: directory });
  await app.ready();
  return { app, intake, commercial, sqls,
    call: (method, path = '/smartphone-photo-intakes/entry', payload) => app.inject({ method, url: path, headers: { 'x-sync-key': 'test' }, payload }) };
}

for (const status of ['review_required', 'ready_to_finalize', 'completed']) {
  test(`exclude ${status} only from queue, preserving commercial records and photo provenance`, async t => {
    const f = await fixture(t, status);
    const before = structuredClone(f.commercial);
    const references = { unit_id: f.intake.unit_id, matched_product_id: f.intake.matched_product_id,
      completed_at: f.intake.completed_at, photo_private_path: f.intake.photo_private_path };
    assert.equal((await f.call('DELETE')).statusCode, 200);
    assert.equal(f.intake.status, 'cancelled');
    assert.deepEqual(f.commercial, before);
    for (const [key, value] of Object.entries(references)) assert.equal(f.intake[key], value);
    assert.equal((await f.call('DELETE')).statusCode, 200, 'retry is idempotent');
    assert.deepEqual((await f.call('GET', '/smartphone-photo-intakes?status=all')).json(), []);
    assert.ok(f.sqls.some(sql => sql.endsWith('FOR UPDATE')), 'finalization shares the same row lock');
    assert.equal(f.sqls.filter(sql => sql.startsWith('UPDATE smartphone_photo_intakes')).length, 1);
    assert.ok(!f.sqls.some(sql => /^(DELETE|UPDATE (products|units|sales)|INSERT)/.test(sql)));
    for (const [method, suffix] of [['PATCH', ''], ['POST', '/analyze'], ['POST', '/finalize'], ['POST', '/confirm-group-prices'], ['POST', '/apply-brand-margins'], ['PUT', '/bling-mapping']]) {
      assert.equal((await f.call(method, `/smartphone-photo-intakes/entry${suffix}`, {})).statusCode, 409, suffix || method);
    }
  });
}

test('analysis in progress cannot be removed; missing records return 404', async t => {
  const f = await fixture(t, 'analyzing');
  assert.equal((await f.call('DELETE')).statusCode, 409);
  assert.equal(f.intake.status, 'analyzing');
  assert.equal((await f.call('DELETE', '/smartphone-photo-intakes/missing')).statusCode, 404);
});

test('removal requires the existing authenticated API guard', async t => {
  const f = await fixture(t);
  const before = f.sqls.length;
  assert.equal((await f.app.inject({ method: 'DELETE', url: '/smartphone-photo-intakes/entry' })).statusCode, 401);
  assert.equal(f.sqls.length, before);
  assert.equal(f.intake.status, 'review_required');
});

test('analysis cannot reactivate a record removed after its initial read', async t => {
  const f = await fixture(t, 'review_required', { removeBeforeAnalysisClaim: true });
  assert.equal((await f.call('POST', '/smartphone-photo-intakes/entry/analyze', {})).statusCode, 409);
  assert.equal(f.intake.status, 'cancelled');
  assert.equal(f.sqls.filter(sql => sql.startsWith('UPDATE')).length, 1);
});
