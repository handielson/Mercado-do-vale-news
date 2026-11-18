// Linha do tempo do aparelho (Parte 1 do spec 2026-11-18-historico-do-aparelho-design.md).
// Caso real: Poco X8 IMEI 868499080873669 (dados da cliente anonimizados na fixture).
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/unit-timeline-868499080873669.json');
const { buildUnitTimeline } = require('../services/unitTimeline.cjs');

const clone = () => structuredClone(fixture);
const SALE = '8d7563b4-baa3-4cf6-983c-8df9550780db';
const unitSnap = (input, patch) => ({ ...input.unit, ...patch });
let seq = 9000;
const journalRow = (input, event_type, at, before, after) => ({
  id: String(seq++), unit_id: input.unit.id, product_id: input.unit.product_id, event_type, recorded_at: at,
  before_data: before, after_data: after,
});

test('caso real 868499080873669: entrada, venda, cancelamento, volta', () => {
  const { current, events } = buildUnitTimeline(clone());
  assert.deepEqual(events.map(e => e.type), ['returned_to_stock', 'sale_cancelled', 'sold', 'entry']);
  const sold = events.find(e => e.type === 'sold');
  assert.equal(sold.saleId, SALE);
  assert.match(sold.detail, /Cliente Teste/);
  assert.match(sold.detail, /R\$\s1\.999,00/);
  assert.match(sold.title, /#8D7563B4/);
  assert.match(sold.actor, /Vendedor Teste/);
  assert.equal(events.find(e => e.type === 'entry').intakeId, 'cf84896f-52c8-4ece-901f-a009e8934e79');
  assert.match(events.find(e => e.type === 'entry').detail, /Cadastro por foto/);
  assert.equal(events.find(e => e.type === 'sale_cancelled').saleId, SALE);
  assert.equal(current.status, 'available');
  assert.equal(current.statusLabel, 'Disponível');
  assert.equal(current.timesSold, 1);
  assert.equal(current.timesReturned, 1);
  assert.equal(current.sale, null);
  assert.equal(current.costCents, 174500);
  assert.equal(typeof current.daysInStock, 'number');
});

test('sale_update sem mudança de status não vira evento', () => {
  const { events } = buildUnitTimeline(clone()); // 2882 é paid → paid
  assert.equal(events.filter(e => e.type.startsWith('sale_')).length, 1);
});

test('duas vendas: cada uma com seu cliente, situação aponta a última', () => {
  const input = clone();
  const S2 = '22222222-2222-4222-8222-222222222222';
  input.sales.push({ ...input.sales[0], id: S2, customer_id: 'c2', payment_status: 'paid', created_at: '2026-11-20 10:00:00' });
  input.customers.push({ id: 'c2', name: 'Outra Cliente' });
  const item = { ...input.saleItems.find(i => i.serialized_unit_id === input.unit.id), id: 'si2', sale_id: S2, unit_price: 189900, total: 189900 };
  input.saleItems.push(item);
  const avail = unitSnap(input, { status: 'available', sale_id: null });
  const sold = unitSnap(input, { status: 'sold', sale_id: S2 });
  input.journal.push(
    journalRow(input, 'sale_items_insert', '2026-11-20T13:00:00.000000Z', null, { unit: avail, sale: input.sales.at(-1), sale_items: item }),
    journalRow(input, 'unit_update', '2026-11-20T13:00:01.000000Z', { unit: avail }, { unit: sold }),
  );
  input.unit = sold;
  const { current, events } = buildUnitTimeline(input);
  assert.equal(events.filter(e => e.type === 'sold').length, 2);
  assert.equal(events[0].type, 'sold');
  assert.match(events[0].detail, /Outra Cliente/);
  assert.match(events[0].detail, /R\$\s1\.899,00/);
  assert.equal(current.status, 'sold');
  assert.equal(current.sale.id, S2);
  assert.equal(current.sale.customerName, 'Outra Cliente');
  assert.equal(current.timesSold, 2);
  assert.equal(current.daysInStock, null);
});

test('aparelho anterior ao diário: baseline + existing_sale_reference', () => {
  const input = clone();
  const old = unitSnap(input, { status: 'sold', created_at: '2026-09-01 12:00:00', sale_id: SALE });
  input.unit = old;
  input.journal = [
    journalRow(input, 'baseline', '2026-10-14T14:46:42.000000Z', null, { unit: old }),
    journalRow(input, 'existing_sale_reference', '2026-10-14T14:46:43.000000Z', null, { unit: old, sale: input.sales[0] }),
  ];
  const { events } = buildUnitTimeline(input);
  assert.deepEqual(events.map(e => e.type), ['legacy_sale', 'legacy_entry']);
  assert.equal(events[1].title, 'Já estava cadastrado');
  assert.equal(events[1].at.slice(0, 10), '2026-09-01');
  assert.equal(events[0].saleId, SALE);
});

test('venda/cliente ausentes: evento mantém o diário e diz "Cliente não encontrado"', () => {
  const { events } = buildUnitTimeline({ ...clone(), sales: [], customers: [] });
  const sold = events.find(e => e.type === 'sold');
  assert.match(sold.detail, /Cliente não encontrado/);
  assert.match(sold.detail, /R\$\s1\.999,00/);
});

test('IMEI e custo alterados viram data_corrected com antes → depois', () => {
  const input = clone();
  const before = unitSnap(input, {});
  const after = unitSnap(input, { imei_2: '868499080873685', cost_price: 170000 });
  input.journal.push(journalRow(input, 'unit_update', '2026-11-19T12:00:00.000000Z', { unit: before }, { unit: after }));
  const corrected = buildUnitTimeline(input).events.find(e => e.type === 'data_corrected');
  assert.ok(corrected);
  assert.match(corrected.detail, /IMEI 2: 868499080873677 → 868499080873685/);
  assert.match(corrected.detail, /Custo: R\$\s1\.745,00 → R\$\s1\.700,00/);
});

test('reserva e liberação de pedido', () => {
  const input = clone();
  const avail = unitSnap(input, { status: 'available', order_id: null });
  const reserved = unitSnap(input, { status: 'reserved', order_id: 'O1' });
  input.journal.push(
    journalRow(input, 'unit_update', '2026-11-19T12:00:00.000000Z', { unit: avail }, { unit: reserved }),
    journalRow(input, 'unit_update', '2026-11-19T13:00:00.000000Z', { unit: reserved }, { unit: avail }),
  );
  const events = buildUnitTimeline(input).events;
  assert.equal(events.find(e => e.type === 'reserved').orderId, 'O1');
  assert.ok(events.some(e => e.type === 'reservation_released'));
});

test('eventos de produto e de saldo por local nunca aparecem', () => {
  const { events } = buildUnitTimeline(clone());
  assert.equal(events.some(e => /product_|stock_location/.test(e.key)), false);
  assert.equal(events.length, 4);
});

test('garantia emitida e termo assinado entram na linha do tempo', () => {
  const input = clone();
  input.warranties = [{ id: 'w1', sale_id: SALE, serialized_unit_id: input.unit.id, created_at: '2026-11-17 21:13:00' }];
  input.signedWarranties = [
    { id: 'sw1', sale_id: SALE, status: 'available', created_at: '2026-11-17 21:20:00' },
    { id: 'sw2', sale_id: SALE, status: 'error', created_at: '2026-11-17 21:21:00' },
  ];
  const types = buildUnitTimeline(input).events.map(e => e.type);
  assert.equal(types.filter(t => t === 'warranty_issued').length, 1);
  assert.equal(types.filter(t => t === 'warranty_signed').length, 1);
});

test('data inválida em um registro não derruba a linha do tempo', () => {
  const input = clone();
  input.warranties = [{ id: 'w-bad', sale_id: SALE, serialized_unit_id: input.unit.id, created_at: '0000-00-00 00:00:00' }];
  input.unit = { ...input.unit, created_at: 'invalid' };
  const { events } = buildUnitTimeline(input);
  const bad = events.find(e => e.key === 'warranty_issued:w-bad');
  assert.ok(bad);
  assert.equal(bad.at, null);
});

// Parte 2: mudanças de local vêm de unit_events, com quem fez e os nomes dos locais.
const places = {
  deposits: [{ id: 'dep-d', name: 'Deposito' }, { id: 'dep-l', name: 'Loja Principal' }],
  locations: [{ id: 'loc-e', name: 'Entrada / Conferencia', deposit_id: 'dep-d' }, { id: 'loc-g', name: 'Estoque Geral', deposit_id: 'dep-l' }],
};
const ev = (id, event_type, occurred_at, extra = {}) => ({ id, unit_id: fixture.unit.id, product_id: fixture.unit.product_id, event_type, occurred_at, actor_name: null, from_deposit_id: null, from_location_id: null, to_deposit_id: null, to_location_id: null, reason: null, ...extra });

test('transferência e local definido aparecem com quem fez e os nomes dos locais', () => {
  const input = { ...clone(), ...places, unitEvents: [
    ev('e1', 'location_set', '2026-11-18 15:00:00', { to_deposit_id: 'dep-d', to_location_id: 'loc-e', reason: 'Local inicial na implantação' }),
    ev('e2', 'transfer', '2026-11-18 16:00:00', { actor_name: 'Operador Teste', from_deposit_id: 'dep-d', from_location_id: 'loc-e', to_deposit_id: 'dep-l', to_location_id: 'loc-g', reason: 'vitrine' }),
  ] };
  const { events } = buildUnitTimeline(input);
  assert.deepEqual(events.slice(0, 2).map(e => e.type), ['transfer', 'location_set']);
  assert.equal(events[0].title, 'Transferido');
  assert.equal(events[0].detail, 'Deposito / Entrada / Conferencia → Loja Principal / Estoque Geral · vitrine');
  assert.equal(events[0].actor, 'Operador Teste');
  assert.equal(events[1].title, 'Local definido');
  assert.equal(events[1].detail, 'Deposito / Entrada / Conferencia · Local inicial na implantação');
});

test('volta da venda para o Depósito aparece logo acima do "Voltou ao estoque"', () => {
  const input = { ...clone(), ...places, unitEvents: [
    ev('e3', 'returned_to_incoming', '2026-11-18 13:50:16.900', { to_deposit_id: 'dep-d', to_location_id: 'loc-e', reason: 'Saiu de uma venda: volta para conferência no Depósito.' }),
  ] };
  const { events } = buildUnitTimeline(input);
  assert.deepEqual(events.slice(0, 2).map(e => e.type), ['returned_to_incoming', 'returned_to_stock']);
  assert.equal(events[0].title, 'Foi para conferência');
  assert.match(events[0].detail, /^Deposito \/ Entrada \/ Conferencia/);
});

test('local sem nome conhecido aparece como "local removido"; sem local, "sem local"', () => {
  const input = { ...clone(), unitEvents: [ev('e4', 'transfer', '2026-11-19 10:00:00', { from_location_id: 'x', to_location_id: 'y' })] };
  assert.equal(buildUnitTimeline(input).events[0].detail, 'local removido → local removido');
  const empty = { ...clone(), unitEvents: [ev('e5', 'transfer', '2026-11-19 10:00:00', { from_location_id: null, to_location_id: 'y' })] };
  assert.equal(buildUnitTimeline(empty).events[0].detail, 'sem local → local removido');
});

// Ajustes pequenos (parte 1)
test('venda anterior ao diário que também tem registro de venda aparece uma vez só', () => {
  const input = clone();
  input.journal.unshift(journalRow(input, 'existing_sale_reference', '2026-11-17T21:12:00.000000Z', null, { unit: input.unit, sale: input.sales[0] }));
  const { events, current } = buildUnitTimeline(input);
  assert.equal(events.filter(e => e.saleId === SALE && ['sold', 'legacy_sale'].includes(e.type)).length, 1);
  assert.equal(current.timesSold, 1);
});

test('venda antiga cancelada não conta como vendida e diz que foi cancelada', () => {
  const input = clone();
  const old = { ...input.sales[0], id: 'old-sale', payment_status: 'cancelled' };
  input.sales.push(old);
  input.journal.unshift(journalRow(input, 'existing_sale_reference', '2026-09-01T10:00:00.000000Z', null, { unit: input.unit, sale: old }));
  const { events, current } = buildUnitTimeline(input);
  assert.match(events.find(e => e.saleId === 'old-sale').title, /\(cancelada\)/);
  assert.equal(current.timesSold, 1);
});

test('vendido mostra também o total da venda', () => {
  const sold = buildUnitTimeline(clone()).events.find(e => e.type === 'sold');
  assert.match(sold.detail, /venda de R\$\s2\.151,18/);
});

test('entrada por foto mostra quem cadastrou', () => {
  const input = clone();
  input.intakes = [{ ...input.intakes[0], created_by_name: 'Operador Foto' }];
  assert.equal(buildUnitTimeline(input).events.find(e => e.type === 'entry').actor, 'Operador Foto');
});
