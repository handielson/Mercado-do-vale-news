// sales-focus-product-v3: linha em branco entre preços e características na indicação.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE } = require('../scripts/n8n-sales-focus-spacing.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const jid = 'fixture@s.whatsapp.net';
const product = (id, model, ram, storage, color, price, extra = {}) => ({ id, model_id: model, model_name: model, name: model + ' ' + color, brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: price, specs: { ram, storage, color, nfc: 'Sim' }, slug: id, images: [], ...extra });
function run(code, rows) {
  const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid };
  const sources = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [base] };
  const lookup = (name) => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map((json) => ({ json })) });
  return new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => ({}), lookup)[0].json;
}
test('linha em branco depois do 12x, antes das características', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const code = patchWorkflow(w).nodes.find((n) => n.name === NODE).parameters.jsCode;
  assert.ok(code.includes(MARK));
  const rows = [product('a128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900), product('a256', 'Redmi 15', '8GB', '256GB', 'Preto', 134900, { bot_focus: true }), product('p1', 'Poco C71', '4GB', '128GB', 'Azul', 90100)];
  const text = JSON.stringify(run(code, rows));
  const m = text.match(/⭐ \*Nossa indicação:\*.*?(?="|$)/);
  assert.ok(m, 'indicação presente');
  assert.match(m[0], /\(R\$\s?[\d.,]+\)\[\[BR\]\]\[\[BR\]\]/, 'linha em branco depois do 12x');
});
