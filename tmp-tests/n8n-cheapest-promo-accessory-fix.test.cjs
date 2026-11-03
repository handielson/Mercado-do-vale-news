'use strict';
// Conversa real de 03/11/2026 reproduzida com dados de teste (nenhum dado de cliente):
// "Quais as promoções" → capa; "Celulares em conta mais barato" → nada; fotos/escolha → "combinação de memória e cor" em loop.
// O snapshot exato vem de MDV_N8N_SALES_SNAPSHOT (antes da correção); a correção é aplicada aqui e comparada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODES } = require('../scripts/n8n-cheapest-promo-accessory-fix.cjs');

const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
assert.ok(snapshot, 'MDV_N8N_SALES_SNAPSHOT deve apontar para o workflow exportado');
const original = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const alreadyPatched = original.nodes.some(node => node.parameters?.jsCode?.includes(MARK));
const before = original;
const after = patchWorkflow(original);
const jid = '5587990000000@s.whatsapp.net'; // sintético

function runner(workflow) {
  const nodes = new Map(workflow.nodes.map(node => [node.name, node]));
  return (name, input = {}, sources = {}, state = {}, all = [input]) => {
    const code = nodes.get(name).parameters.jsCode;
    const lookup = source => {
      assert.ok(Object.hasOwn(sources, source), `upstream sem mock: ${source} em ${name}`);
      const values = Array.isArray(sources[source]) ? sources[source] : [sources[source]];
      return { first: () => ({ json: values[0] }), all: () => values.map(json => ({ json })), item: { json: values[0] } };
    };
    return new Function('$json', '$input', '$', '$getWorkflowStaticData', '$execution', '$runIndex', code)(
      input, { all: () => all.map(json => ({ json })), first: () => ({ json: input }) }, lookup, () => state, { id: '900001' }, 0);
  };
}
const fees = [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }];
const capa = { id: 'fixture-capa', model_id: 'fixture-capa-model', model_name: 'Capa Transparente Poco X6', name: 'Capa Transparente Poco X6',
  brand: 'Genérico', status: 'active', stock_quantity: 5, price_retail: 1490, specs: { color: 'Transparente' }, slug: 'fixture-capa', images: [], category_name: 'Capas' };
const phone = (id, model, ram, storage, color, price) => ({ id, model_id: model, model_name: model, name: `${model} ${color}`, brand: 'Xiaomi',
  status: 'active', stock_quantity: 1, price_retail: price, specs: { ram, storage, color }, slug: id, images: [], category_name: 'Celulares' });
const phones = [phone('fixture-a', 'Redmi 15', '8GB', '256GB', 'Preto', 122400), phone('fixture-b', 'Redmi A5', '3GB', '64GB', 'Azul', 59900),
  phone('fixture-c', 'Poco X7', '12GB', '512GB', 'Preto', 249900), phone('fixture-d', 'Redmi 15C', '4GB', '128GB', 'Verde', 89900), capa];

const prepare = (workflow, conversation) => runner(workflow)('Vendas - Preparar Busca', { remoteJid: jid, conversation, salesFlowAction: 'nova_busca' })[0].json;
const context = (workflow, base, rows, state) => runner(workflow)('Vendas - Contexto Produtos', {},
  { 'Vendas - Preparar Busca': base, 'Vendas - Buscar Produtos': rows, 'switc Mensagens': base }, state, fees)[0].json;
const say = async (workflow, state, conversation, extra = {}) => (await runner(workflow)('Vendas - Verificar Pos Lista', {},
  { 'Parse Classificacao': { remoteJid: jid, conversation, salesFlowAction: 'indefinido', ...extra } }, state))[0]?.json;

test('a correção só altera os três Code nodes previstos e é idempotente', () => {
  const changed = after.nodes.filter((node, index) => node.parameters?.jsCode !== before.nodes[index].parameters?.jsCode).map(node => node.name);
  assert.deepEqual(changed, alreadyPatched ? [] : NODES);
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(patchWorkflow(after), after);
});

