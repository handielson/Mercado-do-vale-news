// sales-focus-product-v1: a lista de celulares fecha indicando o celular em foco.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE } = require('../scripts/n8n-sales-focus-product.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const jid = 'fixture@s.whatsapp.net';
const product = (id, model, ram, storage, color, price, extra = {}) => ({ id, model_id: model, model_name: model, name: model + ' ' + color, brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: price, specs: { ram, storage, color }, slug: id, images: [], ...extra });
function run(code, rows, baseExtra = {}) {
  const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid, ...baseExtra };
  const state = {};
  const sources = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [base] };
  const lookup = (name) => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map((json) => ({ json })) });
  return new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => state, lookup)[0].json;
}
const codeOf = (w) => w.nodes.find((n) => n.name === NODE).parameters.jsCode;

test('com celular em foco na lista: fecha com a indicação dele (número, memória, Pix e 12x)', { skip }, () => {
  const w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const rows = [product('a128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900), product('a256', 'Redmi 15', '8GB', '256GB', 'Preto', 134900, { bot_focus: true }),
    product('p1', 'Poco C71', '4GB', '128GB', 'Azul', 90100)];
  const out = run(codeOf(patchWorkflow(w)), rows);
  const text = String(out.deterministicCatalogOutput || JSON.stringify(out));
  assert.match(text, /⭐ \*Nossa indicação:\* \d+\. Redmi 15[^\n]*8GB\/256GB/);
  assert.match(text, /R\$\s?1\.349,00 à vista no PIX/);
  assert.match(text, /💳 Cartão: 12x de/);
  assert.doesNotMatch(text, /Qual modelo voce quer ver em mais detalhes/);
  assert.ok(codeOf(patchWorkflow(w)).includes(MARK));
});

test('sem foco (ou foco fora da lista): mensagem idêntica à atual', { skip }, () => {
  const w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const rows = [product('a128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900), product('p1', 'Poco C71', '4GB', '128GB', 'Azul', 90100)];
  assert.equal(run(codeOf(patchWorkflow(w)), rows).deterministicCatalogOutput, run(codeOf(w), rows).deterministicCatalogOutput);
});

test('pedido de fotos não troca a pergunta', { skip }, () => {
  const w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const rows = [product('a128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900, { bot_focus: true }), product('p1', 'Poco C71', '4GB', '128GB', 'Azul', 90100)];
  const extra = { photoCatalogRequestedV1: true };
  assert.equal(run(codeOf(patchWorkflow(w)), rows, extra).deterministicCatalogOutput, run(codeOf(w), rows, extra).deterministicCatalogOutput);
});
