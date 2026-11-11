'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODES, ROUTER } = require('../scripts/n8n-payjoy-approved-list.cjs');

const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT || process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT;
assert.ok(snapshot, 'Snapshot ativo exato obrigatório');
const original = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const workflow = patchWorkflow(original);
const category = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const jid = 'fixture@s.whatsapp.net';
const fees = Array.from({ length: 12 }, (_, i) => ({ channel: 'presencial', installments: i + 1, applied_fee_pct: 11.9 }));
const lastMessage = 'Esses são os aparelhos dentro do valor aprovado. Se quiser um mais caro, é só dar a diferença na entrada. Qual você prefere? 😊';
const calculation = (amountCents = 140000, percentBp = 3000) => ({ amountCents, percentBp, entryCents: Math.round(amountCents * percentBp / 10000) });
const source = (extra = {}) => ({ remoteJid: jid, conversation: 'Aprovou R$ 1.400,00 com entrada de 30%', messageId: 'synthetic-approval',
  output: 'A PayJoy aprovou R$ 1.400,00. Sua entrada calculada é R$ 420,00.', payjoyCalculation: calculation(), ...extra });
const product = (id, model = 'Redmi 15', price = 120000, color = 'Branco', extra = {}) => ({
  id, sku: id, slug: id, model_id: model, model_name: model, name: model + ' Cor:' + color,
  brand: 'Xiaomi', category_id: category, status: 'active', stock_quantity: 1,
  hide_from_catalog: false, price_retail: price, price_effective: price, promo_active: false,
  specs: { ram: '8GB', storage: '256GB', color }, images: [], ...extra,
});

async function execute(name, { input = {}, all = [input], sources = {}, state = {}, products = [], feeRows = fees } = {}) {
  const node = workflow.nodes.find(n => n.name === name);
  assert.ok(node, 'Nó ausente: ' + name);
  const lookup = key => {
    if (!Object.hasOwn(sources, key)) throw new Error('Upstream fixture ausente: ' + key);
    const rows = [].concat(sources[key]).map(json => ({ json }));
    return { first: () => rows[0], all: () => rows };
  };
  const helpers = { async httpRequest({ url }) {
    const u = new URL(url);
    if (u.pathname === '/payment-fees') return feeRows;
    assert.equal(u.pathname, '/products');
    const ids = u.searchParams.get('in_ids')?.split(',') || [];
    const sku = u.searchParams.get('sku');
    return products.filter(p => (!ids.length || ids.includes(p.id)) && (!sku || p.sku === sku));
  } };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', 'helpers', '$execution', '$runIndex', node.parameters.jsCode)(
    input, { first: () => ({ json: input }), all: () => all.map(json => ({ json })) }, lookup, () => state, helpers, { id: 'synthetic' }, 0);
}

async function list(products, { input = source(), state = {}, feeRows = fees } = {}) {
  const prepared = (await execute('Vendas - Preparar Busca', { input, state }))[0].json;
  const context = (await execute('Vendas - Contexto Produtos', { state, all: feeRows, sources: {
    'Vendas - Preparar Busca': prepared, 'Vendas - Buscar Produtos': products, 'switc Mensagens': input,
  } }))[0].json;
  const composed = (await execute('Vendas - Catalogo sem IA', { input: context, state }))[0].json;
  const sent = await execute('Dividir mensagens', { input: composed, state, sources: {
    'switc Mensagens': input, 'Resolver Acao de Conversacao': input, 'Contato - Resolver': {}, 'Contato - Preparar': {},
  } });
  return { state, input, prepared, context, composed, sent, text: sent.map(x => x.json.message || x.json.text || '').join('\n') };
}

test('patch puro, idempotente, credenciais preservadas e rotas de aprovação antes da persistência', () => {
  const copy = structuredClone(original);
  assert.deepEqual(patchWorkflow(workflow), workflow);
  assert.deepEqual(original, copy);
  for (const old of original.nodes) {
    const current = workflow.nodes.find(n => n.id === old.id);
    assert.ok(current, old.name);
    assert.deepEqual(current.credentials, old.credentials, old.name);
    if (!NODES.includes(old.name)) assert.deepEqual(current, old, old.name);
  }
  assert.equal(MARK, 'payjoy-approved-list-v1');
  assert.equal(workflow.connections['PayJoy - Calcular entrada do print'].main[0][0].node, ROUTER);
  assert.equal(workflow.connections['PayJoy - Precisa especialista?'].main[1][0].node, ROUTER);
  assert.equal(workflow.connections[ROUTER].main[0][0].node, 'Vendas - Preparar Busca');
  assert.equal(workflow.connections[ROUTER].main[1][0].node, 'Estado Conversa - Preparar');
  const bypass = workflow.connections['Vendas - Preparar Busca'].main[0][0].node;
  assert.equal(workflow.connections[bypass].main[0][0].node, 'Vendas - Buscar Produtos');
  assert.equal(workflow.connections[bypass].main[1][0].node, 'Vendas - Persistir Preferencias');
  const partial = structuredClone(workflow);
  const partialNode = partial.nodes.find(n => n.name === 'Vendas - Preparar Busca');
  partialNode.parameters.jsCode = partialNode.parameters.jsCode.split(MARK).join('fixture-marker-removed');
  assert.throws(() => patchWorkflow(partial), /parcialmente|Marcador/);
});

