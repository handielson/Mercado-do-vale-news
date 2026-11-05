'use strict';
// Entrada única — linha com product_id (atalhos "Adicionar Unidade" / variação fixa).
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCatalogEntry } = require('../services/catalogEntryServer.cjs');
const { normalizeEntryItem, validateEntryBatch } = require('../services/catalogEntryCore.cjs');
const { fakeDb } = require('./helpers/catalogEntryFakeDb.cjs');

const IMEI = '863715061138763';
const IMEI_B = '356938035643809';
const PRICES = { price_retail: 999900, price_reseller: 899900, price_wholesale: 799900 };
const parentRow = { id: 'P', name: 'Redmi Note 14', sku: 'REDM0001', model_id: 'm1', company_id: 'c', parent_id: null, is_parent: 1,
  price_retail: 0, price_reseller: 0, price_wholesale: 0, stock_quantity: 0, specs: '{}', status: 'active' };
const childRow = (patch = {}) => ({ id: 'V', name: 'Redmi Note 14 - REDM0001-01', sku: 'REDM0001-01', model_id: 'm1', company_id: 'c', parent_id: 'P',
  is_parent: 0, price_retail: 130000, price_reseller: 125000, price_wholesale: 115000, stock_quantity: 0, status: 'active',
  specs: JSON.stringify({ ram: '8GB', storage: '256GB', version: 'Global', color: 'Verde' }), ...patch });
const capaRow = (patch = {}) => ({ id: 'A1', name: 'Capa Avulsa - CAPA0001', sku: 'CAPA0001', model_id: null, category_id: 'cat-acc', company_id: 'c',
  parent_id: null, is_parent: 0, price_retail: 3000, price_reseller: 2500, price_wholesale: 2000, stock_quantity: 2, status: 'active',
  specs: '{}', ...patch });
const byId = (item = {}) => ({ source: 'atalho', product_id: 'V', identity: { imei1: IMEI }, quantity: 1, cost_cents: 95000, location_id: 'L1', ...item });

async function previewAndCommit(db, items) {
  const preview = await runCatalogEntry(db.pool, items, { commit: false, deps: db.deps });
  assert.equal(preview.ok, true, JSON.stringify(preview.plan));
  const result = await runCatalogEntry(db.pool, items, { commit: true, expectedHash: preview.hash, deps: db.deps });
  assert.equal(result.ok, true, JSON.stringify(result.plan));
  return { preview, result };
}
const productInserts = db => db.log.filter(sql => /^\s*INSERT INTO products/.test(sql));

test('celular existente por product_id + IMEI novo: só cria a unidade naquele produto', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const { preview, result } = await previewAndCommit(db, [byId()]);
  for (const r of [preview, result]) {
    const [line] = r.plan;
    assert.equal(line.family, 'existing'); assert.equal(line.variation, 'existing');
    assert.equal(line.product_id, 'V'); assert.equal(line.sku, 'REDM0001-01');
    assert.equal(line.price_source, 'existing'); assert.equal(line.stock.kind, 'unit');
  }
  assert.deepEqual(productInserts(db), []);
  assert.equal(db.state.products.length, 2);
  assert.equal(db.state.units.length, 1);
  assert.equal(db.state.units[0].product_id, 'V'); assert.equal(db.state.units[0].imei_1, IMEI);
  assert.equal(db.state.units[0].location_id, 'L1'); assert.equal(db.state.units[0].deposit_id, 'D1');
  assert.equal(db.state.units[0].cost_price, 95000); assert.equal(db.state.units[0].condition, 'new');
  assert.equal(db.state.lines.length, 1);
  assert.equal(db.state.lines[0].product_id, 'V');
  assert.equal(db.state.lines[0].family_created, 0); assert.equal(db.state.lines[0].variation_created, 0);
});

