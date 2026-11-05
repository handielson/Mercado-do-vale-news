'use strict';
// Etapa 4 (aba Foto): a linha com photo_intake_id finaliza o pré-cadastro pela porta única.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Fastify = require('fastify');
const { runCatalogEntry, registerCatalogEntryRoutes } = require('../services/catalogEntryServer.cjs');
const { registerSmartphonePhotoIntakeRoutes } = require('../services/smartphonePhotoIntakeServer.cjs');
const { fakeDb } = require('./helpers/catalogEntryFakeDb.cjs');

const IMEI = '863715061138763';
const IMEI_B = '356938035643809';
const ALREADY = 'Este aparelho da fila de foto já foi salvo.';
const PRICES = { price_retail: 130000, price_reseller: 125000, price_wholesale: 115000 };

const intake = (patch = {}) => ({ id: 'I1', company_id: 'c', status: 'ready_to_finalize', matched_model_id: 'm1', matched_brand_id: null,
  matched_color_id: 'green', matched_product_id: null, detected_brand: 'Xiaomi', detected_model: 'Redmi Note 14', detected_color: 'Verde',
  detected_ram: '8GB', detected_storage: '256GB', detected_imei_1: IMEI, detected_imei_2: null, detected_serial: null,
  detected_ean: '7890000000017', prices_confirmed: 1, review_confirmed: 0, price_cost: 95000, ...PRICES,
  validation_errors: '[]', validation_warnings: '[]', extracted_data: JSON.stringify({ commercial_version: 'Global' }),
  photo_private_path: 'smartphone-intakes/c/I1.jpg', photo_sha256: 'hash', unit_id: null, ...patch });
const photoLine = (patch = {}) => ({ source: 'foto', photo_intake_id: 'I1', label: 'Xiaomi · Redmi Note 14', location_id: 'L1', ...patch });
const manualLine = (patch = {}) => ({ source: 'manual', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde',
  identity: { imei1: IMEI_B }, quantity: 1, cost_cents: 95000, location_id: 'L1', prices: PRICES, ...patch });

async function setup(t, seed = {}) {
  const db = fakeDb({ intakes: [intake()], ...seed });
  const app = Fastify();
  t.after(() => app.close());
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-photo-entry-'));
  const photo = registerSmartphonePhotoIntakeRoutes(app, { pool: db.pool, requireSyncKey: async () => {},
    inventoryCostSync: async () => {}, baseDir });
  db.deps.finalizePhotoIntake = photo.finalizePhotoIntake;
  return { db, app, photo };
}

const preview = (db, items, opts = {}) => runCatalogEntry(db.pool, items, { commit: false, deps: db.deps, ...opts });
async function previewAndCommit(db, items, opts = {}) {
  const p = await preview(db, items, opts);
  assert.equal(p.ok, true, JSON.stringify(p.plan));
  const r = await runCatalogEntry(db.pool, items, { commit: true, expectedHash: p.hash, deps: db.deps, ...opts });
  assert.equal(r.ok, true, JSON.stringify(r.plan));
  assert.equal(r.hash, p.hash);
  return r;
}
const children = db => db.state.products.filter(p => !Number(p.is_parent));

test('registerSmartphonePhotoIntakeRoutes devolve ensureSchema e finalizePhotoIntake', async t => {
  const { photo } = await setup(t);
  assert.equal(typeof photo.ensureSchema, 'function');
  assert.equal(typeof photo.finalizePhotoIntake, 'function');
});

test('prévia da linha de foto devolve PlanLine sem erro e não altera o pré-cadastro', async t => {
  const { db } = await setup(t);
  const r = await preview(db, [photoLine()]);
  assert.equal(r.ok, true, JSON.stringify(r.plan));
  const [line] = r.plan;
  assert.deepEqual(line.errors, []);
  assert.equal(line.family, 'new');
  assert.equal(line.variation, 'new');
  assert.equal(line.price_source, 'photo');
  assert.equal(line.photo_intake_id, 'I1');
  assert.deepEqual(line.stock, { kind: 'unit', quantity: 1 });
  assert.ok(line.sku);
  assert.equal(line.product_id, null);
  assert.equal(db.state.intakes[0].status, 'ready_to_finalize');
  assert.equal(db.state.intakes[0].unit_id, null);
  assert.equal(db.state.units.length, 0);
  assert.equal(db.state.products.length, 0);
  assert.ok(db.log.includes('ROLLBACK'));
});

