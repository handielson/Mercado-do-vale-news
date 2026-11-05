'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const core = require('../services/catalogEntryCore.cjs');
const { SOURCES, isValidImei, cents, normalizeEntryItem, validateEntryBatch, planHash } = core;

const IMEI_A = '863715061138763';
const IMEI_B = '863715061138771';
const phone = () => true;
const notPhone = () => false;
const base = (patch = {}) => ({ source: 'manual', model_id: 'm1', location_id: 'loc1', quantity: 1, ...patch });
const run = (raws, isSmartphone = phone) => validateEntryBatch(raws.map((r, i) => normalizeEntryItem(r, i)), { isSmartphone });

test('SOURCES', () => {
  assert.deepEqual(SOURCES, ['manual', 'bipar', 'planilha', 'foto', 'bling', 'atalho']);
});

test('isValidImei', () => {
  assert.equal(isValidImei(IMEI_A), true);
  assert.equal(isValidImei('863715061138764'), false);
  assert.equal(isValidImei('12345'), false);
});

test('cents', () => {
  assert.equal(cents('130000.00'), 130000);
  assert.equal(cents(125000), 125000);
  assert.equal(cents(''), undefined);
  assert.equal(cents('12,50'), null);
  assert.equal(cents(-1), null);
  assert.equal(cents(1.5), null);
});

test('normalizeEntryItem: origem inválida e line', () => {
  const item = normalizeEntryItem({ source: 'xx' }, 0);
  assert.equal(item.line, 1);
  assert.ok(item.errors.includes('Origem inválida.'));
});

test('normalizeEntryItem: normaliza campos', () => {
  const item = normalizeEntryItem(base({
    color: '  Azul   Claro ', identity: { imei1: '8637 1506-1138763', serial: ' ab12cd ' },
    prices: { price_retail: '300', price_reseller: 200, price_wholesale: 100 },
  }), 2);
  assert.equal(item.line, 3);
  assert.equal(item.color, 'Azul Claro');
  assert.equal(item.identity.imei1, IMEI_A);
  assert.equal(item.identity.serial, 'AB12CD');
  assert.deepEqual(item.prices, { price_retail: 300, price_reseller: 200, price_wholesale: 100 });
  assert.equal(normalizeEntryItem(base(), 0).prices, null);
  assert.ok(normalizeEntryItem(base({ prices: { price_retail: 'x' } }), 0).errors.includes('Preço inválido.'));
});

test('celular sem IMEI 1 e sem serial', () => {
  const [item] = run([base()]);
  assert.ok(item.errors.includes('Informe IMEI 1 ou serial.'));
  const [ok] = run([base({ identity: { serial: 'abc123' } })]);
  assert.ok(!ok.errors.includes('Informe IMEI 1 ou serial.'));
});

test('celular com quantity 2', () => {
  const [item] = run([base({ quantity: 2, identity: { imei1: IMEI_A } })]);
  assert.ok(item.errors.includes('Celular entra um aparelho por linha.'));
});

test('não celular com quantity 0', () => {
  const [item] = run([base({ quantity: 0 })], notPhone);
  assert.ok(item.errors.includes('Quantidade deve ser 1 ou mais.'));
  const [ok] = run([base({ quantity: 5 })], notPhone);
  assert.deepEqual(ok.errors, []);
});

test('preços fora da ordem', () => {
  const [item] = run([base({ identity: { imei1: IMEI_A }, prices: { price_retail: 100, price_reseller: 200, price_wholesale: 50 } })]);
  assert.ok(item.errors.includes('Preços fora da ordem: varejo ≥ revenda ≥ atacado.'));
});

test('IMEI repetido no lote (imei1 da linha 1 = imei2 da linha 2)', () => {
  const items = run([
    base({ identity: { imei1: IMEI_A } }),
    base({ identity: { imei1: IMEI_B, imei2: IMEI_A } }),
  ]);
  const msg = `IMEI ${IMEI_A} repetido no lote (linhas 1 e 2).`;
  assert.ok(items[0].errors.includes(msg));
  assert.ok(items[1].errors.includes(msg));
});

