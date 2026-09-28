'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerPrint3dActiveRecipeRoutes } = require('../services/print3dActiveRecipeServer.cjs');

const ids = {
  product: '11111111-1111-4111-8111-111111111111',
  recipe: '22222222-2222-4222-8222-222222222222',
  file: '33333333-3333-4333-8333-333333333333',
  json: '44444444-4444-4444-8444-444444444444',
};
const url = `/admin/print3d/products/${ids.product}/active-recipe`;
const headers = { authorization: 'Bearer admin' };

async function fixture({ enabled = true, sku = 'CHAVEIRO-01', fileKind = 'gcode', hasJson = true, fileRecipeId = ids.recipe, inputSource = 'json' } = {}) {
  const app = Fastify();
  const state = { active: null, commits: 0, rollbacks: 0, released: 0, writes: 0 };
  const query = async (sql, params) => {
    if (sql.includes('FROM products WHERE id=? FOR UPDATE')) return [[{ id: ids.product, sku, is_parent: 0 }]];
    if (sql.includes('FROM print3d_recipe_revisions WHERE id=? AND product_id=?')) {
      return [[{ id: ids.recipe, revision: 'r1', sku_snapshot: 'CHAVEIRO-01', draft_json:JSON.stringify({ printSummary:{ source:inputSource } }) }].filter(() => params[0] === ids.recipe && params[1] === ids.product)];
    }
    if (sql.includes('FROM print3d_recipe_files WHERE id=? AND recipe_id=?')) {
      return [[{ id: ids.file, kind: fileKind, original_name: 'chaveiro.gcode', printer_profile: 'PLA 0.4' }]
        .filter(() => params[0] === ids.file && params[1] === fileRecipeId)];
    }
    if (sql.includes("kind='print-json'")) return [[hasJson ? { id: ids.json } : null].filter(Boolean)];
    if (sql.includes('FROM print3d_active_recipes WHERE product_id=?')) return [[state.active].filter(Boolean)];
    if (sql.startsWith('INSERT INTO print3d_active_recipes')) {
      state.active = { product_id: params[0], recipe_id: params[1], primary_file_id: params[2], selected_by: params[3] };
      state.writes++;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM print3d_active_recipes a')) return [[state.active && {
      ...state.active, revision: 'r1', sku_snapshot: sku, primary_file_kind: fileKind,
      primary_file_name: 'chaveiro.gcode', printer_profile: 'PLA 0.4',
    }].filter(Boolean)];
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const pool = {
    query,
    async getConnection() { return {
      query, async beginTransaction() {},
      async commit() { state.commits++; }, async rollback() { state.rollbacks++; },
      release() { state.released++; },
    }; },
  };
  registerPrint3dActiveRecipeRoutes(app, { pool, enabled, getBearerAuthContext: async req =>
    req.headers.authorization === 'Bearer admin' ? { isAdmin: true, userId: 'admin-test' } : null });
  await app.ready();
  return { app, state };
}

test('seleção é privada e fica desligada com a flag', async t => {
  const { app, state } = await fixture({ enabled: false }); t.after(() => app.close());
  assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url, headers })).statusCode, 503);
  assert.equal((await app.inject({ method: 'POST', url, headers, payload: { recipeId: ids.recipe, primaryFileId: ids.file } })).statusCode, 503);
  assert.equal(state.writes, 0);
});

test('seleciona só arquivo imprimível da revisão com JSON; repetição não regrava', async t => {
  const { app, state } = await fixture(); t.after(() => app.close());
  const payload = { recipeId: ids.recipe, primaryFileId: ids.file };
  assert.equal((await app.inject({ method: 'GET', url, headers })).json().activeRecipe, null);
  const first = await app.inject({ method: 'POST', url, headers, payload });
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().changed, true);
  assert.equal(first.json().activeRecipe.primary_file_name, 'chaveiro.gcode');
  assert.equal(state.writes, 1);
  const repeated = await app.inject({ method: 'POST', url, headers, payload });
  assert.equal(repeated.json().changed, false);
  assert.equal(state.writes, 1);
  assert.equal((await app.inject({ method: 'GET', url, headers })).json().activeRecipe.primary_file_id, ids.file);
  assert.equal(state.commits, 2);
  assert.equal(state.released, 2);
});

test('recusa JSON ausente, arquivo não imprimível, revisão alheia e SKU alterado', async t => {
  for (const options of [{ hasJson: false }, { fileKind: 'preview' }, { fileRecipeId: ids.json }, { sku: 'SKU-NOVO' }]) {
    const { app, state } = await fixture(options); t.after(() => app.close());
    const response = await app.inject({ method: 'POST', url, headers, payload: { recipeId: ids.recipe, primaryFileId: ids.file } });
    assert.equal(response.statusCode, 409, `${JSON.stringify(options)}: ${response.body}`);
    assert.equal(state.writes, 0);
    assert.equal(state.rollbacks, 1);
    assert.equal(state.released, 1);
  }
});

test('seleciona revisão manual sem exigir arquivo JSON separado', async t => {
  const { app, state } = await fixture({ hasJson:false,inputSource:'manual',fileKind:'project' }); t.after(() => app.close());
  const response = await app.inject({ method:'POST',url,headers,payload:{ recipeId:ids.recipe,primaryFileId:ids.file } });
  assert.equal(response.statusCode,200,response.body);
  assert.equal(response.json().changed,true);
  assert.equal(state.writes,1);
});
