// marketplace-sales-group-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketplaceSalesGroup, saleMessage, printMessage } = require('../services/marketplaceSalesGroup.cjs');

function fakePool(state) {
  return { query: async (sql, args = []) => {
    if (/CREATE TABLE/.test(sql)) return [[]];
    if (/SELECT k, v FROM marketplace_group_config/.test(sql)) return [Object.entries(state.cfg).map(([k, v]) => ({ k, v }))];
    if (/INSERT INTO marketplace_group_config/.test(sql)) { state.cfg[args[0]] = args[1]; return [[]]; }
    if (/SELECT 1 FROM marketplace_group_sent/.test(sql)) return [state.sent.has(args[0]) ? [{ 1: 1 }] : []];
    if (/INSERT IGNORE INTO marketplace_group_sent/.test(sql)) { state.sent.add(args[0]); return [[]]; }
    if (/FROM marketplace_sales_cache WHERE channel = \? AND external_id IN/.test(sql)) return [state.sales.filter((x) => x.channel === args[0] && args.slice(1).includes(x.external_id))];
    if (/FROM marketplace_sales_cache/.test(sql)) return [state.sales];
    if (/FROM mercado_livre_print_jobs/.test(sql)) return [state.ml || []];
    if (/FROM tiktok_shop_print_jobs/.test(sql)) return [[]];
    if (/FROM shopee_shop_connections/.test(sql)) return [[{ id: 'g1', display_name: 'Shopee G' }]];
    if (/FROM products WHERE sku IN/.test(sql)) return [[{ sku: 'CCSAGA03ROS', slug: 'capa-a03', id: 'x' }]];
    throw new Error('sql inesperado: ' + sql);
  } };
}
const sale = (id, status) => ({ channel: 'shopee', connection_id: 'primary', external_id: id, occurred_at: new Date(), status,
  sale_json: JSON.stringify({ external_id: id, customer_name: 'Maria', total_cents: 2990, details: { payment: 'Pix', ship_by_date: 1795500000,
    shipping_address: { city: 'Petrolina', state: 'PE' }, items: [{ name: 'Capa A03', sku: 'CCSAGA03ROS', variation: 'Rosa', quantity: 1, total_cents: 2990 }] } }) });

test('primeira rodada só marca; depois avisa venda nova paga com link; não pago espera', async () => {
  const state = { cfg: { group_jid: '120363412156936763@g.us' }, sent: new Set(), sales: [sale('A1', 'READY_TO_SHIP')] };
  const sent = [];
  const g = createMarketplaceSalesGroup({ pool: fakePool(state), delayMs: 0, evolution: { url: 'https://e', key: 'k', instance: 'i' },
    fetchImpl: async (u, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; } });
  assert.deepEqual(await g.tick(), { sent: 0, baseline: true });
  state.sales.push(sale('B2', 'READY_TO_SHIP'), sale('C3', 'UNPAID'));
  assert.equal((await g.tick()).sent, 1);
  assert.equal(sent[0].number, '120363412156936763@g.us');
  assert.match(sent[0].text, /Venda nova · Shopee MV/);
  assert.match(sent[0].text, /B2/);
  assert.match(sent[0].text, /https:\/\/www\.mercadodovale\.com\.br\/produto\/capa-a03/);
  assert.match(sent[0].text, /Petrolina\/PE/);
  assert.equal((await g.tick()).sent, 0, 'não repete');
  state.sales[2].status = 'READY_TO_SHIP';
  assert.equal((await g.tick()).sent, 1, 'pagou → avisa');
});

test('etiqueta ML impressa e com erro', async () => {
  const state = { cfg: { group_jid: '1203@g.us', baseline_done: '1' }, sent: new Set(), sales: [],
    ml: [{ shipment_id: 'S1', order_id: 'O1', status: 'intervention', last_error: 'NCM inválido na nota', tracking_number: null }] };
  const sent = [];
  const g = createMarketplaceSalesGroup({ pool: fakePool(state), delayMs: 0, evolution: { url: 'https://e', key: 'k', instance: 'i' }, fetchImpl: async (u, o) => { sent.push(JSON.parse(o.body).text); return { ok: true }; } });
  await g.tick();
  assert.match(sent[0], /Etiqueta NÃO impressa\* · Mercado Livre/); assert.match(sent[0], /Motivo: NCM inválido/);
  state.ml[0] = { ...state.ml[0], status: 'printed', last_error: null, tracking_number: 'BR123' };
  await g.tick();
  assert.match(sent[1], /🖨️✅ \*Etiqueta impressa\* · Mercado Livre/); assert.match(sent[1], /BR123/);
});

test('evento da Shopee (Lenovo): sem repetir', async () => {
  const state = { cfg: { group_jid: '1203@g.us', baseline_done: '1' }, sent: new Set(), sales: [] };
  const sent = [];
  const g = createMarketplaceSalesGroup({ pool: fakePool(state), delayMs: 0, evolution: { url: 'https://e', key: 'k', instance: 'i' }, fetchImpl: async (u, o) => { sent.push(JSON.parse(o.body).text); return { ok: true }; } });
  await g.printEvent({ order: '2511AB', ok: false, stage: 'Nota fiscal', reason: 'NCM 85177099 inválido', instructions: 'Corrija o NCM no Bling', connection: 'g1' });
  await g.printEvent({ order: '2511AB', ok: false, stage: 'Nota fiscal', reason: 'NCM 85177099 inválido', connection: 'g1' });
  assert.equal(sent.length, 1); assert.match(sent[0], /Shopee G/); assert.match(sent[0], /O que fazer: Corrija o NCM/);
});

test('rastreio da Shopee no aviso de etiqueta impressa', async () => {
  const state = { cfg: { group_jid: '1203@g.us', baseline_done: '1' }, sent: new Set(), sales: [] };
  const sent = [];
  const g = createMarketplaceSalesGroup({ pool: fakePool(state), delayMs: 0, evolution: { url: 'https://e', key: 'k', instance: 'i' }, fetchImpl: async (u, o) => { sent.push(JSON.parse(o.body).text); return { ok: true }; } });
  await g.printEvent({ order: '2611X', ok: true, connection: 'primary', tracking: ' BR2611X9 ' });
  assert.match(sent[0], /Etiqueta impressa\* · Shopee MV/); assert.match(sent[0], /🚚 Rastreio: BR2611X9$/m);
});

test('aviso de etiqueta traz o resumo do pedido (cliente, itens, SKU, link)', async () => {
  const state = { cfg: { group_jid: '1203@g.us', baseline_done: '1' }, sent: new Set(), sales: [],
    ml: [{ shipment_id: 'S9', order_id: 'O9', pack_id: null, status: 'printed', last_error: null, tracking_number: 'BR9' }] };
  state.sales.push({ ...sale('O9', 'paid'), channel: 'mercado_livre', occurred_at: new Date(Date.now() - 5 * 86400e3) });
  const sent = [];
  const g = createMarketplaceSalesGroup({ pool: fakePool(state), delayMs: 0, evolution: { url: 'https://e', key: 'k', instance: 'i' }, fetchImpl: async (u, o) => { sent.push(JSON.parse(o.body).text); return { ok: true }; } });
  await g.tick();
  const msg = sent.find((x) => /Etiqueta impressa/.test(x));
  assert.match(msg, /👤 Maria · Petrolina\/PE/); assert.match(msg, /\*1x\* Capa A03 \(Rosa\)/); assert.match(msg, /SKU: CCSAGA03ROS/);
  assert.match(msg, /mercadodovale\.com\.br\/produto\/capa-a03/); assert.match(msg, /Total: \*R\$\s?29,90\*/);
});