test('confirmação conclui o pré-cadastro e cria a unidade com intake_id e local', async t => {
  const { db } = await setup(t);
  const r = await previewAndCommit(db, [photoLine()]);
  const it = db.state.intakes[0];
  assert.equal(it.status, 'completed');
  assert.equal(db.state.units.length, 1);
  const unit = db.state.units[0];
  assert.equal(unit.intake_id, 'I1');
  assert.equal(unit.intake_photo_path, 'smartphone-intakes/c/I1.jpg');
  assert.equal(unit.location_id, 'L1');
  assert.equal(unit.deposit_id, 'D1');
  assert.equal(unit.imei_1, IMEI);
  assert.equal(it.unit_id, unit.id);
  const [variation] = children(db);
  assert.equal(unit.product_id, variation.id);
  assert.equal(r.plan[0].sku, variation.sku);
  assert.ok(db.calls.syncStock.includes(variation.id), 'sincroniza o estoque por local');
  assert.equal(db.state.batches.length, 1);
  assert.equal(db.state.batches[0].source, 'foto');
  assert.equal(db.state.lines.length, 1);
  assert.equal(db.state.lines[0].unit_id, unit.id);
  assert.equal(db.state.lines[0].family_created, 1);
  assert.equal(db.state.lines[0].variation_created, 1);
});

test('linha de foto ignora os demais campos do cliente', async t => {
  const { db } = await setup(t);
  await previewAndCommit(db, [photoLine({ model_id: 'm2', color: 'Azul', identity: { imei1: IMEI_B }, prices: { price_retail: 1 }, quantity: 5, cost_cents: 'x' })]);
  assert.equal(db.state.units.length, 1);
  assert.equal(db.state.units[0].imei_1, IMEI);
  assert.equal(children(db)[0].model_id, 'm1');
});

test('sem local, a linha de foto dá erro (como as outras origens) e nada é gravado', async t => {
  const { db } = await setup(t);
  for (const location_id of [undefined, '', '   ']) {
    const p = await preview(db, [photoLine({ location_id })]);
    assert.equal(p.ok, false);
    assert.deepEqual(p.plan[0].errors, ['Escolha o local de estoque.']);
    const r = await runCatalogEntry(db.pool, [photoLine({ location_id })], { commit: true, expectedHash: p.hash, deps: db.deps });
    assert.equal(r.ok, false);
    assert.deepEqual(r.plan[0].errors, ['Escolha o local de estoque.']);
  }
  assert.equal(db.state.units.length, 0);
  assert.equal(db.state.products.length, 0);
  assert.equal(db.state.intakes[0].status, 'ready_to_finalize');
});

test('photo_intake_id só com espaços não derruba o servidor: vira linha comum com erros de linha', async t => {
  const { db } = await setup(t);
  const r = await preview(db, [photoLine({ photo_intake_id: '   ' })]);
  assert.equal(r.ok, false);
  assert.equal(r.plan[0].photo_intake_id, undefined);
  assert.ok(r.plan[0].errors.includes('Informe o modelo ou a categoria e o nome.'), JSON.stringify(r.plan[0].errors));
  assert.equal(db.state.intakes[0].status, 'ready_to_finalize');
});

test('sem SKU livre para a variação: 409 vira erro da linha', async t => {
  const { db } = await setup(t);
  const conn = await db.pool.getConnection();
  const query = conn.query;
  conn.query = async (sql, args) => (String(sql).startsWith('SELECT id FROM products WHERE sku=? LIMIT 1 FOR UPDATE') ? [[{ id: 'ocupado' }]] : query(sql, args));
  const r = await preview(db, [photoLine()]);
  assert.deepEqual(r.plan[0].errors, ['Não foi possível gerar um SKU único para esta variação']);
  assert.equal(db.state.units.length, 0);
});

