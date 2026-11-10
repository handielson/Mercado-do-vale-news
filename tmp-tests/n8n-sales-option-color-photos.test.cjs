'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { MARK, NODES, patchWorkflow } = require('../scripts/n8n-sales-option-color-photos.cjs');

const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
assert.ok(snapshot, 'MDV_N8N_SALES_SNAPSHOT deve apontar para o workflow ativo');
const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const after = patchWorkflow(before);
const jid = 'fixture@s.whatsapp.net';
const price = 134900;
const question = 'Qual cor você prefere? 😊';
const baseUrl = 'https://api.xiaomipetrolina.com.br/images/';
const fees = [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }];

function run(workflow, nodeName, { input = {}, all = [input], state = {}, sources = {}, helpers } = {}) {
  const node = workflow.nodes.find(n => n.name === nodeName);
  const lookup = name => {
    if (!Object.hasOwn(sources, name)) throw new Error('Upstream fixture ausente: ' + name);
    const rows = [].concat(sources[name]).map(json => ({ json }));
    return { first: () => rows[0], all: () => rows };
  };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', 'helpers', node.parameters.jsCode)(
    input, { all: () => all.map(json => ({ json })) }, lookup, () => state, helpers,
  );
}

function fixture(colors) {
  const state = {};
  const base = { remoteJid: jid, conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria' };
  const products = colors.map((color, i) => ({
    id: 'variant-' + i, sku: 'SKU-' + i, slug: 'redmi15-' + i, model_id: 'model-redmi15',
    model_name: 'Redmi 15', name: 'Redmi 15 ' + color, brand: 'Xiaomi', status: 'active',
    stock_quantity: 1, price_retail: price, price_effective: price, promo_active: false,
    specs: { ram: '8GB', storage: '256GB', color },
    images: [baseUrl + i + '-first.jpg', baseUrl + i + '-second.jpg'],
    model_color_images: [baseUrl + 'model-gallery.jpg'],
  }));
  const sources = { 'Vendas - Preparar Busca': base, 'Vendas - Buscar Produtos': products, 'switc Mensagens': base };
  run(before, 'Vendas - Contexto Produtos', { all: fees, state, sources });
  return { state, products };
}

async function choose(f, { conversation = 'Opção 1', action = 'escolher_item', color = '', workflow = after } = {}) {
  const post = { remoteJid: jid, conversation, salesFlowAction: action, salesFlowItemNumber: 1, salesFlowColor: color };
  const lookups = [];
  const helpers = { async httpRequest({ url }) {
    const endpoint = new URL(url);
    if (endpoint.pathname === '/payment-fees') return fees;
    assert.equal(endpoint.pathname, '/products');
    const ids = endpoint.searchParams.get('in_ids')?.split(',') || [];
    const sku = endpoint.searchParams.get('sku');
    if (sku) lookups.push(sku);
    return f.products.filter(p => (!ids.length || ids.includes(p.id)) && (!sku || p.sku === sku));
  } };
  const [{ json }] = await run(workflow, NODES[0], { state: f.state, sources: { 'Parse Classificacao': post }, helpers });
  const sent = run(workflow, 'Dividir mensagens', { input: json }).map(x => x.json);
  assert.deepEqual(sent.map(x => x.messageIndex), sent.map((x, i) => i + 1));
  return { json, sent, lookups };
}

test('patch idempotente e restrito ao nó de pós-lista, com grafo intacto', () => {
  assert.deepEqual(patchWorkflow(after), after);
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map(n => n.name), NODES);
  assert.ok(after.nodes.find(n => n.name === NODES[0]).parameters.jsCode.includes(MARK));
  assert.equal(before.connections['Meta - Retornar mensagens?'].main[1][0].node, 'Loop - Enviar mensagens em ordem');
});

