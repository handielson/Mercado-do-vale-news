// tablet-catalog-v1: pedido de tablet usa a categoria Tablet e a mesma lista dos celulares; acessório de tablet não vira lista de celular.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE_SEARCH, NODE_CONTEXT, NODE_READY, TABLET_CATEGORY_ID, PHONE_CATEGORY_ID } = require('../scripts/n8n-tablet-catalog.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const jid = 'fixture@s.whatsapp.net';

test('tablet: categoria, lista no formato dos celulares e títulos', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const live = workflow.nodes.find(n => n.name === NODE_SEARCH).parameters.jsCode;
  const patched = patchWorkflow(workflow);
  assert.deepEqual(patchWorkflow(patched), patched, 'idempotente');
  const search = patched.nodes.find(n => n.name === NODE_SEARCH).parameters.jsCode;
  const context = patched.nodes.find(n => n.name === NODE_CONTEXT).parameters.jsCode;
  const base = { conversation: '', remoteJid: jid, salesRequestKind: 'busca', salesSearchQuery: '', salesCategoryId: '', salesCategoryName: '', salesFilters: {} };
  const prepare = (code, conversation, extra = {}) => new Function('$json', code)({ ...base, conversation, ...extra })[0].json;

  const pad2 = prepare(search, 'Vc teria o tablet Xiaomi Redmi Pad 2 ?', { salesSearchQuery: 'Xiaomi Redmi Pad 2' });
  assert.equal(pad2.productCategoryId, TABLET_CATEGORY_ID);
  assert.equal(pad2.tabletCatalogV1, true);
  assert.notEqual(prepare(live, 'Vc teria o tablet Xiaomi Redmi Pad 2 ?', { salesSearchQuery: 'Xiaomi Redmi Pad 2' }).productCategoryId, TABLET_CATEGORY_ID, 'fixture reproduz o bug');
  for (const text of ['quais tablets vocês têm?', 'tem ipad?', 'Tablete xiaomi', 'tem o Redmi Pad SE?']) assert.equal(prepare(search, text).productCategoryId, TABLET_CATEGORY_ID, text);
  const phone = prepare(search, 'tem o redmi note 15?', { salesSearchQuery: 'redmi note 15' });
  assert.equal(phone.productCategoryId, PHONE_CATEGORY_ID, 'celular continua celular');
  assert.equal(phone.tabletCatalogV1, false);
  const accessory = prepare(search, 'tem capa para redmi pad 2?', { salesSearchQuery: 'capa redmi pad 2' });
  assert.notEqual(accessory.productCategoryId, PHONE_CATEGORY_ID, 'capa de tablet não vira lista de celulares');
  assert.notEqual(accessory.productCategoryId, TABLET_CATEGORY_ID);

  const product = (id, ram, storage, color, price, stock = 1) => ({ id, model_id: 'pad6', model_name: 'Pad 6, 11"', name: 'Pad 6, 11" ' + color, brand: 'Xiaomi', status: 'active', stock_quantity: stock, price_retail: price, category_id: TABLET_CATEGORY_ID, specs: { ram, storage, color }, slug: id, images: [] });
  const rows = [product('p8a', '8GB', '256GB', 'Preto', 165900), product('p8b', '8GB', '256GB', 'Roxo', 165900), product('p6', '6GB', '128GB', 'Cinza', 149900)];
  const run = (input) => {
    const sources = { 'Vendas - Preparar Busca': [input], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [input] };
    return new Function('$json', '$input', '$getWorkflowStaticData', '$', context)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => ({}),
      name => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map(json => ({ json })) }))[0].json.deterministicCatalogOutput;
  };
  const unavailable = run(pad2);
  assert.match(unavailable, /Nao encontrei esse modelo/);
  assert.match(unavailable, /Tablets disponiveis agora/);
  assert.doesNotMatch(unavailable, /Celulares/);
  assert.match(unavailable, /1\. Pad 6, 11"\[\[BR\]\]   📱 \d+GB\/\d+GB\[\[BR\]\]      💰 R\$\s[\d.,]+ à vista no PIX/, 'mesmo formato da lista de celulares');
  assert.match(unavailable, /🎨 Cores: Preto, Roxo/);
  assert.match(run(prepare(search, 'quais tablets vocês têm?')), /📱 Tablets disponíveis/);

  const ready = patched.nodes.find(n => n.name === NODE_READY).parameters.conditions.conditions[0].leftValue;
  assert.ok(ready.includes(`['${PHONE_CATEGORY_ID}', '${TABLET_CATEGORY_ID}'].includes($json.productCategoryId)`));
  assert.ok(search.includes(MARK) && context.includes(MARK));
});