test('variação sumiu ao anexar o EAN: 409 vira erro da linha', async t => {
  const { db } = await setup(t);
  const conn = await db.pool.getConnection();
  const query = conn.query;
  conn.query = async (sql, args) => (String(sql).startsWith('SELECT ean,alternative_eans FROM products WHERE id=?') ? [[]] : query(sql, args));
  const r = await preview(db, [manualLine(), photoLine()]);
  assert.deepEqual(r.plan[0].errors, []);
  assert.deepEqual(r.plan[1].errors, ['A variação selecionada não existe mais.']);
});

test('pré-cadastro já concluído vira erro da linha', async t => {
  const { db } = await setup(t, { intakes: [intake({ status: 'completed', unit_id: 'U-old', matched_product_id: 'X' })] });
  const r = await preview(db, [photoLine()]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, [ALREADY]);
});

test('concluído sem unidade também vira erro da linha (não finaliza de novo)', async t => {
  const { db } = await setup(t, { intakes: [intake({ status: 'completed', unit_id: null })] });
  const r = await preview(db, [photoLine()]);
  assert.deepEqual(r.plan[0].errors, [ALREADY]);
  assert.equal(db.state.units.length, 0);
});

test('mesmo photo_intake_id em duas linhas: erro na segunda e nada gravado', async t => {
  const { db } = await setup(t);
  const items = [photoLine(), photoLine()];
  const p = await preview(db, items);
  assert.equal(p.ok, false);
  assert.deepEqual(p.plan[0].errors, []);
  assert.deepEqual(p.plan[1].errors, [ALREADY]);
  const r = await runCatalogEntry(db.pool, items, { commit: true, expectedHash: p.hash, deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[1].errors, [ALREADY]);
  assert.equal(db.state.units.length, 0);
  assert.equal(db.state.products.length, 0);
  assert.equal(db.state.batches.length, 0);
  assert.equal(db.state.intakes[0].status, 'ready_to_finalize');
});

test('preços não confirmados viram erro da linha', async t => {
  const { db } = await setup(t, { intakes: [intake({ prices_confirmed: 0 })] });
  const r = await preview(db, [photoLine()]);
  assert.deepEqual(r.plan[0].errors, ['Confirme os preços antes de salvar']);
  assert.equal(r.plan[0].family, null);
  assert.equal(r.plan[0].price_source, null);
});

test('pré-cadastro inexistente e excluído viram erro da linha', async t => {
  const { db } = await setup(t, { intakes: [intake({ id: 'I2', status: 'cancelled' })] });
  const r = await preview(db, [photoLine({ photo_intake_id: 'nope' }), photoLine({ photo_intake_id: 'I2' })]);
  assert.deepEqual(r.plan[0].errors, ['Pré-cadastro não encontrado']);
  assert.deepEqual(r.plan[1].errors, ['Este registro foi excluído da fila']);
});

test('local inexistente vira erro da linha', async t => {
  const { db } = await setup(t);
  const r = await preview(db, [photoLine({ location_id: 'L-nope' })]);
  assert.deepEqual(r.plan[0].errors, ['Local de estoque não encontrado.']);
});

test('lote misto foto + manual do mesmo modelo/cor/memória cria uma variação só (foto primeiro)', async t => {
  const { db } = await setup(t);
  const r = await previewAndCommit(db, [photoLine(), manualLine()]);
  assert.equal(children(db).length, 1, JSON.stringify(children(db)));
  assert.equal(db.state.products.filter(p => Number(p.is_parent) === 1).length, 1);
  assert.equal(db.state.units.length, 2);
  assert.equal(new Set(db.state.units.map(u => u.product_id)).size, 1);
  assert.equal(r.plan[1].variation, 'existing');
});

test('lote misto foto + manual do mesmo modelo/cor/memória cria uma variação só (manual primeiro)', async t => {
  const { db } = await setup(t);
  const r = await previewAndCommit(db, [manualLine(), photoLine()]);
  assert.equal(children(db).length, 1, JSON.stringify(children(db)));
  assert.equal(db.state.products.filter(p => Number(p.is_parent) === 1).length, 1);
  assert.equal(db.state.units.length, 2);
  assert.equal(new Set(db.state.units.map(u => u.product_id)).size, 1);
  assert.equal(r.plan[1].variation, 'existing');
  assert.equal(r.plan[1].price_source, 'photo');
  assert.equal(r.plan[1].product_id, null, 'produto criado no lote não expõe id instável');
});

test('o hash do lote inclui photo_intake_id', async t => {
  const { db } = await setup(t, { intakes: [intake(), intake({ id: 'I2', photo_private_path: 'smartphone-intakes/c/I2.jpg' })] });
  const p = await preview(db, [photoLine()]);
  assert.equal(p.ok, true);
  await assert.rejects(runCatalogEntry(db.pool, [photoLine({ photo_intake_id: 'I2' })], { commit: true, expectedHash: p.hash, deps: db.deps }),
    error => error.statusCode === 409);
  assert.equal(db.state.intakes[1].status, 'ready_to_finalize');
});

test('editar o pré-cadastro entre a prévia e a confirmação dá 409', async t => {
  const { db } = await setup(t);
  const p = await preview(db, [photoLine()]);
  assert.equal(p.ok, true, JSON.stringify(p.plan));
  assert.match(p.plan[0].photo_intake_digest, /^[0-9a-f]{64}$/);
  db.state.intakes[0].price_retail = 140000; // edição na tela antiga
  await assert.rejects(runCatalogEntry(db.pool, [photoLine()], { commit: true, expectedHash: p.hash, deps: db.deps }),
    error => error.statusCode === 409);
  assert.equal(db.state.intakes[0].status, 'ready_to_finalize');
  assert.equal(db.state.units.length, 0);
});

test('o lote trava todos os pré-cadastros em ordem antes de qualquer linha', async t => {
  const { db } = await setup(t, { intakes: [intake(), intake({ id: 'I0', detected_imei_1: IMEI_B, photo_private_path: 'smartphone-intakes/c/I0.jpg' })] });
  await preview(db, [photoLine(), photoLine({ photo_intake_id: 'I0' })]);
  const norm = db.log.map(sql => sql.replace(/\s+/g, ' ').trim());
  const lock = norm.findIndex(sql => sql === 'SELECT id FROM smartphone_photo_intakes WHERE id IN (?) ORDER BY id FOR UPDATE');
  const begin = norm.indexOf('BEGIN');
  const firstLine = norm.findIndex(sql => sql.startsWith('SELECT * FROM smartphone_photo_intakes WHERE id=?'));
  const firstModel = norm.findIndex(sql => /FROM models/.test(sql));
  assert.ok(begin >= 0 && lock > begin, 'trava depois do BEGIN');
  assert.ok(lock < firstLine && lock < firstModel, 'trava antes de qualquer linha e de qualquer modelo');
  assert.equal(norm.filter(sql => sql.includes('WHERE id IN (?) ORDER BY id FOR UPDATE')).length, 1);
});

test('linha de foto com vínculo Bling valida o filho sem repassar authorization nem cookie', async t => {
  const { buildBlingFamily, saveIntakeBlingMapping } = await import('../services/modelBlingMapping.mjs');
  const row = intake();
  const family = saveIntakeBlingMapping(buildBlingFamily({ id: 100, codigo: 'PAI', nome: 'Redmi Note 14' }, [{ id: 101, codigo: 'FILHO', nome: 'Verde' }]), row, 101);
  const base = fakeDb().state.models;
  const models = base.map(m => (m.id === 'm1' ? { ...m, template_values: JSON.stringify({ bling_family: family }) } : m));
  const { db, app } = await setup(t, { models, intakes: [row] });
  const seen = [];
  app.get('/api/bling', async request => {
    seen.push({ ...request.headers });
    return { data: { id: 101, codigo: 'FILHO', situacao: 'A', variacao: { produtoPai: { id: 100 } } } };
  });
  const headers = { authorization: 'Bearer sessao', cookie: 'sid=1', 'x-sync-key': 'chave' };
  const r = await previewAndCommit(db, [photoLine()], { requestHeaders: headers });
  assert.deepEqual(r.plan[0].errors, []);
  assert.equal(seen.length, 2, 'prévia e confirmação validam o filho');
  for (const h of seen) {
    assert.equal(h.authorization, undefined);
    assert.equal(h.cookie, undefined);
    assert.equal(h['x-sync-key'], 'chave');
  }
  const [variation] = children(db);
  assert.equal(variation.sku, 'FILHO');
  assert.equal(String(variation.bling_id), '101');
  assert.equal(String(variation.bling_parent_id), '100');
  assert.equal(db.state.intakes[0].status, 'completed');
});

test('requestHeaders chega a finalizePhotoIntake como headers', async t => {
  const { db } = await setup(t);
  const seen = [];
  const real = db.deps.finalizePhotoIntake;
  db.deps.finalizePhotoIntake = async (conn, id, options) => { seen.push(options); return real(conn, id, options); };
  await preview(db, [photoLine()], { requestHeaders: { 'x-sync-key': 'k' } });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].headers, { 'x-sync-key': 'k' });
  assert.equal(seen[0].locationId, 'L1');
});

