'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCatalogEntry, ensureCatalogEntrySchema } = require('../services/catalogEntryServer.cjs');

const IMEI = '863715061138763';
function imei(prefix) { // 14 dígitos + dígito de Luhn
  const body = String(prefix).padEnd(14, '0').slice(0, 14);
  for (let d = 0; d < 10; d++) {
    const t = body + d; let s = 0;
    for (let i = 0; i < 15; i++) { let x = Number(t[14 - i]); if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; }
    if (s % 10 === 0) return t;
  }
}
const PRICES = { price_retail: 130000, price_reseller: 125000, price_wholesale: 115000 };
const phone = (patch = {}) => ({ source: 'manual', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde',
  identity: { imei1: IMEI }, quantity: 1, cost_cents: 95000, location_id: 'L1', ...patch });
const parentRow = { id: 'P', name: 'Redmi Note 14', sku: 'REDM0001', model_id: 'm1', company_id: 'c', parent_id: null, is_parent: 1,
  price_retail: 0, price_reseller: 0, price_wholesale: 0, stock_quantity: 0, specs: '{}' };
const childRow = (patch = {}) => ({ id: 'V', name: 'Redmi Note 14', sku: 'REDM0001-01', model_id: 'm1', company_id: 'c', parent_id: 'P', is_parent: 0,
  price_retail: 130000, price_reseller: 125000, price_wholesale: 115000, stock_quantity: 1,
  specs: JSON.stringify({ ram: '8GB', storage: '256GB', version: 'Global', color: 'Verde' }), ...patch });

const { fakeDb } = require('./helpers/catalogEntryFakeDb.cjs');

async function previewAndCommit(db, items, opts = {}) {
  const preview = await runCatalogEntry(db.pool, items, { commit: false, deps: db.deps, ...opts });
  assert.equal(preview.ok, true, JSON.stringify(preview.plan));
  const result = await runCatalogEntry(db.pool, items, { commit: true, expectedHash: preview.hash, deps: db.deps, ...opts });
  assert.equal(result.ok, true, JSON.stringify(result.plan));
  assert.equal(result.hash, preview.hash);
  return result;
}

test('ensureCatalogEntrySchema cria as duas tabelas', async () => {
  const db = fakeDb();
  await ensureCatalogEntrySchema(db.pool);
  assert.ok(db.log.some(sql => /CREATE TABLE IF NOT EXISTS catalog_entry_batches/.test(sql)));
  assert.ok(db.log.some(sql => /CREATE TABLE IF NOT EXISTS catalog_entry_lines/.test(sql)));
});

test('modelo sem produtos cria pai XXXX0001, variação -01 e unidade', async () => {
  const db = fakeDb();
  const r = await previewAndCommit(db, [phone({ prices: PRICES })]);
  const [line] = r.plan;
  assert.equal(line.family, 'new'); assert.equal(line.variation, 'new'); assert.equal(line.stock.kind, 'unit');
  assert.equal(line.product_id, null); assert.equal(line.sku, 'REDM0001-01');
  const parent = db.state.products.find(p => Number(p.is_parent) === 1);
  assert.equal(parent.sku, 'REDM0001'); assert.equal(Number(parent.stock_quantity), 0);
  assert.equal(JSON.parse(parent.specs).imei1, undefined);
  const child = db.state.products.find(p => !Number(p.is_parent));
  assert.equal(child.parent_id, parent.id); assert.equal(child.sku, 'REDM0001-01');
  assert.equal(db.state.units.length, 1);
  assert.equal(db.state.units[0].status, 'available'); assert.equal(db.state.units[0].deposit_id, 'D1');
  assert.equal(db.state.units[0].product_id, child.id); assert.equal(db.state.units[0].imei_1, IMEI);
  assert.ok(r.batch_id); assert.equal(db.state.batches.length, 1); assert.equal(db.state.lines.length, 1);
  assert.equal(db.calls.syncStock.at(-1), child.id); assert.equal(db.calls.syncStock.length, 2); // prévia + confirmação
  assert.ok(db.log.includes('COMMIT')); assert.ok(db.log.at(-2).includes('RELEASE_LOCK'));
});

test('mesma configuração e cor existente só cria unidade', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await previewAndCommit(db, [phone()]);
  assert.equal(r.plan[0].variation, 'existing'); assert.equal(r.plan[0].family, 'existing');
  assert.equal(r.plan[0].product_id, 'V'); assert.equal(r.plan[0].price_source, 'existing');
  assert.ok(!db.log.some(sql => sql.startsWith('INSERT INTO products')));
  assert.equal(db.state.units.length, 1); assert.equal(db.state.units[0].product_id, 'V');
});

