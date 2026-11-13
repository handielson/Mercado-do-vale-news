// shopee-retry-until-printed-v1: o agente precisa continuar tentando a cada ciclo de 5 min até imprimir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const agent = require('../scripts/shopee-auto-print.cjs');
const script = fs.readFileSync(path.join(__dirname, '../scripts/shopee-auto-print.cjs'), 'utf8');

const connection = { id: 'primary', displayName: 'Teste' };
const okList = (orders, more = false, next = '') => ({ ok: true, data: { response: { order_list: orders, more, next_cursor: next } } });

test('ciclo continua a cada 5 minutos', () => {
  assert.match(script, /POLLING_INTERVAL\s*=\s*5 \* 60 \* 1000/);
  assert.match(script, /setInterval\(\(\) => void runLoop\(\), POLLING_INTERVAL\)/);
});

test('lista todas as páginas de READY_TO_SHIP', async () => {
  const calls = [];
  const callAction = async (action, payload) => {
    calls.push(payload);
    if (payload.order_status === 'PROCESSED') return okList([]);
    return payload.cursor ? okList([{ order_sn: 'B' }]) : okList([{ order_sn: 'A' }], true, 'c1');
  };
  const orders = await agent.listShopeeOrdersToPrint(connection, callAction, () => false);
  assert.deepEqual(orders.map(o => o.order_sn), ['A', 'B']);
  assert.ok(calls.some(c => c.cursor === 'c1'));
});

test('pedido já preparado (PROCESSED) sem impressão concluída volta para a fila', async () => {
  const markers = agent.orderPrintStatePaths('P1', 'primary');
  const callAction = async (action, payload) => payload.order_status === 'PROCESSED'
    ? okList([{ order_sn: 'P1' }, { order_sn: 'P2' }, { order_sn: 'P3' }])
    : okList([]);
  const shippedOnly = new Set([markers.shipped, agent.orderPrintStatePaths('P3', 'primary').shipped, agent.orderPrintStatePaths('P3', 'primary').legacy]);
  const orders = await agent.listShopeeOrdersToPrint(connection, callAction, p => shippedOnly.has(p));
  // P1: preparado e pendente -> volta; P2: não foi preparado pelo agente -> fora; P3: já concluído -> fora.
  assert.deepEqual(orders.map(o => o.order_sn), ['P1']);
});

test('não repete ship_order quando o envio já foi preparado', () => {
  assert.match(script, /fs\.existsSync\(markers\.shipped\)\s*\?\s*\{ success: true, stage: 'ship_order', already_shipped: true \}/);
  assert.match(script, /markPrintStep\(markers\.shipped\)/);
});