test('rotas da porta única repassam os cabeçalhos da requisição', async t => {
  const db = fakeDb({ intakes: [intake()] });
  const app = Fastify();
  t.after(() => app.close());
  const seen = [];
  db.deps.finalizePhotoIntake = async (conn, id, options) => {
    seen.push(options.headers?.['x-probe']);
    throw Object.assign(new Error('Confirme os preços antes de salvar'), { statusCode: 409 });
  };
  registerCatalogEntryRoutes(app, { pool: db.pool, auth: async () => {}, deps: db.deps });
  const response = await app.inject({ method: 'POST', url: '/catalog-entries/preview', headers: { 'x-probe': 'abc' }, payload: { items: [photoLine()] } });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().plan[0].errors, ['Confirme os preços antes de salvar']);
  const committed = await app.inject({ method: 'POST', url: '/catalog-entries', headers: { 'x-probe': 'def' }, payload: { items: [photoLine()], preview_hash: 'x' } });
  assert.equal(committed.statusCode, 422, committed.body);
  assert.deepEqual(seen, ['abc', 'def']);
});

test('rota antiga de finalização responde igual', async t => {
  const { db, app } = await setup(t, { intakes: [intake(), intake({ id: 'I2', prices_confirmed: 0 })] });
  const finalize = id => app.inject({ method: 'POST', url: `/smartphone-photo-intakes/${id}/finalize`, payload: {} });
  const missing = await finalize('nope');
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.json(), { error: 'Pré-cadastro não encontrado' });
  const unconfirmed = await finalize('I2');
  assert.equal(unconfirmed.statusCode, 409);
  assert.deepEqual(unconfirmed.json(), { error: 'Confirme os preços antes de salvar' });
  const ok = await finalize('I1');
  assert.equal(ok.statusCode, 200, ok.body);
  const body = ok.json();
  assert.deepEqual(Object.keys(body), ['intake', 'product_id', 'parent_id', 'unit_id', 'idempotent']);
  assert.equal(body.idempotent, false);
  assert.equal(body.intake.status, 'completed');
  assert.equal(body.intake.photo_private_path, undefined, 'resposta pública');
  assert.equal(db.state.units[0].location_id, null);
  assert.ok(db.log.includes('COMMIT'));
  const again = await finalize('I1');
  assert.equal(again.statusCode, 200);
  assert.deepEqual(Object.keys(again.json()), ['intake', 'product_id', 'unit_id', 'idempotent']);
  assert.equal(again.json().idempotent, true);
  assert.equal(again.json().unit_id, body.unit_id);
  assert.equal(db.state.units.length, 1);
});

test('vps_server.js e vps_server.cjs repassam finalizePhotoIntake à porta única', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(source, /const photoIntakeRoutes = registerSmartphonePhotoIntakeRoutes\(fastify, \{ pool, requireSyncKey, baseDir: __dirname \}\);/, file);
    assert.match(source, /registerCatalogEntryRoutes\(fastify, \{[^\n]*deps: \{[^\n]*finalizePhotoIntake: photoIntakeRoutes\.finalizePhotoIntake/, file);
    assert.match(source, /registerCatalogEntryRoutes\(fastify, \{[^\n]*ensurePhotoIntakeSchema: photoIntakeRoutes\.ensureSchema/, file);
  }
  const entry = fs.readFileSync(path.join(__dirname, '..', 'services', 'catalogEntryServer.cjs'), 'utf8');
  assert.equal((entry.match(/requestHeaders: request\.headers/g) || []).length, 2, 'prévia e confirmação repassam request.headers');
});
