'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchContext, MODEL_GROUP_MARKER, assertDeployableSnapshot } = require('./n8n-fix-unique-smartphone-config-price.cjs');

const snapshotPath = process.env.MDV_PHONE_GROUPING_SNAPSHOT;
assert.ok(snapshotPath && fs.existsSync(snapshotPath), 'Set MDV_PHONE_GROUPING_SNAPSHOT to a read-only active workflow export');
const workflow = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const safeDeployment = { nodes: workflow.nodes, connections: workflow.connections, active: true,
  versionId: 'active-fixture', activeVersionId: 'active-fixture', historyNodes: workflow.nodes,
  historyConnections: workflow.connections, activeExecutions: 0 };
assert.doesNotThrow(() => assertDeployableSnapshot(safeDeployment));
for (const unsafe of [{ active: false }, { versionId: 'draft' }, { activeVersionId: null },
  { historyNodes: [] }, { historyConnections: {} }, { activeExecutions: 1 }]) {
  assert.throws(() => assertDeployableSnapshot({ ...safeDeployment, ...unsafe }), 'unsafe deployment rejected');
}
const original = workflow.nodes.find((node) => node.name === 'Vendas - Contexto Produtos').parameters.jsCode;
const patched = patchContext(original);
assert.ok(patched.includes(MODEL_GROUP_MARKER));
assert.equal(patchContext(patched), patched, 'patch is idempotent');
const originalMarkers = original.match(/(?:[a-z][a-z0-9]*-){2,}[a-z0-9]+/g) || [];
for (const marker of originalMarkers) assert.ok(patched.includes(marker), `preserve existing marker ${marker}`);
assert.ok(!patched.includes("'Poco X8 Pro 5G'"), 'canonical names must come from the API');

function execute(rows, code = patched, baseOverrides = {}, feeRows) {
  const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones',
    productSearchKind: 'categoria', remoteJid: 'fixture@s.whatsapp.net', ...baseOverrides };
  const state = {};
  const sources = {
    'Vendas - Preparar Busca': [base],
    'Vendas - Buscar Produtos': rows,
    'switc Mensagens': [base],
  };
  const lookup = (name) => {
    assert.ok(sources[name], `unexpected external node ${name}`);
    return { first: () => ({ json: sources[name][0] }), all: () => sources[name].map((json) => ({ json })) };
  };
  const fees = feeRows || [{ channel: 'presencial', installments: 12, applied_fee_pct: 12 }];
  const result = new Function('$json', '$input', '$getWorkflowStaticData', '$', code)(
    {}, { all: () => fees.map((json) => ({ json })) }, () => state, lookup,
  )[0].json;
  return { result, state };
}

