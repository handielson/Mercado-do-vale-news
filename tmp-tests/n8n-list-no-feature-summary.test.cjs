// list-no-feature-summary-v1: a lista de celulares sai sem a linha "✨ Tela ..., bateria ...".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE_CONTEXTO, NODE_POS_LISTA } = require('../scripts/n8n-list-no-feature-summary.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const jid = 'fixture@s.whatsapp.net';

test('lista sem resumo de características; resto idêntico', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const original = workflow.nodes.find(n => n.name === NODE_CONTEXTO).parameters.jsCode;
  const patchedWorkflow = patchWorkflow(workflow);
  const patched = patchedWorkflow.nodes.find(n => n.name === NODE_CONTEXTO).parameters.jsCode;
  const specs = { tela_polegadas: '6,67', tipo_de_display: 'IPS LCD', bateria_mah: '6300', cam_principal_mpx: '50', carregamento_w: '45' };
  const product = (id, name, brand, ram, storage, color, price) => ({ id, model_id: id + '-m', model_name: name, name: name + ' ' + color, brand, status: 'active', stock_quantity: 1, price_retail: price, specs: { ram, storage, color, ...specs }, slug: id, images: [] });
  const rows = [
    product('c71', 'Realme C71', 'Realme', '8GB', '256GB', 'Preto', 119000),
    product('n70', 'Realme Note 70', 'Realme', '8GB', '256GB', 'Dourado', 109000),
    product('a5', 'Redmi A5', 'Xiaomi', '4GB', '128GB', 'Azul', 116000),
  ];
  const run = (code) => {
    const state = {};
    const base = { conversation: 'Quero receber a lista atualizada de celulares.', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid };
    const sources = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [base] };
    const lookup = name => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map(json => ({ json })) });
    const json = new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => state, lookup)[0].json;
    return { json, state };
  };
  const before = run(original), after = run(patched);
  const summaries = before.state.salesPostList[jid].options.map(o => o.featureSummary).filter(Boolean);
  assert.ok(summaries.length > 0, 'fixture gera resumo');
  for (const summary of summaries) {
    assert.ok(before.json.deterministicCatalogOutput.includes(summary), 'original mostrava o resumo');
    assert.ok(!after.json.deterministicCatalogOutput.includes(summary), 'lista nova sem o resumo');
  }
  const stripSummary = (text) => summaries.reduce((acc, s) => acc.split('[[BR]]   ' + s).join(''), text).replace(/(💳 Cartão: 12x de R\$\s[\d.,]+) \(total (R\$\s[\d.,]+)\)/g, '$1 ($2)');
  assert.match(after.json.deterministicCatalogOutput, /💳 Cartão: 12x de R\$\s[\d.,]+ \(R\$\s[\d.,]+\)/, 'cartão sem a palavra total');
  assert.doesNotMatch(after.json.deterministicCatalogOutput, /\(total /);
  assert.equal(after.json.deterministicCatalogOutput, stripSummary(before.json.deterministicCatalogOutput), 'só a linha do resumo sai');
  assert.deepEqual(after.state.salesPostList[jid].options.map(o => o.featureSummary), before.state.salesPostList[jid].options.map(o => o.featureSummary), 'resumo continua guardado');
  const pos = patchedWorkflow.nodes.find(n => n.name === NODE_POS_LISTA).parameters.jsCode;
  assert.ok(!pos.includes("option.featureSummary ? '   ' + option.featureSummary"), 'comparação pós-lista sem resumo');
  assert.ok(!pos.includes("' (total ' + "), 'pós-lista sem a palavra total');
  new Function(pos);
  assert.ok(patched.includes(MARK) && pos.includes(MARK));
});