test('1400 a 30% mantém entrada 420, lista a configuração elegível e separa a pergunta final', async () => {
  const r = await list([product('redmi-white'), product('redmi-black', 'Redmi 15', 120000, 'Preto')]);
  assert.equal(r.prepared.payjoyApprovedListV1, true);
  assert.equal(r.prepared.productCategoryId, category);
  assert.equal(r.prepared.productSearchKind, 'categoria');
  assert.equal(r.prepared.payjoyCalculation.entryCents, 42000);
  assert.match(r.composed.output, /^A PayJoy aprovou R\$ 1\.400,00\. Sua entrada calculada é R\$ 420,00\./);
  assert.match(r.composed.output, /Com a sua aprovação de R\$\s1\.400,00 \(entrada de R\$\s420,00\), estes aparelhos cabem no valor:/);
  assert.match(r.composed.output, /Redmi 15/);
  assert.match(r.composed.output, /8\s*GB\s*\/\s*256\s*GB/i);
  assert.match(r.composed.output, /PIX/);
  assert.match(r.composed.output, /12x/);
  assert.match(r.composed.output, /Branco.*Preto|Preto.*Branco/);
  assert.ok(r.composed.output.endsWith(lastMessage));
  const messages = r.sent.map(x => x.json.message || x.json.text || '');
  assert.equal(messages[messages.length - 1], lastMessage);
  assert.equal(r.state.salesPostList[jid].step, 'awaiting_product_choice');
  assert.equal(r.state.salesPostList[jid].options.length, 1);
});

test('fronteira usa total inteiro da maquininha, sem subtrair entrada nem comparar parcela', async () => {
  const excluded = product('boundary', 'Redmi 15', 134900);
  assert.equal(Math.round(134900 * 1.119), 150953);
  const r = await list([excluded, product('fits', 'Modelo cabe', 120000)]);
  assert.equal(r.state.salesPostList[jid].options.length, 1);
  assert.equal(r.state.salesPostList[jid].options[0].name, 'Modelo cabe');
  assert.doesNotMatch(r.composed.output, /Redmi 15/);
  const exact = await list([excluded], { input: source({ payjoyCalculation: calculation(150953) }) });
  assert.equal(exact.state.salesPostList[jid].options[0].name, 'Redmi 15');
  const below = await list([excluded], { input: source({ payjoyCalculation: calculation(150952) }) });
  assert.ok(!below.state.salesPostList[jid]?.options?.length);
});

test('maior preço por configuração é aplicado antes de elegibilidade, sem vazar a cor barata', async () => {
  const r = await list([product('cheap-color'), product('expensive-color', 'Redmi 15', 134900, 'Preto')]);
  assert.ok(!r.state.salesPostList[jid]?.options?.length);
  assert.doesNotMatch(r.composed.output, /1\. Redmi 15/);
});

test('preço efetivo e ordenação global decrescente prevalecem sobre ordem por marca', async () => {
  const r = await list([product('xiaomi-cheap', 'Redmi 15', 100000),
    product('motorola-expensive', 'Moto G', 125000, 'Preto', { brand: 'Motorola' }),
    product('promo', 'Realme promo', 160000, 'Azul', { brand: 'Realme', price_effective: 120000, promo_active: true })]);
  const options = r.state.salesPostList[jid].options;
  assert.deepEqual(options.map(o => o.name), ['Moto G', 'Realme promo', 'Redmi 15']);
  assert.deepEqual(options.map(o => o.number), [1, 2, 3]);
  assert.deepEqual(options.map(o => o.priceCents), [125000, 120000, 100000]);
  assert.ok(r.composed.output.indexOf('Moto G') < r.composed.output.indexOf('Realme promo'));
  assert.ok(r.composed.output.indexOf('Realme promo') < r.composed.output.indexOf('Redmi 15'));
});

test('nenhum elegível oferece lista completa, sem lista vazia nem seleção antiga', async () => {
  const state = { salesPostList: { [jid]: { step: 'awaiting_product_choice', options: [{ number: 1, name: 'Antigo' }] } } };
  const r = await list([product('too-expensive', 'Modelo caro', 200000)], { state });
  assert.match(r.composed.output, /nenhum|não.*aparelho|nao.*aparelho/i);
  assert.match(r.composed.output, /diferença na entrada/);
  assert.match(r.composed.output, /lista completa/i);
  assert.ok(!state.salesPostList[jid]?.options?.length);
  assert.doesNotMatch(r.composed.output, /Antigo|1\. Modelo caro/);
});

