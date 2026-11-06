'use strict';
// Entrada única — produto por quantidade vinculado ao Bling recebe estoque pela nota fiscal no Bling
// (o webhook de estoque do Bling sobrescreve o saldo do MDV). Celular/IMEI/serial não é afetado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCatalogEntry, BLING_QUANTITY_STOCK_OWNER } = require('../services/catalogEntryServer.cjs');
const { fakeDb } = require('./helpers/catalogEntryFakeDb.cjs');

const BLING_ERROR = 'Este produto recebe estoque pela nota fiscal no Bling. Dê entrada por lá.';
const IMEI = '863715061138763';
const parentRow = { id: 'P', name: 'Redmi Note 14', sku: 'REDM0001', model_id: 'm1', company_id: 'c', parent_id: null, is_parent: 1,
  price_retail: 0, price_reseller: 0, price_wholesale: 0, stock_quantity: 0, specs: '{}', status: 'active' };
const phoneRow = (patch = {}) => ({ id: 'V', name: 'Redmi Note 14 - REDM0001-01', sku: 'REDM0001-01', model_id: 'm1', company_id: 'c', parent_id: 'P',
  is_parent: 0, price_retail: 130000, price_reseller: 125000, price_wholesale: 115000, stock_quantity: 0, status: 'active',
  specs: JSON.stringify({ ram: '8GB', storage: '256GB', version: 'Global', color: 'Verde' }), ...patch });
const capaRow = (patch = {}) => ({ id: 'A1', name: 'Capa Avulsa - CAPA0001', sku: 'CAPA0001', model_id: null, category_id: 'cat-acc', company_id: 'c',
  parent_id: null, is_parent: 0, price_retail: 3000, price_reseller: 2500, price_wholesale: 2000, stock_quantity: 2, status: 'active',
  specs: '{}', ...patch });
const capaParent = { id: 'P2', name: 'Capa Silicone', sku: 'CAPA0001', model_id: 'm2', company_id: 'c', parent_id: null, is_parent: 1,
  price_retail: 0, price_reseller: 0, price_wholesale: 0, stock_quantity: 0, specs: '{}' };
const capaChild = (patch = {}) => ({ id: 'V2', name: 'Capa Silicone - CAPA0001-01', sku: 'CAPA0001-01', model_id: 'm2', company_id: 'c', parent_id: 'P2',
  is_parent: 0, price_retail: 3000, price_reseller: 2500, price_wholesale: 2000, stock_quantity: 5, specs: JSON.stringify({ color: 'Preta' }), ...patch });
const PRICES = { price_retail: 3000, price_reseller: 2500, price_wholesale: 2000 };

async function previewAndCommit(db, items) {
  const preview = await runCatalogEntry(db.pool, items, { commit: false, deps: db.deps });
  assert.equal(preview.ok, true, JSON.stringify(preview.plan));
  const result = await runCatalogEntry(db.pool, items, { commit: true, expectedHash: preview.hash, deps: db.deps });
  assert.equal(result.ok, true, JSON.stringify(result.plan));
  return { preview, result };
}

function assertNothingWritten(db) {
  assert.equal(db.state.psl.length, 0); assert.equal(db.state.movements.length, 0);
  assert.equal(db.state.units.length, 0); assert.equal(db.state.batches.length, 0); assert.equal(db.state.lines.length, 0);
  assert.equal(db.calls.syncLocations.length, 0);
  assert.ok(!db.log.some(sql => /^\s*INSERT INTO products/.test(sql)));
  assert.ok(!db.log.includes('COMMIT'));
}

test('a regra fica atrás de uma única constante ligada', () => {
  assert.equal(BLING_QUANTITY_STOCK_OWNER, true);
});

test('produto do Bling por quantidade via product_id: erro da linha e nada é gravado', async () => {
  const db = fakeDb({ products: [capaRow({ bling_id: '16000000001' })] });
  const item = { source: 'atalho', product_id: 'A1', quantity: 3, cost_cents: 800, location_id: 'L1' };
  const r = await runCatalogEntry(db.pool, [item], { commit: true, expectedHash: 'x', deps: db.deps });
  assert.equal(r.ok, false);
  assert.equal(r.plan[0].stock.kind, 'quantity');
  assert.deepEqual(r.plan[0].errors, [BLING_ERROR]);
  assert.equal(r.plan[0].product_id, null);
  assertNothingWritten(db);
});

