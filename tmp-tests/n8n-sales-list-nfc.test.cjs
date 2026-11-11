'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { NODE, patchWorkflow } = require('../scripts/n8n-sales-list-nfc.cjs');

assert.ok(process.env.MDV_N8N_SALES_SNAPSHOT, 'Defina MDV_N8N_SALES_SNAPSHOT com o workflow ativo');
const before = JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT, 'utf8'));
const after = patchWorkflow(before);
const search = { remoteJid: 'fixture@s.whatsapp.net', productSearchKind: 'categoria', productCategoryId: 'smartphones', conversation: 'lista de celulares' };
const fees = [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }];

function phone(color, nfc, modelNfc, stock = 1) {
  return {
    id: color, sku: color, model_id: 'redmi15', model_name: 'Redmi 15', name: 'Redmi 15 ' + color, brand: 'Xiaomi',
    status: 'active', stock_quantity: stock, price_retail: 134900, price_effective: 134900,
    specs: { color, ram: '8GB', storage: '256GB', nfc },
    ...(modelNfc === undefined ? {} : { model_template_values: { nfc: modelNfc } }),
  };
}

function catalog(workflow, rows) {
  const sources = { 'Vendas - Preparar Busca': search, 'Vendas - Buscar Produtos': rows, 'switc Mensagens': search };
  const lookup = name => {
    const items = [].concat(sources[name] || []).map(json => ({ json }));
    return { first: () => items[0], all: () => items };
  };
  const state = {};
  const node = workflow.nodes.find(n => n.name === NODE);
  const run = new Function('$json', '$input', '$', '$getWorkflowStaticData', node.parameters.jsCode);
  const [{ json }] = run({}, { all: () => fees.map(json => ({ json })) }, lookup, () => state);
  return json.deterministicCatalogOutput;
}

test('altera só o formatador existente, sem mudar o grafo', () => {
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map(n => n.name), [NODE]);
});

test('NFC da ficha do modelo aparece antes das cores, sem mudar preço ou texto restante', () => {
  const rows = [phone('Preto', 'Não', 'Sim'), phone('Roxo', 'Consulte', 'Sim')];
  const output = catalog(after, rows);
  assert.match(output, /NFC: Sim\[\[BR\]\]\s+🎨 Cores: Preto, Roxo/);
  assert.equal(output.replace(/\s+NFC: Sim\[\[BR\]\]/g, ''), catalog(before, rows));
});

test('NFC não confirmado é omitido; “Não” explícito aparece', () => {
  assert.match(catalog(after, [phone('Preto', 'Não')]), /NFC: Não\[\[BR\]\]\s+🎨 Cores:/);
  for (const rows of [
    [phone('Preto', undefined)],
    [phone('Preto', 'Sim', 'Consulte')],
    [phone('Preto', 'Sim'), phone('Roxo', 'Não')],
    [phone('Preto', 'Sim'), phone('Roxo', undefined)],
  ]) assert.doesNotMatch(catalog(after, rows), /NFC:/);
  assert.match(catalog(after, [phone('Preto', 'Sim'), phone('Roxo', 'Não', undefined, 0)]), /NFC: Sim/);
});
