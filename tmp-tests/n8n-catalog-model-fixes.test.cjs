// model-token-match-v1 + catalog-finish-send-v1 (caso 557488087672, 22/11).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const token = require('../scripts/n8n-model-token-match.cjs');
const finish = require('../scripts/n8n-catalog-finish-send.cjs');
const { priceCatalogFixture } = require('./n8n-sales-price-catalog-fixture.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const load = () => finish.patchWorkflow(token.patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8'))));
const jid = '5587990000000@s.whatsapp.net';
const phone = (id, name, ram, storage, color, price, stock = 1) => ({ id, model_id: name, model_name: name, name: `${name} ${color}`, brand: 'Realme',
  status: 'active', stock_quantity: stock, price_retail: price, specs: { ram, storage, color }, slug: id, images: [], priority: 0 });
const products = [phone('n80a', 'Realme Note 80S', '4GB', '128GB', 'Azul', 119900, 3), phone('n80p', 'Realme Note 80S', '4GB', '128GB', 'Preto', 119900),
  phone('c73', 'Realme C73', '8GB', '256GB', 'Roxo', 138900), phone('r15', 'Redmi 15', '8GB', '256GB', 'Preto', 134900)];

function contexto(w, conversation, query) {
  const code = w.nodes.find((n) => n.name === token.NODE).parameters.jsCode;
  const base = { conversation, remoteJid: jid, productCategoryId: 'smartphones', productSearchKind: 'categoria', specificDeviceModelRequest: true, requestedDeviceModelQuery: query };
  const sources = { 'Vendas - Preparar Busca': base, 'Vendas - Buscar Produtos': products, 'switc Mensagens': base };
  const lookup = (s) => { const v = Array.isArray(sources[s]) ? sources[s] : [sources[s] || {}]; return { first: () => ({ json: v[0] }), all: () => v.map((json) => ({ json })), item: { json: v[0] } }; };
  const all = [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }];
  const state = {};
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', '$execution', '$runIndex', 'helpers', code)(
    all[0], { all: () => all.map((json) => ({ json })), first: () => ({ json: all[0] }) }, lookup, () => state, { id: '1' }, 0, priceCatalogFixture(state, products))[0].json;
}

test('caso real: "redimi 80s e 60x" acha o Realme Note 80S e diz que o 60X não tem', { skip }, () => {
  const r = contexto(load(), 'Queria saber o valor do redimi 80s e o 60x', 'redmi 80s e 60x');
  assert.match(r.deterministicCatalogOutput, /Realme Note 80S/);
  assert.doesNotMatch(r.deterministicCatalogOutput, /Nao encontrei|Redmi 15|C73/);
  assert.match(r.deterministicCatalogOutput, /O 60X não temos em estoque no momento\.\[\[BR\]\]Quer que eu separe/);
});

test('nome inteiro que bate continua igual; código que não existe continua "não encontrei" + lista', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  for (const [c, q] of [['tem o realme c73?', 'realme c73'], ['tem o redmi 99z?', 'redmi 99z']]) {
    assert.equal(contexto(load(), c, q).deterministicCatalogOutput, contexto(before, c, q).deterministicCatalogOutput, c);
  }
  assert.match(contexto(load(), 'tem o redmi 99z?', 'redmi 99z').deterministicCatalogOutput, /Nao encontrei esse modelo/);
});

function envio(w, latest, original) {
  const code = w.nodes.find((n) => n.name === finish.NODE).parameters.jsCode;
  const rows = [{ direction: 'inbound', wa_message_id: 'A', message_text: 'Queria saber o valor do redimi 80s', created_at: '2026-11-22T19:43:03Z' },
    { direction: 'inbound', wa_message_id: 'B', message_text: latest, created_at: '2026-11-22T19:44:01Z' }];
  const item = { inboundWaMessageId: 'A', conversation: 'Queria saber o valor do redimi 80s', ...original };
  const $ = (n) => ({ all: () => [{ json: item }], first: () => ({ json: item }) });
  return new Function('$input', '$', code)({ all: () => [{ json: { rows } }] }, $).length;
}

test('lista em andamento: "?" e "Por favor" não interrompem; pedido novo e cancelamento interrompem', { skip }, () => {
  const w = load();
  const lista = { catalogDeliveryCandidateV1: true, message: '🏷️ *Realme*\n24. Realme Note 80S\n💰 R$ 1.199,00' };
  for (const t of ['?', 'Por favor', 'cadê', 'oi??']) assert.equal(envio(w, t, lista), 1, t);
  assert.equal(envio(w, 'quero saber se vocês consertam tela de notebook dell', lista), 0, 'pedido novo');
  assert.equal(envio(w, 'pare', lista), 0, 'pare');
  assert.equal(envio(w, 'Por favor', { message: 'Temos sim, quer ver fotos?' }), 0, 'resposta comum continua sendo trocada pela nova');
});

test('patches idempotentes e só nos 2 nós', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = load();
  assert.deepEqual(finish.patchWorkflow(token.patchWorkflow(after)), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name).sort(), [token.NODE, finish.NODE].sort());
});
