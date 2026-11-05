import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRY_TEMPLATE_HEADERS, templateExampleRows, parseMoney, rowsToLines,
} from '../components/entrada/spreadsheetRows.js';

const IMEI_A = '863715061138763';
const ctx = {
  models: [{ id: 'm1', name: 'Redmi 15', category_id: 'c1' }, { id: 'm2', name: 'Cabo USB' }],
  categories: [{ id: 'c1', name: 'Celulares' }, { id: 'c2', name: 'Acessórios' }],
  locations: [
    { id: 'l1', name: 'Loja', code: 'LJ', is_default: true },
    { id: 'l2', name: 'Depósito', code: 'DEP', is_default: false },
  ],
};
const noDefault = { ...ctx, locations: ctx.locations.map(l => ({ ...l, is_default: false })) };
const run = (rec, c = ctx) => rowsToLines(Array.isArray(rec) ? rec : [rec], c);
const msgs = r => r.issues.map(i => i.message);

test('cabeçalhos do modelo', () => {
  assert.deepEqual(ENTRY_TEMPLATE_HEADERS, ['Modelo', 'Categoria', 'Nome', 'RAM', 'Armazenamento', 'Versão', 'Condição', 'Observação', 'Cor', 'IMEI 1', 'IMEI 2', 'Serial', 'Quantidade', 'Custo', 'Local', 'Varejo', 'Revenda', 'Atacado']);
  const ex = templateExampleRows();
  assert.equal(ex.length, 2);
  assert.ok(ex[0]['IMEI 1']);
  assert.ok(ex[1]['Quantidade']);
  const r = rowsToLines(ex, ctx);
  assert.equal(r.fatal, undefined);
});

test('parseMoney', () => {
  assert.equal(parseMoney('1.299,00'), 129900);
  assert.equal(parseMoney('1299,00'), 129900);
  assert.equal(parseMoney('1299.00'), 129900);
  assert.equal(parseMoney('1299'), 129900);
  assert.equal(parseMoney(1299.5), 129950);
  assert.equal(parseMoney(''), undefined);
  assert.equal(parseMoney(null), undefined);
  assert.equal(parseMoney('abc'), null);
  assert.equal(parseMoney('-5'), null);
});

test('cabeçalhos variados do IMEI', () => {
  for (const h of ['imei 1', 'IMEI1', 'Imei-1']) {
    const r = run({ Modelo: 'Redmi 15', [h]: IMEI_A });
    assert.deepEqual(r.issues, [], h);
    assert.equal(r.lines[0].item.identity.imei1, IMEI_A);
  }
});

test('modelo por nome, por ID, duplicado e ausente', () => {
  assert.equal(run({ Modelo: 'redmi 15' }).lines[0].item.model_id, 'm1');
  assert.equal(run({ Modelo: 'm2' }).lines[0].item.model_id, 'm2');
  const dup = { ...ctx, models: [...ctx.models, { id: 'm3', name: 'Redmi 15' }] };
  const r = run({ Modelo: 'redmi 15' }, dup);
  assert.equal(r.lines.length, 0);
  assert.deepEqual(r.issues, [{ row: 2, message: 'Modelo "Redmi 15" encontrado mais de uma vez; use o ID do modelo.' }]);
  assert.match(msgs(run({ Modelo: 'Zzz' }))[0], /Zzz/);
});

test('sem modelo: categoria + nome', () => {
  const r = run({ Categoria: 'acessorios', Nome: 'Capa X', Quantidade: 3 });
  assert.deepEqual(r.issues, []);
  const it = r.lines[0].item;
  assert.equal(it.category_id, 'c2');
  assert.equal(it.name, 'Capa X');
  assert.equal(it.model_id, undefined);
  assert.equal(it.quantity, 3);
  assert.deepEqual(msgs(run({ Nome: 'Capa X' })), ['Informe o modelo ou a categoria e o nome.']);
  assert.deepEqual(msgs(run({ Categoria: 'Acessórios', Nome: '' })), ['Informe o modelo ou a categoria e o nome.']);
});

test('condição', () => {
  const c = v => run({ Modelo: 'Redmi 15', 'Condição': v });
  assert.equal(c('Seminovo').lines[0].item.configuration.condition, 'seminovo');
  assert.equal(c('usado').lines[0].item.configuration.condition, 'used');
  assert.equal(c('Caixa aberta').lines[0].item.configuration.condition, 'open_box');
  assert.equal(c('').lines[0].item.configuration.condition, 'new');
  assert.equal(c(null).lines[0].item.configuration.condition, 'new');
  assert.deepEqual(msgs(c('ok')), ['Condição inválida: ok']);
});

test('local', () => {
  assert.equal(run({ Modelo: 'Redmi 15', Local: 'DEP' }).lines[0].item.location_id, 'l2');
  assert.equal(run({ Modelo: 'Redmi 15', Local: 'depósito' }).lines[0].item.location_id, 'l2');
  assert.equal(run({ Modelo: 'Redmi 15' }).lines[0].item.location_id, 'l1');
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15' }, noDefault)), ['Escolha o local de estoque.']);
  assert.equal(run({ Modelo: 'Redmi 15', Local: 'Marte' }).lines.length, 0);
});

test('IMEI', () => {
  assert.equal(run({ Modelo: 'Redmi 15', 'IMEI 1': 863715061138763 }).lines[0].item.identity.imei1, IMEI_A);
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', 'IMEI 1': '8.63715E+14' })), ['IMEI ilegível (formate a coluna como texto)']);
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', 'IMEI 1': 8.63715e+14 + 0.5 })), ['IMEI ilegível (formate a coluna como texto)']);
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', 'IMEI 1': '123' })), ['IMEI 1 inválido.']);
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', 'IMEI 2': '123' })), ['IMEI 2 inválido.']);
});

