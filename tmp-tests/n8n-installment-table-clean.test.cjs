'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const test = require('node:test');
const { patchWorkflow, MARK, NODES } = require('../scripts/n8n-installment-table-clean.cjs');

assert.ok(process.env.MDV_N8N_SALES_SNAPSHOT, 'Defina MDV_N8N_SALES_SNAPSHOT com o snapshot ativo');
const before = JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT, 'utf8'));
const after = patchWorkflow(before);
const [resolver, post] = NODES;
const jid = 'fixture@s.whatsapp.net';
const fees = [0, 5.09, 5.78, 6.46, 7.14, 7.81, 8.67, 9.33, 9.98, 10.62, 11.26, 11.90]
  .map((applied_fee_pct, i) => ({ channel: 'presencial', installments: i + 1, applied_fee_pct }));
const draft = { productId: 'redmi-preto', name: 'Redmi 15', memory: '8GB/256GB', color: 'Preto', unitPriceCents: 134900, quantity: 1 };
const product = {
  id: draft.productId, sku: 'SKU-REDMI', model_id: 'redmi-15', model_name: draft.name, name: 'Redmi 15 Preto',
  brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_effective: 134900, price_retail: 134900,
  specs: { ram: '8GB', storage: '256GB', color: 'Preto' },
};
const run = (workflow, nodeName, { input = {}, items = [input], sources = {}, state = {}, price = 134900 } = {}) => {
  const code = workflow.nodes.find(node => node.name === nodeName).parameters.jsCode;
  const wrap = values => [].concat(values).map(json => ({ json }));
  const lookup = name => {
    assert.ok(Object.hasOwn(sources, name), 'Fixture ausente: ' + name);
    const rows = wrap(sources[name]);
    return { all: () => rows, first: () => rows[0] };
  };
  const helpers = { async httpRequest({ url }) {
    assert.equal(new URL(url).pathname, '/products');
    return [{ ...product, price_effective: price, price_retail: price }];
  } };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', 'helpers', code)(input, { all: () => wrap(items) }, lookup, () => state, helpers);
};
function createState() {
  const search = { remoteJid: jid, conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria' };
  const state = {};
  run(before, 'Vendas - Contexto Produtos', { items: fees, state, sources: {
    'Vendas - Preparar Busca': search, 'Vendas - Buscar Produtos': [product], 'switc Mensagens': search,
  } });
  Object.assign(state.salesPostList[jid], { step: 'awaiting_purchase_confirmation', orderDraft: { ...draft } });
  return state;
}

async function resolve(workflow, fields = {}, price = 134900) {
  const state = createState();
  const source = { remoteJid: jid, orderDraft: { ...draft }, paymentQuoteOnly: true, requestedInstallments: 12, ...fields };
  const [{ json }] = await run(workflow, resolver, { sources: { 'Vendas - Verificar Pos Lista': source }, items: fees, state, price });
  return { json, state: state.salesPostList[jid], lines: json.output.replaceAll('\u00a0', ' ').split('[[BR]]') };
}
const clean = result => assert.doesNotMatch(result.json.output, /\btotal\b|Tabela da maquininha|\bEm \d+x/i);
const withoutTimestamp = ({ createdAt, expiresAt, updatedAt, ...data }) => data;

test('patch idempotente, nós esperados e grafo intacto; rejeita deriva de âncora', () => {
  assert.deepEqual(patchWorkflow(after), after);
  assert.deepEqual(after.connections, before.connections);
  const expected = before.nodes.filter(n => NODES.includes(n.name) && !n.parameters.jsCode.includes(MARK)).map(n => n.name);
  assert.deepEqual(after.nodes.filter((node, i) => JSON.stringify(node) !== JSON.stringify(before.nodes[i])).map(n => n.name), expected);
  for (const name of NODES) assert.ok(after.nodes.find(n => n.name === name).parameters.jsCode.includes(MARK));
  const broken = structuredClone(before);
  const p = broken.nodes.find(n => n.name === post).parameters;
  p.jsCode = p.jsCode.replace('const installmentQuoteRequestV1 = (Boolean(installmentQuoteMatchV1)', 'const installmentQuoteRequestV1 = false;');
  assert.throws(() => patchWorkflow(broken), /Âncora/);
});

test('Redmi 15: doze linhas com os mesmos valores da execução 74438', async () => {
  const original = await resolve(before);
  const result = await resolve(after);
  if (!before.nodes.find(n => n.name === resolver).parameters.jsCode.includes(MARK)) assert.match(original.json.output, /Em 12x/);
  clean(result);
  assert.deepEqual(result.lines, [
    'Redmi 15 - 8GB/256GB - Preto:',
    '1x de R$ 1.349,00',
    '2x de R$ 708,83 (R$ 1.417,66)',
    '3x de R$ 475,66 (R$ 1.426,97)',
    '4x de R$ 359,04 (R$ 1.436,15)',
    '5x de R$ 289,06 (R$ 1.445,32)',
    '6x de R$ 242,39 (R$ 1.454,36)',
    '7x de R$ 209,42 (R$ 1.465,96)',
    '8x de R$ 184,36 (R$ 1.474,86)',
    '9x de R$ 164,85 (R$ 1.483,63)',
    '10x de R$ 149,23 (R$ 1.492,26)',
    '11x de R$ 136,45 (R$ 1.500,90)',
    '12x de R$ 125,79 (R$ 1.509,53)',
  ]);
  assert.deepEqual(withoutTimestamp(result.state), withoutTimestamp(original.state));
  assert.deepEqual(result.json.orderDraft, original.json.orderDraft);
});

test('entrada e saldo permanecem e a escolha da parcela usa os mesmos dados', async () => {
  for (const paymentQuoteOnly of [true, false]) {
    const fields = { paymentQuoteOnly, downPaymentCents: 34900, downPaymentMethod: 'PIX' };
    const original = await resolve(before, fields);
    const result = await resolve(after, fields);
    clean(result);
    assert.match(result.lines.join('\n'), /Entrada PIX: R\$ 349,00\nSaldo para o cartao: R\$ 1.000,00\nRedmi 15 - 8GB\/256GB - Preto:/);
    assert.ok(result.lines.includes('1x de R$ 1.000,00'));
    assert.ok(result.lines.includes('2x de R$ 525,45 (R$ 1.050,90)'));
    assert.ok(result.lines.includes('12x de R$ 93,25 (R$ 1.119,00)'));
    if (!paymentQuoteOnly) assert.equal(result.lines.at(-1), 'Qual opcao voce prefere?');
    assert.deepEqual(withoutTimestamp(result.state), withoutTimestamp(original.state));
    assert.deepEqual(result.json.orderDraft, original.json.orderDraft);
  }
});

test('a recotação permanece e o WhatsApp e Meta recebem a mesma tabela', async () => {
  const result = await resolve(after, {}, 119000);
  assert.equal(result.json.orderDraft.unitPriceCents, 119000);
  assert.equal(result.lines[0], 'Valor atualizado hoje.');
  const messages = run(after, 'Dividir mensagens', { input: result.json }).map(v => v.json);
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /Redmi 15 - 8GB\/256GB - Preto:\n1x de R\$\s1\.190,00/);
  const [{ json }] = run(after, 'Meta - Agregar resposta', { items: messages, sources: {
    'switc Mensagens': { metaAttendance: { eventKey: 'fixture', conversationKey: 'fixture' } },
    'Controle Bot - Buscar Controle': { metaAttendanceOk: true },
    'Estado Conversa - Persistir': { metaAttendanceOk: true },
  } });
  assert.deepEqual(json.messages.map(m => m.text), messages.map(m => m.message));
});

test('parcela em quantas vezes aciona o resolver para a opção selecionada', async () => {
  const state = createState();
  const active = state.salesPostList[jid];
  delete active.orderDraft;
  Object.assign(active, { step: 'awaiting_color', selectedOptionNumber: 1 });
  const input = { remoteJid: jid, conversation: 'parcela em quantas vezes?' };
  const [{ json: routed }] = await run(after, post, { state, sources: { 'Parse Classificacao': input } });
  assert.equal(routed.needsPaymentOptionsLookup, true);
  assert.equal(routed.paymentQuoteOnly, true);
  assert.equal(routed.requestedInstallments, 0);
  const [{ json }] = await run(after, resolver, { state, items: fees, sources: { [post]: routed } });
  assert.equal(json.orderDraft.unitPriceCents, 134900);
  assert.match(json.output, /12x de R\$\s125,79 \(R\$\s1\.509,53\)/);
});