test('"Celulares em conta mais barato" e "Quais as promoções" listam a categoria Celulares, do mais barato', () => {
  for (const text of ['Celulares em conta mais barato', 'Quais as promoções', 'tem celular barato?', 'me mostra os celulares mais em conta']) {
    const base = prepare(after, text);
    assert.equal(base.productCategoryId, '8b7c4852-c195-4527-8fd7-c3cc2debda42', text);
    assert.equal(base.productSearchKind, 'categoria', text);
    assert.equal(base.salesCheapestFirstV1, true, text);
  }
  if (!alreadyPatched) assert.equal(prepare(before, 'Celulares em conta mais barato').productCategoryId, '', 'antes: busca por texto (o defeito)');
});

test('pedidos específicos continuam como eram', () => {
  for (const text of ['capa barata', 'fone em promoção', 'Redmi 15 barato', 'quero um celular']) {
    assert.notEqual(prepare(after, text).salesCheapestFirstV1, true, text);
    assert.deepEqual({ ...prepare(after, text), salesCheapestFirstV1: undefined, salesCatalogIntentV1: undefined },
      { ...prepare(before, text), salesCheapestFirstV1: undefined, salesCatalogIntentV1: undefined }, text);
  }
});

test('lista "mais em conta": só celulares, menor preço primeiro, título próprio, e substitui a lista anterior', () => {
  const state = {};
  context(after, { ...prepare(after, 'Quais as promoções'), remoteJid: jid }, [capa], state); // lista antiga (como a capa do cliente)
  const result = context(after, { ...prepare(after, 'Celulares em conta mais barato'), remoteJid: jid }, phones, state);
  const list = state.salesPostList[jid];
  assert.equal(list.flow, 'sales_post_list');
  assert.ok(list.options.every(option => !/capa/i.test(option.name)), 'acessório não entra na lista de celulares');
  const prices = list.options.map(option => Number(option.priceCents || option.memoryOptions?.[0]?.priceCents || 0));
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b), 'menor preço primeiro');
  assert.match(list.options[0].name, /Redmi A5/);
  assert.match(JSON.stringify(result), /Celulares mais em conta/);
});

test('acessório aberto: escolher, pedir foto ou "1" não cai mais em "combinação de memória e cor"', async () => {
  for (const [text, extra] of [['Pode mandar as fotos por favor', { salesFlowAction: 'pedir_foto', salesFlowItemNumber: 1 }],
    ['Manda', { salesFlowItemNumber: 1 }], ['1', {}]]) {
    const state = {};
    context(after, { conversation: 'capa poco x6', productSearchTerm: 'capa poco x6', productSearchKind: 'busca', remoteJid: jid }, [capa], state);
    const result = await say(after, state, text, extra);
    assert.doesNotMatch(JSON.stringify(result || {}), /combinação de memória e cor/, text);
    if (!alreadyPatched && text !== 'Manda') {
      const oldState = {};
      context(before, { conversation: 'capa poco x6', productSearchTerm: 'capa poco x6', productSearchKind: 'busca', remoteJid: jid }, [capa], oldState);
      assert.match(JSON.stringify(await say(before, oldState, text, extra)), /combinação de memória e cor/, 'antes: o defeito');
    }
  }
});

test('celular com várias memórias continua pedindo a versão', async () => {
  const state = {};
  const twoMemories = [phone('fixture-m1', 'Redmi 15', '6GB', '128GB', 'Preto', 99900), phone('fixture-m2', 'Redmi 15', '8GB', '256GB', 'Preto', 122400)];
  context(after, { conversation: 'redmi 15', productSearchTerm: 'redmi 15', productSearchKind: 'busca', remoteJid: jid }, twoMemories, state);
  const option = state.salesPostList[jid].options.find(item => /Redmi 15/.test(item.name));
  const result = await say(after, state, String(option.number), { salesFlowAction: 'escolher_item', salesFlowItemNumber: option.number });
  assert.ok(result?.salesPostListHandled);
});
