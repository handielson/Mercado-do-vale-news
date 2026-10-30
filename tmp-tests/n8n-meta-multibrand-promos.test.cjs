'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARKER, NODES } = require('../scripts/n8n-meta-multibrand-promos.cjs');

const workflowPath = process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT || require('node:path').join(__dirname, '..', '.local', 'meta-current-workflow.private.json');
const original = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const patched = patchWorkflow(original);
const nodes = new Map(patched.nodes.map(node => [node.name, node]));
const category = '8b7c4852-c195-4527-8fd7-c3cc2debda42';

function execute(name, input = {}, sources = {}, state = {}, items = [input]) {
  const code = nodes.get(name).parameters.jsCode;
  const lookup = key => {
    assert.ok(Object.hasOwn(sources, key), 'Missing upstream fixture: ' + key);
    const rows = Array.isArray(sources[key]) ? sources[key] : [sources[key]];
    return { first: () => ({json:rows[0]}), all: () => rows.map(json => ({json})) };
  };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', '$execution', '$runIndex', 'fetch', code)(
    input, {all: () => items.map(json => ({json})), first: () => ({json:input})}, lookup,
    () => state, {id:'synthetic'}, 0, async () => ({ok:false,json:async () => ({})}));
}

function source(channel = 'messenger', currentText = 'Sim para ver as promoções para hoje') {
  const now = Date.now();
  const texts = ['Quero as promoções do Poco', 'Para hoje', 'E do Realme', 'Gostaria do ZAP', currentText];
  const rows = texts.map((text, index) => ({direction:'inbound', text,
    created_at:new Date(now - (texts.length - 1 - index) * 15000).toISOString()}));
  return { remoteJid: channel === 'messenger' ? 'meta:fixture:dm' : '5587900000000@s.whatsapp.net',
    ...(channel === 'messenger' ? {metaAttendance:{channel:'messenger'}} : {}),
    conversation:currentText, messageTimestamp:rows.at(-1).created_at, recentMessages:rows,
    salesSearchQuery:'smartphones', salesRequestKind:'categoria', salesCategoryId:category,
    salesCategoryName:'smartphones', requestedDeviceBrand:'realme' };
}

function item(id, name, brand) {
  return {id, model_id:'model-'+id, name, brand, status:'active', stock_quantity:2,
    price_retail:120000, category_id:category, specs:{ram:'8GB',storage:'256GB',color:'Preto'},
    slug:id, images:[]};
}

const products = [
  item('p1','Poco C81 Pro','Xiaomi'), item('p2','Poco X7 Pro','Xiaomi'),
  item('p3','Poco X8 Pro','Xiaomi'), item('r1','Realme Note 70','Realme'),
  item('r2','Realme C85','Realme'), item('x1','Redmi Note 15','Xiaomi'),
  item('o1','C17 Plus','Oukitel'),
];

test('patch is scoped, idempotent and preserves the workflow graph', () => {
  assert.deepEqual(patchWorkflow(patched), patched);
  assert.deepEqual(patched.connections, original.connections);
  const changed = patched.nodes.filter((node, index) =>
    node.parameters?.jsCode !== original.nodes[index].parameters?.jsCode).map(node => node.name);
  assert.deepEqual(changed, NODES);
  assert.ok(NODES.every(name => nodes.get(name).parameters.jsCode.includes(MARKER)));
});

test('Soraya generic confirmation preserves POCO and Realme, with card prices and at most three items per block', () => {
  const prepared = execute('Vendas - Preparar Busca', source())[0].json;
  assert.deepEqual(prepared.requestedDeviceFamiliesMetaV1, ['poco','realme']);
  assert.equal(prepared.specificDeviceModelRequest, false);
  assert.equal(prepared.requestedDeviceModelQuery, '');
  const result = execute('Vendas - Contexto Produtos', {}, {
    'Vendas - Preparar Busca':prepared, 'Vendas - Buscar Produtos':products,
    'switc Mensagens':prepared }, {}, [{channel:'presencial',installments:12,applied_fee_pct:11.9}])[0].json;
  const blocks = String(result.deterministicCatalogOutput || '').split('[[MSG]]');
  assert.equal(result.productLookupCount, 5);
  assert.match(blocks.join('\n'), /Poco C81 Pro[\s\S]*Realme Note 70/);
  assert.doesNotMatch(blocks.join('\n'), /Redmi Note 15|C17 Plus|Nao encontrei esse modelo/);
  assert.match(blocks.join('\n'), /à vista no PIX[\s\S]*Cartão: 12x/);
  assert.ok(blocks.slice(0,-1).every(block => [...block.matchAll(/\d+\. [A-Z]/g)].length <= 3));
  assert.match(blocks.at(-1), /Qual modelo/i);
});

test('ordinary WhatsApp and exact-model searches retain their previous behavior', () => {
  const wa = execute('Vendas - Preparar Busca', source('whatsapp'))[0].json;
  assert.deepEqual(wa.requestedDeviceFamiliesMetaV1, []);
  const exact = source('messenger', 'Quero o Poco C81 Pro');
  const prepared = execute('Vendas - Preparar Busca', exact)[0].json;
  assert.deepEqual(prepared.requestedDeviceFamiliesMetaV1, []);
  assert.equal(prepared.specificDeviceModelRequest, true);
});

test('old brand mentions never constrain a fresh Meta promotions request', () => {
  const stale = source();
  stale.recentMessages[0].created_at = new Date(Date.now()-86400000).toISOString();
  stale.recentMessages[2].created_at = new Date(Date.now()-86400000).toISOString();
  const prepared = execute('Vendas - Preparar Busca', stale)[0].json;
  assert.deepEqual(prepared.requestedDeviceFamiliesMetaV1, []);
});