test('Redmi 15 envia resumo, primeira foto própria de cada cor e pergunta em ordem', async () => {
  const f = fixture(['Preto', 'Titânio', 'Roxo']);
  const baseline = structuredClone(f);
  const original = await choose(baseline, { workflow: before });
  const result = await choose(f);
  assert.deepEqual(result.sent.map(x => x.messageType), ['text', 'image', 'image', 'image', 'text']);
  assert.match(result.sent[0].message, /Redmi 15[\s\S]*8GB\/256GB[\s\S]*1\.349,00[\s\S]*Cartão[\s\S]*Preto, Roxo e Titânio[\s\S]*\/produto\//);
  assert.doesNotMatch(result.sent[0].message, /Qual cor/);
  assert.deepEqual(result.sent.slice(1, 4).map(x => x.caption), ['Redmi 15 · Preto', 'Redmi 15 · Roxo', 'Redmi 15 · Titânio']);
  assert.deepEqual(result.sent.slice(1, 4).map(x => x.mediaUrl), [0, 2, 1].map(i => baseUrl + i + '-first.jpg'));
  assert.equal(result.sent[4].message, question);
  assert.equal(result.json.orderDraft, original.json.orderDraft);
  const draft = await choose(f, { conversation: 'preto', action: 'escolher_cor', color: 'Preto' });
  assert.equal(draft.json.orderDraft.unitPriceCents, price);
  assert.equal(draft.json.orderDraft.color, 'Preto');
  assert.equal(draft.sent.some(x => x.messageType === 'image'), false);
});

test('cor sem imagem própria usa o link exato da variante na mesma posição', async () => {
  const f = fixture(['Preto', 'Titânio', 'Roxo']);
  f.products[1].images = [];
  f.products[1].resolved_images = [baseUrl + 'model-gallery.jpg'];
  const { sent } = await choose(f);
  assert.deepEqual(sent.map(x => x.messageType), ['text', 'image', 'image', 'text', 'text']);
  assert.equal(sent[3].message, 'Titânio: https://mercadodovale.com.br/produto/redmi15-1');
  assert.equal(sent[4].message, question);
});

test('uma cor mantém o rascunho e separa a pergunta de compra do resumo', async () => {
  const f = fixture(['Preto']);
  const { json, sent, lookups } = await choose(f);
  assert.deepEqual(sent.map(x => x.messageType), ['text', 'text']);
  assert.match(sent[0].message, /Redmi 15[\s\S]*1\.349,00/);
  assert.doesNotMatch(sent[0].message, /quer comprar/);
  assert.match(sent[1].message, /quer comprar este modelo/);
  assert.equal(json.orderDraft.unitPriceCents, price);
  assert.deepEqual(lookups, []);
});

test('sete cores enviam só resumo com link do produto e pergunta', async () => {
  const { sent, lookups } = await choose(fixture(['Preto', 'Titânio', 'Roxo', 'Azul', 'Verde', 'Branco', 'Amarelo']));
  assert.deepEqual(sent.map(x => x.messageType), ['text', 'text']);
  assert.match(sent[0].message, /\/produto\/redmi15-/);
  assert.equal(sent[1].message, question);
  assert.deepEqual(lookups, []);
});

test('cor sem estoque e cor oculta ficam fora da sequência', async () => {
  const f = fixture(['Preto', 'Titânio', 'Roxo', 'Azul']);
  f.products[1].stock_quantity = 0;
  f.products[2].hide_from_catalog = 1;
  const { sent } = await choose(f);
  assert.deepEqual(sent.slice(1, -1).map(x => x.caption), ['Redmi 15 · Azul', 'Redmi 15 · Preto']);
  assert.doesNotMatch(sent[0].message, /Titânio|Roxo/);
  assert.equal(sent.at(-1).message, question);
});

test('agregador Meta preserva fotos, legendas e ordem do splitter', async () => {
  const { sent } = await choose(fixture(['Preto', 'Titânio', 'Roxo']));
  const [{ json }] = run(after, 'Meta - Agregar resposta', { all: [...sent].reverse(), sources: {
    'switc Mensagens': { metaAttendance: { eventKey: 'fixture', conversationKey: 'fixture' } },
    'Controle Bot - Buscar Controle': { metaAttendanceOk: true },
    'Estado Conversa - Persistir': { metaAttendanceOk: true },
  } });
  assert.deepEqual(json.messages.map(x => x.type), ['text', 'image', 'image', 'image', 'text']);
  assert.equal(json.messages[1].text, 'Redmi 15 · Preto');
  assert.equal(json.messages.at(-1).text, question);
});
