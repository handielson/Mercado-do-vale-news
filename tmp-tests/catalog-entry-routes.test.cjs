'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Fastify = require('fastify');
const { registerCatalogEntryRoutes } = require('../services/catalogEntryServer.cjs');
const { fakeDb } = require('./helpers/catalogEntryFakeDb.cjs');

const IMEI = '863715061138763';
const PRICES = { price_retail: 130000, price_reseller: 125000, price_wholesale: 115000 };
const item = (patch = {}) => ({ source: 'manual', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde',
  identity: { imei1: IMEI }, quantity: 1, cost_cents: 95000, location_id: 'L1', prices: PRICES, ...patch });
const H = { 'x-sync-key': 'test', 'x-actor': 'u1' };

async function app(db = fakeDb()) {
  const fastify = Fastify();
  const auth = async (request, reply) => {
    // Igual a requireSyncKeyOrAdmin: não preenche request.user; o autor vem de getActorId.
    if (request.headers['x-sync-key'] !== 'test') return reply.code(401).send({ error: 'Não autorizado' });
  };
  const getActorId = async request => request.headers['x-actor'] || null;
  registerCatalogEntryRoutes(fastify, { pool: db.pool, auth, deps: db.deps, getActorId });
  await fastify.ready();
  return { fastify, db };
}
const post = (fastify, url, payload, headers = H) => fastify.inject({ method: 'POST', url, payload, headers });

test('prévia devolve ok, plan e hash', async () => {
  const { fastify } = await app();
  const res = await post(fastify, '/catalog-entries/preview', { items: [item()] });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true); assert.ok(body.hash); assert.equal(body.plan.length, 1);
});

test('prévia com erro de linha continua 200 com ok:false', async () => {
  const { fastify } = await app();
  const res = await post(fastify, '/catalog-entries/preview', { items: [item({ identity: {} })] });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, false);
  assert.ok(res.json().plan[0].errors.length);
});

test('confirmação com preview_hash certo dá 201 e batch_id, e GET devolve batch e lines', async () => {
  const { fastify, db } = await app();
  const preview = (await post(fastify, '/catalog-entries/preview', { items: [item()] })).json();
  const res = await post(fastify, '/catalog-entries', { items: [item()], preview_hash: preview.hash });
  assert.equal(res.statusCode, 201, res.body);
  const { batch_id, plan } = res.json();
  assert.ok(batch_id); assert.equal(plan.length, 1);
  assert.equal(db.state.batches[0].created_by, 'u1');
  const got = await fastify.inject({ method: 'GET', url: `/catalog-entries/${batch_id}`, headers: H });
  assert.equal(got.statusCode, 200);
  assert.equal(got.json().batch.id, batch_id);
  assert.equal(got.json().lines.length, 1);
});

test('GET de lote inexistente dá 404', async () => {
  const { fastify } = await app();
  const res = await fastify.inject({ method: 'GET', url: '/catalog-entries/nao-existe', headers: H });
  assert.equal(res.statusCode, 404);
});

test('hash errado dá 409', async () => {
  const { fastify } = await app();
  const res = await post(fastify, '/catalog-entries', { items: [item()], preview_hash: 'x' });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, 'O lote mudou desde a conferência. Confira novamente.');
});

test('item inválido na confirmação dá 422 com plan[0].errors', async () => {
  const { fastify, db } = await app();
  const res = await post(fastify, '/catalog-entries', { items: [item({ identity: {} })], preview_hash: 'x' });
  assert.equal(res.statusCode, 422);
  assert.ok(res.json().plan[0].errors.length);
  assert.equal(db.state.batches.length, 0);
});

test('mais de 500 itens dá 400', async () => {
  const { fastify } = await app();
  const items = Array.from({ length: 501 }, () => item());
  for (const url of ['/catalog-entries/preview', '/catalog-entries']) {
    const res = await post(fastify, url, { items });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'Lote acima de 500 itens.');
  }
});

test('items ausente, não-array ou vazio dá 400', async () => {
  const { fastify } = await app();
  for (const payload of [{}, { items: 'x' }, { items: [] }]) {
    const res = await post(fastify, '/catalog-entries/preview', payload);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'Envie a lista de itens.');
  }
});

