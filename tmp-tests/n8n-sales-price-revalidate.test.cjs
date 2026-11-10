'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODES } = require('../scripts/n8n-sales-price-revalidate.cjs');

const path = process.env.MDV_N8N_SALES_SNAPSHOT;
assert.ok(path, 'Defina MDV_N8N_SALES_SNAPSHOT com o snapshot ativo');
const before = JSON.parse(fs.readFileSync(path, 'utf8'));
const after = patchWorkflow(before);
const jid = 'fixture@s.whatsapp.net';
const context = 'Vendas - Contexto Produtos';
const post = NODES[0], resolver = NODES[1];
const fees = Array.from({ length: 12 }, (_, i) => ({ channel: 'presencial', installments: i + 1, applied_fee_pct: 12 }));
const product = (id, color, price, attrs = {}) => ({
  id, model_id: 'redmi-15', model_name: 'Redmi 15', name: 'Redmi 15 ' + color,
  sku: id, brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: price,
  specs: { ram: '8GB', storage: '256GB', color }, slug: id, images: [], ...attrs,
});
const source = { remoteJid: jid, conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria' };

function execute(workflow, name, state, sources, current, feeRows = fees) {
  const code = workflow.nodes.find(n => n.name === name).parameters.jsCode;
  const lookup = node => {
    const values = [].concat(sources[node] || {});
    return { first: () => ({ json: values[0] }), all: () => values.map(json => ({ json })) };
  };
  const helpers = { async httpRequest({ url }) {
    if (current instanceof Error) throw current;
    const endpoint = new URL(url);
    if (endpoint.pathname === '/payment-fees') return fees;
    assert.equal(endpoint.pathname, '/products');
    const ids = endpoint.searchParams.get('in_ids').split(',');
    return current.filter(row => ids.includes(row.id));
  } };
  return new Function('$json', '$input', '$getWorkflowStaticData', '$', 'helpers', code)(
    {}, { all: () => feeRows.map(json => ({ json })) }, () => state, lookup, helpers);
}
function list(rows) {
  const state = {};
  const [{ json }] = execute(before, context, state, {
    'Vendas - Preparar Busca': source, 'Vendas - Buscar Produtos': rows, 'switc Mensagens': source,
  }, rows);
  assert.ok(state.salesPostList[jid].options.length);
  return { state, json };
}
async function say(workflow, state, rows, conversation = 'opção 1', action = 'escolher_item', color = '') {
  const input = { remoteJid: jid, conversation, salesFlowAction: action, ...(action === 'escolher_item' ? { salesFlowItemNumber: 1 } : {}), salesFlowColor: color };
  const [{ json }] = await execute(workflow, post, state, { 'Parse Classificacao': input }, rows);
  return json;
}
const white = price => product('white', 'Branco', price);
const withoutPrice = result => assert.doesNotMatch(result.output, /R\$/);

test('patch idempotente, grafo intacto e somente quatro nós alterados', () => {
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map(n => n.name).sort(), [...NODES].sort());
  for (const n of after.nodes.filter(n => NODES.includes(n.name))) assert.ok(JSON.stringify(n).includes(MARK));
  const broken = structuredClone(before);
  broken.nodes.find(n => n.name === resolver).parameters.jsCode = '';
  assert.throws(() => patchWorkflow(broken), /Âncora/);
});
test('122400 atuais preservam a saída do snapshot', async () => {
  const { state } = list([white(122400)]);
  assert.equal((await say(after, structuredClone(state), [white(122400)])).output,
    (await say(before, state, [white(122400)])).output);
});
test('119000 substitui a cotação de 122400 e recalcula cartão', async () => {
  const { state } = list([white(122400)]);
  const result = await say(after, state, [white(119000)]);
  assert.equal(result.orderDraft.unitPriceCents, 119000);
  assert.match(result.output, /R\$\s1\.190,00/);
  assert.match(result.output, /12x de R\$\s111,07/);
  assert.match(result.output, /Valor atualizado hoje\./);
  assert.doesNotMatch(result.output, /1\.224,00/);
});
test('produto inativo, zerado, ausente ou falha no GET não expõe preço', async () => {
  for (const current of [[product('white', 'Branco', 119000, { status: 'inactive' })],
    [product('white', 'Branco', 119000, { stock_quantity: 0 })], [], new Error('GET failed')]) {
    const { state } = list([white(122400)]);
    const result = await say(after, state, current);
    withoutPrice(result);
    assert.match(result.output, /lista atualizada/);
  }
});
test('parcelamento revalida o rascunho e usa 119000', async () => {
  const { state } = list([white(122400)]);
  const draft = { productId: 'white', name: 'Redmi 15', memory: '8GB/256GB', unitPriceCents: 122400, quantity: 1 };
  const [{ json }] = await execute(after, resolver, state, { [post]: { remoteJid: jid, orderDraft: draft } }, [white(119000)]);
  assert.equal(json.orderDraft.unitPriceCents, 119000);
  assert.match(json.output, /R\$\s111,07/);
  assert.match(json.output, /Valor atualizado hoje\./);
});
test('cores com preços diferentes continuam cotadas pelo maior valor da configuração', async () => {
  const rows = [white(102200), product('black', 'Preto', 109000)].map(p => ({ ...p, specs: { ...p.specs, ram: '4GB' } }));
  const { state, json } = list(rows);
  assert.match(json.deterministicCatalogOutput, /R\$\s1\.090,00/);
  const result = await say(after, state, rows, 'opção 1 branco', 'escolher_item', 'Branco');
  assert.equal(result.orderDraft?.unitPriceCents, 109000, result.output);
  assert.doesNotMatch(result.output, /Valor atualizado hoje/);
  const updated = await say(after, list(rows).state, [rows[0], { ...rows[1], stock_quantity: 0 }]);
  assert.equal(updated.orderDraft.unitPriceCents, 102200);
  assert.match(updated.output, /R\$\s1\.022,00/);
  assert.match(updated.output, /Valor atualizado hoje/);
  const unavailable = await say(after, list(rows).state, [rows[0], { ...rows[1], stock_quantity: 0 }], 'opção 1 preto', 'escolher_item', 'Preto');
  withoutPrice(unavailable);
  assert.match(unavailable.output, /Essa cor não está mais disponível.*Branco/);
});
test('promoção divide a opção e a escolha seguinte usa o grupo da cor', async () => {
  const rows = [product('purple', 'Roxo', 135000), product('black', 'Preto', 135000), product('titanium', 'Titânio', 135000)];
  const current = [{ ...rows[0], price_effective: 122400, promo_active: true, promo_end: '2026-11-30T23:59:59Z' }, ...rows.slice(1)];
  const { state } = list(rows);
  const updated = await say(after, state, current);
  assert.match(updated.output, /Roxo: R\$\s1\.224,00.*promoção até 30\/11/);
  assert.match(updated.output, /Preto, Titânio: R\$\s1\.350,00/);
  assert.match(updated.output, /Valor atualizado hoje\./);
  assert.match(updated.output, /Qual cor você prefere/);
  const choice = await say(after, state, current, 'roxo', 'informar_cor', 'Roxo');
  assert.equal(choice.orderDraft?.productId, 'purple');
  assert.equal(choice.orderDraft?.unitPriceCents, 122400);
  assert.doesNotMatch(choice.output, /Valor atualizado hoje/);
});