test('variação antiga cujas specs não batem com a configuração: a unidade cai no product_id informado', async () => {
  const old = childRow({ id: 'V-OLD', sku: 'REDM0001-02', specs: JSON.stringify({ armazenamento: '128 GB', cor: 'preto fosco' }) });
  const db = fakeDb({ products: [parentRow, childRow(), old] });
  // model_id/configuração/cor do cliente apontariam para V; com product_id são ignorados.
  const item = byId({ product_id: 'V-OLD', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde' });
  const { result } = await previewAndCommit(db, [item]);
  assert.equal(result.plan[0].product_id, 'V-OLD'); assert.equal(result.plan[0].sku, 'REDM0001-02');
  assert.equal(db.state.units[0].product_id, 'V-OLD');
  assert.deepEqual(productInserts(db), []);
});

test('product_id do pai da família é erro da linha e nada é gravado', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await runCatalogEntry(db.pool, [byId({ product_id: 'P' })], { commit: true, expectedHash: 'x', deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, ['Este é o produto pai da família. Escolha a variação (cor/memória).']);
  assert.equal(r.plan[0].product_id, null);
  assert.equal(db.state.units.length, 0); assert.equal(db.state.batches.length, 0);
  assert.deepEqual(productInserts(db), []);
  assert.ok(!db.log.includes('COMMIT'));
});

test('product_id inexistente: "Produto não encontrado."', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await runCatalogEntry(db.pool, [byId({ product_id: 'nao-existe' })], { commit: false, deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, ['Produto não encontrado.']);
  assert.equal(db.state.units.length, 0);
});

test('product_id de outra empresa (local de outra empresa) é erro da linha', async () => {
  const db = fakeDb({ products: [parentRow, childRow({ company_id: 'outra' })] });
  const r = await runCatalogEntry(db.pool, [byId()], { commit: false, deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, ['Produto pertence a outra empresa.']);
});

test('acessório por quantidade com product_id e quantity 5: estoque +5 no local e movimentação in', async () => {
  const psl = [{ id: 'S1', company_id: 'c', product_id: 'A1', deposit_id: 'D1', location_id: 'L1', quantity: 2, reserved_quantity: 0 }];
  const db = fakeDb({ products: [capaRow()], psl });
  const item = { source: 'atalho', product_id: 'A1', quantity: 5, cost_cents: 800, location_id: 'L1' };
  const { result } = await previewAndCommit(db, [item]);
  const [line] = result.plan;
  assert.equal(line.stock.kind, 'quantity'); assert.equal(line.stock.quantity, 5);
  assert.equal(line.product_id, 'A1'); assert.equal(line.family, 'existing'); assert.equal(line.variation, 'existing');
  assert.equal(db.state.psl.length, 1); assert.equal(db.state.psl[0].quantity, 7);
  assert.equal(db.state.movements.length, 1);
  const mv = db.state.movements[0];
  assert.equal(mv.movement_type, 'in'); assert.equal(mv.product_id, 'A1'); assert.equal(mv.quantity, 5);
  assert.equal(mv.previous_to_quantity, 2); assert.equal(mv.new_to_quantity, 7);
  assert.equal(mv.to_location_id, 'L1'); assert.equal(mv.reference_type, 'catalog_entry');
  assert.equal(db.state.units.length, 0);
  assert.deepEqual(productInserts(db), []);
});

test('acessório com unidades: linha por quantidade recebe o erro de modo de estoque atual', async () => {
  const db = fakeDb({ products: [capaRow()], units: [{ id: 'U0', product_id: 'A1', imei_1: null, imei_2: null, serial: 'X1', status: 'available' }] });
  const r = await runCatalogEntry(db.pool, [{ source: 'atalho', product_id: 'A1', quantity: 2, location_id: 'L1' }], { commit: false, deps: db.deps });
  assert.deepEqual(r.plan[0].errors, ['Este produto controla estoque por aparelho; ajuste a linha.']);
});

test('celular com product_id e IMEI repetido: erro de conflito atual', async () => {
  const db = fakeDb({ products: [parentRow, childRow()], units: [{ id: 'U0', product_id: 'V', imei_1: IMEI, imei_2: null, serial: null, status: 'sold' }] });
  const r = await runCatalogEntry(db.pool, [byId()], { commit: true, expectedHash: 'x', deps: db.deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plan[0].errors, [`IMEI ${IMEI} já cadastrado.`]);
  assert.equal(db.state.units.length, 1);
});

test('celular com product_id sem IMEI nem serial: regra de celular vale (o produto define que é celular)', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const r = await runCatalogEntry(db.pool, [byId({ identity: {} })], { commit: false, deps: db.deps });
  assert.deepEqual(r.plan[0].errors, ['Informe IMEI 1 ou serial.']);
});

test('prices null não altera os preços; com prices em celular segue a variação existente (não altera)', async () => {
  for (const prices of [null, PRICES]) {
    const db = fakeDb({ products: [parentRow, childRow()] });
    const { result } = await previewAndCommit(db, [byId({ prices })]);
    assert.equal(result.plan[0].price_source, 'existing');
    const v = db.state.products.find(p => p.id === 'V');
    assert.equal(v.price_retail, 130000); assert.equal(v.price_reseller, 125000); assert.equal(v.price_wholesale, 115000);
    assert.equal(db.state.groups.length, 0);
    assert.ok(!db.log.some(sql => /UPDATE products SET price|INSERT INTO smartphone_price_groups|UPDATE smartphone_price_groups/.test(sql)));
  }
  // Mesma regra do caminho por modelo para a variação existente.
  const db = fakeDb({ products: [parentRow, childRow()] });
  const viaModel = { source: 'manual', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde',
    identity: { imei1: IMEI }, quantity: 1, location_id: 'L1', prices: PRICES };
  const { result } = await previewAndCommit(db, [viaModel]);
  assert.equal(result.plan[0].price_source, 'existing');
  assert.equal(db.state.products.find(p => p.id === 'V').price_retail, 130000);
});

test('product_id faz parte do hash: trocar entre a prévia e a confirmação dá 409', async () => {
  const db = fakeDb({ products: [parentRow, childRow(), childRow({ id: 'V2', sku: 'REDM0001-02', specs: JSON.stringify({ ram: '8GB', storage: '256GB', color: 'Azul' }) })] });
  const preview = await runCatalogEntry(db.pool, [byId()], { commit: false, deps: db.deps });
  assert.equal(preview.ok, true);
  await assert.rejects(runCatalogEntry(db.pool, [byId({ product_id: 'V2' })], { commit: true, expectedHash: preview.hash, deps: db.deps }),
    e => e.statusCode === 409 && e.message === 'O lote mudou desde a conferência. Confira novamente.');
  assert.equal(db.state.units.length, 0);
});

test('item com product_id e sem model_id/name não recebe "Informe o modelo ou a categoria e o nome."', async () => {
  const [normalized] = [normalizeEntryItem({ source: 'atalho', product_id: '  V  ', quantity: 1, location_id: 'L1' }, 0)];
  assert.equal(normalized.product_id, 'V');
  const [validated] = validateEntryBatch([normalized]);
  assert.deepEqual(validated.errors, []);
  const [plain] = validateEntryBatch([normalizeEntryItem({ source: 'atalho', quantity: 1, location_id: 'L1' }, 0)]);
  assert.ok(plain.errors.includes('Informe o modelo ou a categoria e o nome.'));
  assert.equal(normalizeEntryItem({ source: 'manual' }, 0).product_id, null);
  // Local continua obrigatório.
  const [noLocation] = validateEntryBatch([normalizeEntryItem({ source: 'atalho', product_id: 'V', quantity: 1 }, 0)]);
  assert.deepEqual(noLocation.errors, ['Escolha o local de estoque.']);
});

test('com product_id, modelo/categoria/nome/configuração/cor do cliente são ignorados (a condição da unidade vale)', async () => {
  const n = normalizeEntryItem({ source: 'atalho', product_id: 'V', model_id: 'm2', category_id: 'cat-acc', name: 'X', color: 'Azul',
    configuration: { ram: '4GB', storage: '64GB', version: 'China', network: '5G', condition: 'seminovo' }, location_id: 'L1' }, 0);
  assert.equal(n.model_id, null); assert.equal(n.category_id, null); assert.equal(n.name, null); assert.equal(n.color, null);
  assert.deepEqual(n.configuration, { ram: null, storage: null, version: null, network: null, condition: 'seminovo' });
  const db = fakeDb({ products: [parentRow, childRow()] });
  await previewAndCommit(db, [byId({ model_id: 'm2', configuration: { condition: 'seminovo' }, battery_health: 88 })]);
  assert.equal(db.state.units[0].product_id, 'V'); assert.equal(db.state.units[0].condition, 'seminovo');
  assert.match(db.state.units[0].internal_notes, /Bateria 88%/);
});

test('produto inativo é aceito, como já acontece com a variação existente na porta única', async () => {
  const db = fakeDb({ products: [parentRow, childRow({ status: 'inactive' })] });
  const { result } = await previewAndCommit(db, [byId()]);
  assert.equal(result.plan[0].product_id, 'V');
  assert.equal(db.state.units.length, 1);
});

test('label no item é tolerado e não entra no hash', async () => {
  const db = fakeDb({ products: [parentRow, childRow()] });
  const a = await runCatalogEntry(db.pool, [byId({ label: 'Redmi · IMEI …8763' })], { commit: false, deps: db.deps });
  const b = await runCatalogEntry(db.pool, [byId()], { commit: false, deps: db.deps });
  assert.equal(a.ok, true); assert.equal(a.hash, b.hash);
});

test('duas linhas com product_id no mesmo lote (celular e acessório) e uma por modelo', async () => {
  const db = fakeDb({ products: [parentRow, childRow(), capaRow()] });
  const items = [byId(), { source: 'atalho', product_id: 'A1', quantity: 3, location_id: 'L1' },
    { source: 'manual', model_id: 'm1', configuration: { ram: '8GB', storage: '256GB' }, color: 'Verde', identity: { imei1: IMEI_B }, quantity: 1, location_id: 'L1' }];
  const { result } = await previewAndCommit(db, items);
  assert.deepEqual(result.plan.map(l => l.product_id), ['V', 'A1', 'V']);
  assert.equal(db.state.units.filter(u => u.product_id === 'V').length, 2);
  assert.equal(db.state.psl.find(r => r.product_id === 'A1').quantity, 3);
  assert.deepEqual(productInserts(db), []);
});