test('produto do Bling por quantidade com saldo por local: mesmo erro, saldo intacto', async () => {
  const psl = [{ id: 'S1', company_id: 'c', product_id: 'A1', deposit_id: 'D1', location_id: 'L1', quantity: 2, reserved_quantity: 0 }];
  const db = fakeDb({ products: [capaRow({ bling_id: '16000000001' })], psl });
  const r = await runCatalogEntry(db.pool, [{ source: 'atalho', product_id: 'A1', quantity: 3, location_id: 'L1' }], { commit: false, deps: db.deps });
  assert.deepEqual(r.plan[0].errors, [BLING_ERROR]);
  assert.equal(db.state.psl[0].quantity, 2); assert.equal(db.state.movements.length, 0);
  // Linha com serial nesse produto: o motivo real (Bling) vem antes do "ajuste a linha".
  const r2 = await runCatalogEntry(db.pool, [{ source: 'atalho', product_id: 'A1', identity: { serial: 'SN1' }, quantity: 1, location_id: 'L1' }],
    { commit: false, deps: db.deps });
  assert.deepEqual(r2.plan[0].errors, [BLING_ERROR]);
  assert.equal(db.state.units.length, 0);
});

test('variação existente do Bling resolvida por modelo (sem celular): erro da linha', async () => {
  const db = fakeDb({ products: [capaParent, capaChild({ bling_id: '16000000002' })] });
  const item = { source: 'manual', model_id: 'm2', color: 'Preta', quantity: 2, location_id: 'L1' };
  const r = await runCatalogEntry(db.pool, [item], { commit: true, expectedHash: 'x', deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, [BLING_ERROR]);
  assertNothingWritten(db);
});

test('produto simples do Bling resolvido por categoria e nome: erro da linha', async () => {
  const db = fakeDb({ products: [capaRow({ name: 'Capa Avulsa', bling_id: '16000000003' })] });
  const item = { source: 'manual', category_id: 'cat-acc', name: 'Capa Avulsa', quantity: 4, location_id: 'L1' };
  const r = await runCatalogEntry(db.pool, [item], { commit: false, deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, [BLING_ERROR]);
  assert.equal(db.state.psl.length, 0);
});

test('celular do Bling com IMEI passa (estoque por aparelho)', async () => {
  const db = fakeDb({ products: [parentRow, phoneRow({ bling_id: '16000000004' })] });
  const { result } = await previewAndCommit(db, [{ source: 'atalho', product_id: 'V', identity: { imei1: IMEI }, quantity: 1, location_id: 'L1' }]);
  assert.equal(result.plan[0].stock.kind, 'unit'); assert.deepEqual(result.plan[0].errors, []);
  assert.equal(db.state.units.length, 1);
  // Mesmo pelo modelo (variação existente com bling_id).
  const viaModel = fakeDb({ products: [parentRow, phoneRow({ bling_id: '16000000004' })] });
  await previewAndCommit(viaModel, [{ source: 'manual', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde',
    identity: { imei1: IMEI }, quantity: 1, location_id: 'L1' }]);
  assert.equal(viaModel.state.units.length, 1);
});

test('acessório do Bling com serial (estoque por aparelho) passa', async () => {
  const db = fakeDb({ products: [capaRow({ bling_id: '16000000005' })] });
  await previewAndCommit(db, [{ source: 'atalho', product_id: 'A1', identity: { serial: 'SN1' }, quantity: 1, location_id: 'L1' }]);
  assert.equal(db.state.units.length, 1);
});

test('produto por quantidade sem bling_id passa', async () => {
  const db = fakeDb({ products: [capaRow()] });
  const { result } = await previewAndCommit(db, [{ source: 'atalho', product_id: 'A1', quantity: 3, location_id: 'L1' }]);
  assert.equal(result.plan[0].stock.kind, 'quantity');
  assert.equal(db.state.psl[0].quantity, 3);
  const empty = fakeDb({ products: [capaRow({ bling_id: '' })] });
  await previewAndCommit(empty, [{ source: 'atalho', product_id: 'A1', quantity: 1, location_id: 'L1' }]);
  assert.equal(empty.state.psl[0].quantity, 1);
});

test('produto novo criado pelo lote (sem bling_id) passa', async () => {
  const db = fakeDb();
  await previewAndCommit(db, [{ source: 'manual', model_id: 'm2', color: 'Azul', quantity: 2, location_id: 'L1', prices: PRICES }]);
  assert.equal(db.state.psl[0].quantity, 2);
});

test('lote com uma linha do Bling e outra comum: só a do Bling recebe o erro', async () => {
  const db = fakeDb({ products: [capaRow({ bling_id: '16000000001' }), capaRow({ id: 'A2', sku: 'CAPA0002', name: 'Capa Lisa - CAPA0002' })] });
  const r = await runCatalogEntry(db.pool, [{ source: 'atalho', product_id: 'A1', quantity: 1, location_id: 'L1' },
    { source: 'atalho', product_id: 'A2', quantity: 1, location_id: 'L1' }], { commit: false, deps: db.deps });
  assert.deepEqual(r.plan.map(l => l.errors), [[BLING_ERROR], []]);
});