test('aprovação incompleta não prepara GET nem lista e preserva pergunta de confirmação', async () => {
  const router = workflow.nodes.find(n => n.name === ROUTER);
  const expression = router.parameters.conditions.conditions[0].leftValue;
  const route = input => new Function('$json', 'return ' + expression.slice(3, -2))(input);
  for (const c of [{ amountCents: 140000, percentBp: null, entryCents: null }, { amountCents: null, percentBp: 3000, entryCents: null }]) {
    const input = source({ payjoyCalculation: c, output: 'Me confirma o dado que falta?' });
    assert.equal(route(input), false);
    const result = (await execute('Vendas - Preparar Busca', { input }))[0].json;
    assert.notEqual(result.payjoyApprovedListV1, true);
  }
  assert.equal(route(source()), true);
  assert.equal(route(source({ output: 'Não consegui ler o print.' })), false, 'cálculo antigo não reabre a lista em falha de OCR');
  assert.equal(route(source({ payjoyCalculation: { ...calculation(), entryCents: 1 } })), false);
});

test('0% é aprovação completa e taxa 12x inválida ou ausente nunca vira financiamento sem juros', async () => {
  const zero = await list([product('zero-entry')], { input: source({ payjoyCalculation: calculation(140000, 0) }) });
  assert.equal(zero.prepared.payjoyApprovedListV1, true);
  assert.match(zero.composed.output, /entrada de R\$\s0,00/);
  assert.equal(zero.state.salesPostList[jid].options.length, 1);
  for (const feeRows of [[], ...[null, '', 'invalid', -1].map(applied_fee_pct => [{ channel: 'presencial', installments: 12, applied_fee_pct }])]) {
    const r = await list([product('without-valid-fee')], { feeRows });
    assert.ok(!r.state.salesPostList[jid]?.options?.length);
    assert.match(r.composed.output, /confirmar.*12x|tabela.*12x/i);
    assert.doesNotMatch(r.composed.output, /1\. Redmi 15/);
  }
});

test('taxa 12x usa mesma menor taxa presencial do parcelamento e ignora tarifas de outros canais', async () => {
  const feeRows = [
    { channel: 'online', installments: 12, applied_fee_pct: 0 },
    { channel: 'presencial', installments: 6, applied_fee_pct: 0 },
    { channel: 'presencial', installments: 12, applied_fee_pct: 20 },
    { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 },
  ];
  const r = await list([product('right-fee', 'Redmi 15', 125000)], { feeRows });
  assert.equal(r.state.salesPostList[jid].options[0].card.totalCents, 139875);
});

test('Meta usa a mesma lista e mantém identidade opaca e estado de escolha', async () => {
  const remoteJid = 'meta:instagram:fixture-account:fixture-participant:dm';
  const metaAttendance = { eventKey: 'a'.repeat(64), conversationKey: 'instagram:fixture-account:fixture-participant:dm', channel: 'instagram' };
  const r = await list([product('meta-product')], { input: source({ remoteJid, metaAttendance }) });
  assert.deepEqual(r.composed.metaAttendance, metaAttendance);
  assert.equal(r.composed.remoteJid, remoteJid);
  assert.equal(r.state.salesPostList[remoteJid].options[0].name, 'Redmi 15');
  assert.ok(r.composed.output.endsWith(lastMessage));
});

test('escolha pelo número ou nome retoma fotos por cor e rascunho sem perder a lista PayJoy', async () => {
  for (const conversation of ['1', 'Redmi 15']) {
    const rows = [product('white'), product('black', 'Redmi 15', 120000, 'Preto')];
    const state = { payjoyByJid: { [jid]: { status: 'approved', approvedAmountCents: 140000, entryPercentBp: 3000,
      updatedAt: Date.now(), expiresAt: Date.now() + 86400000 } } };
    await list(rows, { state });
    // A named choice carries the same semantic option number supplied by the
    // normal classifier; a bare number additionally has the deterministic path.
    const choice = { remoteJid: jid, conversation, salesFlowAction: 'escolher_item',
      salesFlowItemNumber: 1, salesFlowColor: '' };
    const post = (await execute('Vendas - Verificar Pos Lista', { state, products: rows, sources: { 'Parse Classificacao': choice } }))[0].json;
    assert.equal(post.salesPostListHandled, true, conversation + ': ' + JSON.stringify(post));
    assert.equal(state.salesPostList[jid].selectedOptionNumber, 1);
    assert.equal(state.salesPostList[jid].step, 'awaiting_color');
    assert.match(post.output, /Qual cor/);
    const color = { remoteJid: jid, conversation: 'branco', salesFlowAction: 'informar_cor', salesFlowColor: 'Branco' };
    const selected = (await execute('Vendas - Verificar Pos Lista', { state, products: rows, sources: { 'Parse Classificacao': color } }))[0].json;
    assert.equal(selected.orderDraft.productId, 'white');
    assert.equal(selected.orderDraft.unitPriceCents, 120000);
  }
});