test('sem auth dá 401 em todas as rotas', async () => {
  const { fastify } = await app();
  assert.equal((await post(fastify, '/catalog-entries/preview', { items: [item()] }, {})).statusCode, 401);
  assert.equal((await post(fastify, '/catalog-entries', { items: [item()] }, {})).statusCode, 401);
  assert.equal((await fastify.inject({ method: 'GET', url: '/catalog-entries/x' })).statusCode, 401);
});

test('vps_server.js e .cjs registram as rotas repassando o db às dependências', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(src.includes("require('./services/catalogEntryServer.cjs').registerCatalogEntryRoutes(fastify"), file);
    assert.ok(src.includes('auth: requireSyncKeyOrAdmin'), file);
    // A prévia cria o local padrão na transação (stockLocationInTransaction), não pelo pool.
    assert.ok(src.includes('(id, db) => syncProductStock(id, db, { stockLocationInTransaction: true })'), file);
    assert.ok(src.includes('(id, db) => syncProductStockFromLocations(id, db)'), file);
    assert.ok(src.includes('(row, db) => insertStockMovement(row, db)'), file);
    assert.ok(!src.includes('findUnitConflict:'), file); // conflito de IMEI/serial agora roda na conexão da transação
    assert.ok(src.includes('getActorId: async (request) => (await getVpsBearerAuthContext(request))?.userId || null'), file);
    assert.ok(src.includes('getDefaultCompanyId: () => getDefaultStockCompanyId()'), file);
  }
});

test('sem getActorId o lote fica com created_by nulo (I6)', async () => {
  const db = fakeDb();
  const fastify = Fastify();
  registerCatalogEntryRoutes(fastify, { pool: db.pool, auth: async () => {}, deps: db.deps });
  await fastify.ready();
  const preview = (await post(fastify, '/catalog-entries/preview', { items: [item()] })).json();
  const res = await post(fastify, '/catalog-entries', { items: [item()], preview_hash: preview.hash });
  assert.equal(res.statusCode, 201, res.body);
  assert.equal(db.state.batches[0].created_by, null);
});

// I1: client_batch_id na rota.
const CID = '0b7c6f1e-4b8a-4c2e-9f00-1234567890ab';
test('client_batch_id inválido dá 400', async () => {
  const { fastify, db } = await app();
  for (const bad of [123, '', 'x'.repeat(37), 'abc def ghi', "1'; DROP"]) {
    const res = await post(fastify, '/catalog-entries', { items: [item()], preview_hash: 'x', client_batch_id: bad });
    assert.equal(res.statusCode, 400, String(bad));
    assert.equal(res.json().error, 'client_batch_id inválido.');
  }
  assert.equal(db.state.batches.length, 0);
});

test('reenvio com o mesmo client_batch_id responde 200 replay sem gravar de novo', async () => {
  const { fastify, db } = await app();
  const preview = (await post(fastify, '/catalog-entries/preview', { items: [item()] })).json();
  const first = await post(fastify, '/catalog-entries', { items: [item()], preview_hash: preview.hash, client_batch_id: CID });
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().replay, undefined);
  const again = await post(fastify, '/catalog-entries', { items: [item()], preview_hash: 'qualquer', client_batch_id: CID });
  assert.equal(again.statusCode, 200, again.body);
  assert.equal(again.json().replay, true);
  assert.equal(again.json().batch_id, first.json().batch_id);
  assert.equal(again.json().plan[0].product_id, db.state.lines[0].product_id);
  assert.equal(db.state.batches.length, 1); assert.equal(db.state.units.length, 1);
});

test('mesmo client_batch_id com outra lista dá 409 com code', async () => {
  const { fastify } = await app();
  const preview = (await post(fastify, '/catalog-entries/preview', { items: [item()] })).json();
  await post(fastify, '/catalog-entries', { items: [item()], preview_hash: preview.hash, client_batch_id: CID });
  const res = await post(fastify, '/catalog-entries', { items: [item({ cost_cents: 1 })], preview_hash: 'x', client_batch_id: CID });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().code, 'client_batch_conflict');
  assert.match(res.json().error, /já foi gravado com outra lista/);
});