test('IMEI inválido', () => {
  const [item] = run([base({ identity: { imei1: '863715061138764' } })]);
  assert.ok(item.errors.includes('IMEI 1 inválido.'));
  const [item2] = run([base({ identity: { imei1: IMEI_A, imei2: '123' } })]);
  assert.ok(item2.errors.includes('IMEI 2 inválido.'));
});

test('sem location_id', () => {
  const [item] = run([base({ location_id: null, identity: { imei1: IMEI_A } })]);
  assert.ok(item.errors.includes('Escolha o local de estoque.'));
});

test('sem modelo e sem categoria+nome', () => {
  const msg = 'Informe o modelo ou a categoria e o nome.';
  assert.ok(run([base({ model_id: null, identity: { imei1: IMEI_A } })])[0].errors.includes(msg));
  assert.ok(run([base({ model_id: null, category_id: 'c', identity: { imei1: IMEI_A } })])[0].errors.includes(msg));
  assert.ok(!run([base({ model_id: null, category_id: 'c', name: 'Capa', identity: { imei1: IMEI_A } })])[0].errors.includes(msg));
});

test('planHash', () => {
  const plan = [{ line: 1, sku: 'A', errors: [] }, { line: 2, sku: 'B', errors: [] }];
  const same = [{ line: 1, sku: 'A', errors: ['x'] }, { line: 2, sku: 'B', errors: [] }];
  const other = [{ line: 1, sku: 'A', errors: [] }, { line: 2, sku: 'C', errors: [] }];
  assert.equal(planHash(plan), planHash(same));
  assert.notEqual(planHash(plan), planHash(other));
  assert.match(planHash(plan), /^[0-9a-f]{64}$/);
});

test('condição: padrão new, normalizada, inválida', () => {
  assert.equal(normalizeEntryItem(base(), 0).configuration.condition, 'new');
  assert.equal(normalizeEntryItem(base({ configuration: { condition: '  ' } }), 0).configuration.condition, 'new');
  const ok = normalizeEntryItem(base({ configuration: { condition: 'Seminovo' } }), 0);
  assert.equal(ok.configuration.condition, 'seminovo');
  assert.ok(!ok.errors.includes('Condição inválida.'));
  assert.ok(normalizeEntryItem(base({ configuration: { condition: 'foo' } }), 0).errors.includes('Condição inválida.'));
  for (const c of ['new', 'used', 'open_box']) assert.ok(!normalizeEntryItem(base({ configuration: { condition: c } }), 0).errors.includes('Condição inválida.'));
});

test('IMEI 2 igual ao IMEI 1 na mesma linha', () => {
  const [item] = run([base({ identity: { imei1: IMEI_A, imei2: IMEI_A } })]);
  assert.ok(item.errors.includes('IMEI 2 igual ao IMEI 1.'));
  const [ok] = run([base({ identity: { imei1: IMEI_A, imei2: IMEI_B } })]);
  assert.ok(!ok.errors.includes('IMEI 2 igual ao IMEI 1.'));
});

test('cents rejeita valores acima do inteiro seguro', () => {
  assert.equal(cents('1e21'), null);
  assert.equal(cents('99999999999999999999'), null);
  assert.equal(cents(1e21), null);
  assert.equal(cents(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
});

test('serial repetido no lote (I2)', () => {
  const items = run([
    base({ identity: { serial: 'abc123' } }),
    base({ identity: { serial: 'ABC123 ' } }),
  ]);
  const msg = 'Serial ABC123 repetido no lote (linhas 1 e 2).';
  assert.ok(items[0].errors.includes(msg), JSON.stringify(items[0].errors));
  assert.ok(items[1].errors.includes(msg));
});

test('planHash cobre os itens normalizados (M3)', () => {
  const plan = [{ line: 1, sku: 'A', errors: [] }];
  const a = [normalizeEntryItem(base({ identity: { imei1: IMEI_A } }), 0)];
  const b = [normalizeEntryItem(base({ identity: { imei1: IMEI_B } }), 0)];
  const a2 = [normalizeEntryItem(base({ identity: { imei1: IMEI_A } }), 0)];
  assert.equal(planHash(plan, a), planHash(plan, a2));
  assert.notEqual(planHash(plan, a), planHash(plan, b));
  const c = [normalizeEntryItem(base({ identity: { imei1: IMEI_A }, quantity: 2 }), 0)];
  assert.notEqual(planHash(plan, a), planHash(plan, c));
});