test('cor escrita diferente acha a mesma variação', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await previewAndCommit(db, [phone({ color: 'verde ' })]);
  assert.equal(r.plan[0].variation, 'existing'); assert.equal(r.plan[0].product_id, 'V');
});

test('cor nova em configuração com preço usa o preço do grupo', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await previewAndCommit(db, [phone({ color: 'Azul' })]);
  assert.equal(r.plan[0].variation, 'new'); assert.equal(r.plan[0].price_source, 'group');
  assert.equal(r.plan[0].sku, 'REDM0001-02');
  const created = db.state.products.find(p => p.sku === 'REDM0001-02');
  assert.equal(Number(created.price_retail), 130000); assert.equal(created.parent_id, 'P');
});

test('configuração nova sem prices dá erro na linha; com prices cria o grupo', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const bad = await runCatalogEntry(db.pool, [phone({ configuration: { ram: '8GB', storage: '512GB' } })], { commit: false, deps: db.deps });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.plan[0].errors, ['Configuração sem preço: informe varejo, revenda e atacado.']);
  const r = await previewAndCommit(db, [phone({ configuration: { ram: '8GB', storage: '512GB' }, prices: PRICES })]);
  assert.equal(r.plan[0].price_source, 'group-new'); assert.equal(r.plan[0].variation, 'new');
  assert.equal(db.state.groups.length, 1); assert.equal(db.state.groups[0].price_retail, 130000);
});

test('seminovo da mesma memória do novo vira variação separada', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await previewAndCommit(db, [phone({ configuration: { ram: '8GB', storage: '256GB', condition: 'seminovo' }, prices: PRICES })]);
  assert.equal(r.plan[0].variation, 'new'); assert.equal(r.plan[0].sku, 'REDM0001-02');
  assert.equal(db.state.units[0].condition, 'seminovo');
  assert.notEqual(db.state.units[0].product_id, 'V');
});

test('IMEI já cadastrado em units dá erro e nada é gravado', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  db.deps.conflict = { field: 'imei_1', value: IMEI };
  const r = await runCatalogEntry(db.pool, [phone()], { commit: true, expectedHash: 'qualquer', deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, [`IMEI ${IMEI} já cadastrado.`]);
  assert.ok(db.log.includes('ROLLBACK')); assert.ok(!db.log.includes('COMMIT'));
  assert.equal(db.state.units.length, 0);
});

