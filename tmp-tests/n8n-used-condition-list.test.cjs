// used-condition-list-v1: o robô separa seminovo/usado do novo (antes eram fundidos, com o preço do novo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK } = require('../scripts/n8n-used-condition-list.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;

test('candidato tem a correção da lista de seminovos/usados', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const patched = patchWorkflow(workflow).nodes.find(n => n.name === 'Vendas - Contexto Produtos').parameters.jsCode;
  const code = patched;
  const jid = 'fixture@s.whatsapp.net';
  const product = (id, ram, storage, color, price, specs = {}) => ({ id, model_id: 'redmi15', model_name: 'Redmi 15', name: 'Redmi 15 ' + color, brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: price, specs: { ram, storage, color, ...specs }, slug: id, images: [] });
  const run = (rows) => {
    const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid };
    const state = {};
    const sources = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [base] };
    const lookup = name => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map(json => ({ json })) });
    const result = new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => state, lookup)[0].json;
    return { result, state, text: JSON.stringify(result) };
  };

  // Sem usado: nada muda em relação ao workflow atual.
  const plain = [product('black128', '6GB', '128GB', 'Preto', 99900), product('black256', '8GB', '256GB', 'Preto', 122400)];
  const original = workflow.nodes.find(n => n.name === 'Vendas - Contexto Produtos').parameters.jsCode;
  const baseRun = (() => { const s = {}; const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid }; const src = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': plain, 'switc Mensagens': [base] }; return new Function('$json', '$input', '$getWorkflowStaticData', '$', original)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => s, n => ({ first: () => ({ json: src[n][0] }), all: () => src[n].map(json => ({ json })) }))[0].json; })();
  const afterPlain = run(plain).result;
  const strip = (r) => JSON.stringify({ ...r, phoneCatalogFollowupToken: '' }, (key, value) => (['condition', 'conditionLabel', 'conditionNote'].includes(key) ? undefined : value));
  assert.equal(afterPlain.deterministicCatalogOutput, baseRun.deterministicCatalogOutput, 'mensagem enviada ao cliente idêntica');
  assert.equal(strip(afterPlain), strip(baseRun), 'lista sem usados é idêntica à atual');

  // Com seminovo da mesma configuração do novo.
  const rows = [
    product('black128', '6GB', '128GB', 'Preto', 99900),
    product('semi128', '6GB', '128GB', 'Preto', 79900, { condition: 'seminovo', condition_note: 'Trocado a placa principal pela assistência autorizada, o restante está novo' }),
    product('black256', '8GB', '256GB', 'Preto', 122400),
  ];
  const { result, state, text } = run(rows);
  const names = result.productsInStock.map(p => p.name);
  assert.deepEqual(names.slice(-1), ['Redmi 15 (Seminovo)'], 'seminovo vem por último, com o rótulo no nome');
  const semi = result.productsInStock.find(p => p.condition === 'seminovo');
  assert.equal(semi.priceCents, 79900, 'seminovo mantém o próprio preço (não herda o do novo)');
  const novo128 = result.productsInStock.find(p => p.condition === 'new' && /128/.test(p.memory));
  assert.ok(novo128 && novo128.priceCents === 99900, 'novo 128GB continua com o próprio preço');
  assert.ok(!(novo128.productIds || []).includes('semi128'), 'seminovo não entra no grupo do novo');
  assert.match(text, /♻️ \*Seminovos \| Usados\*/, 'mensagem separada');
  assert.match(text, /📝 Trocado a placa principal pela assistência autorizada/, 'observação na lista');
  const options = state.salesPostList[jid].options;
  assert.equal(options.at(-1).name, 'Redmi 15 (Seminovo)');
  assert.equal(options.at(-1).number, options.length, 'numeração = ordem da lista');
  assert.equal(options.at(-1).conditionNote.startsWith('Trocado a placa'), true);
  assert.ok(patched.includes(MARK));
});
