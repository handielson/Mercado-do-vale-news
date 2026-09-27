'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerPrint3dRecipeRoutes } = require('../services/print3dRecipesServer.cjs');

const product = { id: '11111111-1111-4111-8111-111111111111', sku: 'CHAVEIRO-01', name: 'Chaveiro azul', is_parent: 0 };
const headers = { authorization: 'Bearer admin' };
const url = `/admin/print3d/products/${product.id}/recipes`;
const draft = () => ({
  productId: product.id, productName: product.name, sku: product.sku, revision: 'r1',
  materialGrams: 20, printMinutes: 120, pieces: 2, laborMinutes: 10,
  filaments: [{ id: 'pla-azul', name: 'PLA', color: 'Azul', consumedGrams: 20, spoolGrams: 1000, spoolCostCents: 9000 }],
  supplies: [{ id: 'argola', name: 'Argola', quantity: 2, unitCostCents: 30 }],
  rates: { printerWatts: 200, energyCentsPerKwh: 100, machineCentsPerHour: 50, laborCentsPerHour: 300 },
  cost: { filamentCents: 180, energyCents: 40, machineCents: 100, laborCents: 50, suppliesCents: 60, batchCents: 430, unitCents: 215 },
});
const portableDraft = async (input = draft()) => (await import('../utils/print3dRecipeDraft.mjs')).buildPrint3dRecipeDraft(input);

async function fixture(enabled = true) {
  const app = Fastify();
  const rows = new Map();
  const pool = { async query(sql, params) {
    if (sql.startsWith('SELECT id,sku,name,is_parent FROM products')) return [[product]];
    if (sql.includes('FROM print3d_recipe_revisions WHERE product_id=? AND revision=?')) {
      const row = rows.get(`${params[0]}:${params[1]}`);
      return [[row].filter(Boolean)];
    }
    if (sql.startsWith('INSERT INTO print3d_recipe_revisions')) {
      const [id, productId, sku, revision, draftJson, hash, actor] = params;
      const key = `${productId}:${revision}`;
      if (rows.has(key)) { const error = new Error('duplicate'); error.code = 'ER_DUP_ENTRY'; throw error; }
      rows.set(key, { id, product_id: productId, sku_snapshot: sku, revision, draft_json: draftJson, draft_sha256: hash, created_by: actor, created_at: '2026-09-25' });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM print3d_recipe_revisions WHERE product_id=? ORDER BY')) {
      return [[...rows.values()].filter(row => row.product_id === params[0])];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  registerPrint3dRecipeRoutes(app, { pool, enabled, getBearerAuthContext: async req => req.headers.authorization === 'Bearer admin'
    ? { isAdmin: true, userId: 'admin-test' } : null });
  await app.ready();
  return { app, rows };
}

test('somente admin consulta fichas privadas; flag desligada evita acesso à tabela', async t => {
  const off = await fixture(false); t.after(() => off.app.close());
  assert.equal((await off.app.inject({ method: 'GET', url: '/admin/print3d/status' })).statusCode, 401);
  assert.deepEqual((await off.app.inject({ method: 'GET', url: '/admin/print3d/status', headers })).json(), { enabled: false });
  assert.equal((await off.app.inject({ method: 'GET', url, headers })).statusCode, 503);
  const on = await fixture(); t.after(() => on.app.close());
  assert.equal((await on.app.inject({ method: 'GET', url })).statusCode, 401);
});

test('revisão fica imutável; repetição idêntica é idempotente e alteração gera conflito', async t => {
  const { app, rows } = await fixture(); t.after(() => app.close());
  const first = await app.inject({ method: 'POST', url, headers, payload: await portableDraft() });
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().saved, true);
  const repeated = await app.inject({ method: 'POST', url, headers, payload: await portableDraft() });
  assert.equal(repeated.statusCode, 200, repeated.body);
  assert.equal(repeated.json().saved, false);
  const modified = await portableDraft(); modified.productName = 'Nome alterado';
  assert.equal((await app.inject({ method: 'POST', url, headers, payload: modified })).statusCode, 409);
  const changedCost = await portableDraft(); changedCost.rateSnapshot.energyCentsPerKwh = 200;
  assert.equal((await app.inject({ method: 'POST', url, headers, payload: changedCost })).statusCode, 400);
  assert.equal(rows.size, 1);
  const listing = (await app.inject({ method: 'GET', url, headers })).json();
  assert.equal(listing.recipes.length, 1);
  assert.equal('draft_json' in listing.recipes[0], false);
  const detail = (await app.inject({ method: 'GET', url: `${url}/r1`, headers })).json();
  assert.equal(detail.draft.productId, product.id);
  assert.equal(detail.draft.costSnapshot.batchCents, 430);
});