test('lote com uma linha ruim faz rollback total', async () => {
  const db = fakeDb();
  const items = [phone({ prices: PRICES }), phone({ identity: { imei1: imei('35000000000001') }, location_id: 'nao-existe' })];
  const r = await runCatalogEntry(db.pool, items, { commit: true, expectedHash: 'x', deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, []);
  assert.deepEqual(r.plan[1].errors, ['Local de estoque não encontrado.']);
  assert.ok(db.log.includes('ROLLBACK')); assert.ok(!db.log.includes('COMMIT'));
  assert.equal(db.state.products.length, 0); assert.equal(db.state.units.length, 0); assert.equal(db.state.batches.length, 0);
});

test('acessório com quantidade soma no local', async () => {
  const db = fakeDb();
  const item = { source: 'planilha', model_id: 'm2', color: 'Preta', quantity: 3, cost_cents: 500, location_id: 'L1', prices: { price_retail: 3000, price_reseller: 2500, price_wholesale: 2000 } };
  const first = await previewAndCommit(db, [item]);
  assert.equal(first.plan[0].stock.kind, 'quantity'); assert.equal(first.plan[0].stock.quantity, 3);
  assert.equal(first.plan[0].price_source, 'item'); assert.equal(first.plan[0].family, 'new');
  assert.ok(db.log.some(sql => sql.startsWith('INSERT INTO product_stock_locations')));
  const child = db.state.products.find(p => !Number(p.is_parent));
  assert.equal(child.sku, 'CAPA0001-01'); assert.equal(Number(child.price_retail), 3000);
  assert.equal(db.state.psl[0].quantity, 3); assert.equal(db.state.psl[0].deposit_id, 'D1');
  const mv = db.state.movements[0];
  assert.equal(mv.movement_type, 'in'); assert.equal(mv.reference_type, 'catalog_entry'); assert.equal(mv.reference_id, first.batch_id);
  assert.equal(mv.quantity, 3); assert.equal(mv.previous_to_quantity, 0); assert.equal(mv.new_to_quantity, 3);
  assert.equal(db.calls.syncLocations.at(-1), child.id); assert.equal(db.calls.syncLocations.length, 2); // prévia + confirmação
  const second = await previewAndCommit(db, [{ ...item, prices: undefined, quantity: 2 }]);
  assert.equal(second.plan[0].variation, 'existing'); assert.equal(second.plan[0].price_source, 'existing');
  assert.equal(db.state.psl.length, 1); assert.equal(db.state.psl[0].quantity, 5);
  assert.equal(db.state.units.length, 0);
});

test('acessório novo sem prices dá erro na linha', async () => {
  const db = fakeDb();
  const r = await runCatalogEntry(db.pool, [{ source: 'manual', model_id: 'm2', quantity: 1, location_id: 'L1' }], { commit: false, deps: db.deps });
  assert.deepEqual(r.plan[0].errors, ['Informe varejo, revenda e atacado do produto novo.']);
});

test('produto simples por categoria e nome é criado e depois reencontrado', async () => {
  const db = fakeDb();
  const item = { source: 'manual', category_id: 'cat-acc', name: 'Cabo USB-C', quantity: 4, location_id: 'L1', prices: { price_retail: 2000, price_reseller: 1500, price_wholesale: 1000 } };
  const r = await previewAndCommit(db, [item]);
  assert.equal(r.plan[0].sku, 'CUSB0001'); assert.equal(r.plan[0].variation, 'new');
  assert.equal(db.state.products.length, 1); assert.equal(db.state.products[0].parent_id ?? null, null);
  const again = await previewAndCommit(db, [{ ...item, name: 'cabo usb-c', prices: undefined }]);
  assert.equal(again.plan[0].variation, 'existing'); assert.equal(db.state.psl[0].quantity, 8);
});

test('duas linhas da mesma variação nova no lote: segunda reaproveita sem id aleatório no plano', async () => {
  const db = fakeDb();
  const r = await previewAndCommit(db, [phone({ prices: PRICES }), phone({ identity: { imei1: imei('35000000000001') } })]);
  assert.equal(r.plan[1].product_id, null); assert.equal(r.plan[1].sku, 'REDM0001-01');
  assert.equal(db.state.products.length, 2); assert.equal(db.state.units.length, 2);
});

test('prévia não grava nada', async () => {
  const db = fakeDb();
  const r = await runCatalogEntry(db.pool, [phone({ prices: PRICES })], { commit: false, deps: db.deps });
  assert.equal(r.ok, true); assert.match(r.hash, /^[0-9a-f]{64}$/); assert.equal(r.batch_id, undefined);
  assert.ok(db.log.includes('ROLLBACK')); assert.ok(!db.log.includes('COMMIT'));
  assert.equal(db.state.products.length, 0); assert.equal(db.state.units.length, 0); assert.equal(db.state.groups.length, 0);
  assert.ok(db.log.some(sql => /RELEASE_LOCK/.test(sql)));
});

test('hash diferente na confirmação devolve 409', async () => {
  const db = fakeDb();
  await assert.rejects(runCatalogEntry(db.pool, [phone({ prices: PRICES })], { commit: true, expectedHash: 'x', deps: db.deps }),
    e => e.statusCode === 409 && e.message === 'O lote mudou desde a conferência. Confira novamente.');
  assert.ok(db.log.includes('ROLLBACK')); assert.equal(db.state.products.length, 0);
});

test('celular sem armazenamento vira erro da linha (409 do grupo de preço)', async () => {
  const db = fakeDb();
  const r = await runCatalogEntry(db.pool, [phone({ configuration: { ram: '8GB' }, prices: PRICES })], { commit: false, deps: db.deps });
  assert.equal(r.ok, false); assert.match(r.plan[0].errors[0], /armazenamento/);
  assert.equal(r.plan[0].sku, null);
});

test('erro inesperado do banco propaga depois do ROLLBACK', async () => {
  const db = fakeDb();
  db.deps.syncProductStock = async () => { throw Object.assign(new Error('falha de conexão'), { code: 'ECONNRESET' }); };
  await assert.rejects(runCatalogEntry(db.pool, [phone({ prices: PRICES })], { commit: false, deps: db.deps }), /falha de conexão/);
  assert.ok(db.log.includes('ROLLBACK')); assert.equal(db.state.products.length, 0);
  assert.equal(db.log.at(-1), 'RELEASE');
});