function row(id, modelId, name, ram, storage, color, price, overrides = {}) {
  return { id, model_id: modelId, name, model_name: 'Poco X8 Pro 5G', brand: 'Poco',
    status: 'active', stock_quantity: 1, price_retail: price,
    specs: { ram, storage, color }, slug: id, images: [], ...overrides };
}
const rows = [
  row('blue-256', 'model-x8', 'Poco X8 Pró 5G Azul', '8GB', '256GB', 'Azul', 260000),
  row('black-256', 'model-x8', 'Poco X8 Pro Preto', '8 GB', '256 GB', 'Preto', 266000),
  row('green-512', 'model-x8', 'Poco X8 Pro 5G Verde', '12GB', '512GB', 'Verde', 310000),
  row('other-model', 'model-other', 'Poco X8 Pro 5G', '8GB', '256GB', 'Branco', 200000),
  row('hidden', 'model-x8', 'Poco X8 Pro 5G', '8GB', '256GB', 'Rosa', 999999, { offer_visibility: 'hidden' }),
  row('out-of-stock', 'model-x8', 'Poco X8 Pro 5G', '8GB', '256GB', 'Dourado', 999999, { stock_quantity: 0 }),
  row('inactive', 'model-x8', 'Poco X8 Pro 5G', '8GB', '256GB', 'Prata', 999999, { status: 'inactive' }),
];
const { result, state } = execute(rows);
assert.equal(result.productLookupCount, 3, 'model plus physical configuration owns each numbered entry');
const family = result.productsInStock.find((product) => product.modelId === 'model-x8' && product.storageGb === 256);
assert.equal(family.name, 'Poco X8 Pro 5G');
assert.equal(family.stock, 2);
assert.deepEqual(new Set(family.productIds), new Set(['blue-256', 'black-256']));
assert.equal(family.memoryOptions.length, 1, 'one memory configuration per numbered entry');
const memory256 = family.memoryOptions.find((option) => option.storageGb === 256);
assert.equal(memory256.stock, 2);
assert.equal(memory256.priceCents, 266000, 'preserve v248 maximum configuration price across colors');
assert.equal(memory256.card.total, (297920 / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
assert.deepEqual(new Set(memory256.colors), new Set(['Azul', 'Preto']));
assert.equal(result.productsInStock.find((product) => product.modelId === 'model-x8' && product.storageGb === 512).priceCents, 310000);
assert.equal(family.variants.length, 2, 'colors and product IDs stay inside the same configuration');
const shown = state.salesPostList['fixture@s.whatsapp.net'].options.find((option) => option.colors.length === 2);
assert.equal(shown.memoryOptions.length, 1);
assert.deepEqual(new Set(shown.colors.map((variant) => variant.productId)), new Set(family.productIds));
assert.match(result.deterministicCatalogOutput, /Poco X8 Pro 5G/);
assert.doesNotMatch(result.deterministicCatalogOutput, /Pró/);

const fallbackRows = [
  row('fallback-blue', null, 'Poco Fallback Azul', '8GB', '128GB', 'Azul', 100000, { model_name: '' }),
  row('fallback-black', '', 'Poco Fallback Preto', '8GB', '128GB', 'Preto', 110000, { model_name: '' }),
  row('fallback-256', undefined, 'Poco Fallback Verde', '8GB', '256GB', 'Verde', 120000, { model_name: '' }),
];
const fallback = execute(fallbackRows).result.productsInStock;
assert.equal(fallback.length, 2, 'missing model_id uses color-free name plus physical memory');
assert.equal(fallback[0].name, 'Poco Fallback');
assert.equal(fallback[0].memoryOptions.length, 1);
assert.equal(fallback[0].memoryOptions[0].priceCents, 110000);
const legacyContract = execute(rows.slice(0, 3).map((product) => ({ ...product, model_name: undefined }))).result;
assert.equal(legacyContract.productLookupCount, 2, 'configuration identity works before API supplies model_name');

const specific = execute(rows, patched, { requestedDeviceModelQuery: 'Poco X8 Pro 5G 512GB',
  requestedStorageGb: [512], requestedRamGb: [12], specificDeviceModelRequest: true }).result;
assert.equal(specific.productLookupCount, 1);
assert.equal(specific.productsInStock[0].memoryOptions.length, 1);
assert.equal(specific.productsInStock[0].memoryOptions[0].storageGb, 512, 'memory filter precedes family merge');

// The previous production key collapses two memories and must fail the new contract.
const oldGrouping = patched.replace('? quoteConfigurationKeyV2(product)\n  :', '? quoteModelIdentityV2(product)\n  :');
assert.throws(() => assert.equal(execute(rows, oldGrouping).result.productLookupCount, 3), /Expected values/);
assert.equal(patchContext(oldGrouping), patched, 'existing v626 snapshots upgrade without losing later code');
assert.deepEqual(workflow.connections, safeDeployment.connections, 'grouping never renumbers persisted state');

const executionPath = process.env.MDV_PHONE_GROUPING_EXECUTION;
if (executionPath) {
  // n8n stores execution data as a flatted reference table. Rehydrate only the local read-only export.
  const table = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
  const cache = new Map();
  const readReference = (index) => {
    if (cache.has(index)) return cache.get(index);
    const value = table[index];
    if (!value || typeof value !== 'object') return value;
    const resolved = Array.isArray(value) ? [] : {};
    cache.set(index, resolved);
    for (const [key, entry] of Object.entries(value)) {
      resolved[key] = typeof entry === 'string' ? readReference(Number(entry)) : entry;
    }
    return resolved;
  };
  const runData = readReference(0).resultData.runData;
  const nodeRows = (name) => runData[name][0].data.main[0].map((item) => item.json);
  const actualRows = nodeRows('Vendas - Buscar Produtos');
  const actualBase = nodeRows('Vendas - Preparar Busca')[0];
  const actualFees = nodeRows('Vendas - Buscar Taxas');
  const before = execute(actualRows, original, actualBase, actualFees).result;
  const after = execute(actualRows, patched, actualBase, actualFees).result;
  assert.ok(after.productsInStock.every(product => product.memoryOptions.length === 1), 'replay separates configurations');
  const configurationIds = after.productsInStock.map(product => [product.modelId || product.name, product.ramGb, product.storageGb].join('|'));
  assert.equal(new Set(configurationIds).size, configurationIds.length, 'replay shows each configuration only once');
  for (const product of after.productsInStock) {
    assert.equal(product.stock, product.memoryOptions.reduce((total, option) => total + option.stock, 0));
    for (const option of product.memoryOptions) {
      assert.ok(option.variants.every((variant) => option.productIds.includes(variant.productId)));
      assert.deepEqual(new Set(option.colors), new Set(option.variants.map((variant) => variant.color).filter(Boolean)));
    }
  }
  console.log(`Read-only incident replay: ${actualRows.length} input products; ${before.productLookupCount} entries before, ${after.productLookupCount} model families after`);
}
console.log('Smartphone grouping: model identity, canonical name, physical memory, colors, prices, state, fallback and idempotence passed');