test('IMEI repetido no arquivo', () => {
  const r = run([
    { Modelo: 'Redmi 15', 'IMEI 1': IMEI_A },
    { Modelo: 'Redmi 15' },
    { Modelo: 'Redmi 15', 'IMEI 1': IMEI_A },
  ]);
  assert.equal(r.lines.length, 1);
  assert.deepEqual(r.issues, [
    { row: 2, message: 'IMEI repetido no arquivo (linhas 2 e 4)' },
    { row: 4, message: 'IMEI repetido no arquivo (linhas 2 e 4)' },
  ]);
});

test('preços', () => {
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', Varejo: 10 })), ['Informe varejo, revenda e atacado juntos.']);
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', Varejo: 10, Revenda: '9,50' })), ['Informe varejo, revenda e atacado juntos.']);
  const ok = run({ Modelo: 'Redmi 15', Varejo: '1.299,00', Revenda: 1100, Atacado: '1000' });
  assert.deepEqual(ok.lines[0].item.prices, { price_retail: 129900, price_reseller: 110000, price_wholesale: 100000 });
  assert.equal(run({ Modelo: 'Redmi 15' }).lines[0].item.prices, null);
  assert.equal(run({ Modelo: 'Redmi 15', Custo: 'abc' }).lines.length, 0);
});

test('linha em branco ignorada e numeração de linhas', () => {
  const r = run([{ Modelo: 'Redmi 15' }, { Modelo: '', Nome: ' ', Custo: null }, { Modelo: 'Zzz' }]);
  assert.equal(r.lines.length, 1);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].row, 4);
});

test('arquivo que não é o modelo e limite de linhas', () => {
  const f = rowsToLines([{ SKU: 'a', Produto: 'b' }], ctx);
  assert.equal(f.fatal, 'Esta planilha não é o modelo da Entrada. Baixe o modelo.');
  assert.deepEqual(f.lines, []);
  const many = Array.from({ length: 501 }, () => ({ Modelo: 'Redmi 15' }));
  const big = rowsToLines(many, ctx);
  assert.equal(big.fatal, 'Planilha acima de 500 linhas.');
  assert.deepEqual(big.lines, []);
  assert.equal(rowsToLines(many.slice(0, 500), ctx).lines.length, 500);
});

test('linha válida tem o mesmo formato da Manual', () => {
  const r = run({
    Modelo: 'Redmi 15', RAM: '8GB', Armazenamento: '256GB', 'Condição': 'Seminovo', 'Observação': ' arranhão ',
    Cor: 'Preto', 'IMEI 1': IMEI_A, Quantidade: 5, Custo: '800,00',
  });
  assert.deepEqual(r.issues, []);
  const { source, item } = r.lines[0];
  assert.equal(source, 'planilha');
  assert.deepEqual(item, {
    source: 'planilha',
    model_id: 'm1',
    category_id: 'c1',
    name: 'Redmi 15',
    configuration: { ram: '8GB', storage: '256GB', version: 'Global', network: '', condition: 'seminovo' },
    color: 'Preto',
    condition_note: 'arranhão',
    identity: { imei1: IMEI_A, imei2: null, serial: null },
    quantity: 1,
    cost_cents: 80000,
    location_id: 'l1',
    prices: null,
  });
  assert.equal(run({ Modelo: 'Redmi 15', 'Observação': 'x' }).lines[0].item.condition_note, null);
});

test('parseMoney recusa formatos ambíguos', () => {
  assert.equal(parseMoney('1,299.00'), null);
  assert.equal(parseMoney('1,299'), null);
  assert.equal(parseMoney('1.299,50'), 129950);
  assert.equal(parseMoney('12,5'), 1250);
  assert.deepEqual(msgs(run({ Modelo: 'Redmi 15', Custo: '1,299.00' })), ['Custo inválido.']);
});

test('RAM e armazenamento normalizados', () => {
  const cfg = (ram, st) => run({ Modelo: 'Redmi 15', RAM: ram, Armazenamento: st });
  assert.deepEqual(
    [cfg(8, 256).lines[0].item.configuration.ram, cfg(8, 256).lines[0].item.configuration.storage],
    ['8GB', '256GB'],
  );
  assert.equal(cfg('8 gb', '1').lines[0].item.configuration.storage, '1TB');
  assert.equal(cfg('', '2tb').lines[0].item.configuration.storage, '2TB');
  assert.equal(cfg('', '').lines[0].item.configuration.ram, '');
  assert.deepEqual(msgs(cfg('7GB', '')), ['RAM inválida: 7GB']);
  assert.deepEqual(msgs(cfg('', '100')), ['Armazenamento inválido: 100']);
  assert.equal(cfg(new Date(2026, 0, 8), '').lines.length, 0);
});

test('template antigo do Cadastro em massa', () => {
  const r = rowsToLines([{ acao: 'create', sku: 'x', nome: 'N', modelo_id: '', modelo_nome: 'M', categoria_nome: 'C', preco_varejo: 1 }], ctx);
  assert.equal(r.fatal, 'Esta planilha não é o modelo da Entrada. Baixe o modelo.');
  assert.deepEqual(r.lines, []);
});

test('cabeçalhos duplicados: valor não vazio vence', () => {
  const r = run({ Modelo: 'Redmi 15', 'IMEI 1': '', 'imei1': IMEI_A });
  assert.equal(r.lines[0].item.identity.imei1, IMEI_A);
});
