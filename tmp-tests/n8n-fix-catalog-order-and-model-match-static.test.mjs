import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { patchContext, patchGraph, summarize } = require('./n8n-fix-catalog-order-and-model-match.cjs');

const context = `
const base = { requestedStorageGb: [], requestedRamGb: [] };
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const memoryCapacityToGbV155 = (value) => Number(String(value).match(/\\d+/)?.[0] || 0);
const getPhysicalMemoryPartsV155 = () => ({ storageGb: 256, ramGb: 8 });
const quoteBrandGroupV227 = (product) => ({ label: product.brand || 'Outras marcas' });
const mergeQuoteProducts = (items) => items;
const rawProducts = [];
const prefersSmartphones = true;
const sortedProducts = [];
const quoteProductGroupKey = () => '';
const products = mergeQuoteProducts(rawProducts).sort((a, b) => {
  if (!prefersSmartphones) return 0;
  const ga = quoteBrandGroupV227(a);
  const gb = quoteBrandGroupV227(b);
  return ga.rank - gb.rank
    || ga.label.localeCompare(gb.label, 'pt-BR')
    || normalize(a.name).localeCompare(normalize(b.name), 'pt-BR');
});
const requestedDeviceBrand = '';
const requestedDeviceBrandLabel = '';
const requestedDeviceModelQuery = 'redmi note 15 pro 256 GB';
const requestedDeviceModelLabel = requestedDeviceModelQuery;
const compactModelText = (value) => normalize(value).replace(/\\s+/g, '');
const productMatchesRequestedModel = (product) => {
  if (!requestedDeviceModelQuery) return false;
  const requested = compactModelText(requestedDeviceModelQuery);
  const rawProductModelTextV134 = [product.name, product.originalName, product.brand].filter(Boolean).join(' ');
  const productText = compactModelText(rawProductModelTextV134);
  const requestedModelRequiresPlusV134 = /\\+|\\bplus\\b/i.test(requestedDeviceModelQuery);
  const productModelHasPlusV134 = /\\+|\\bplus\\b/i.test(rawProductModelTextV134);
  if (requestedModelRequiresPlusV134 && !productModelHasPlusV134) return false;
  return Boolean(requested && productText.includes(requested));
};
const lines = [];
const buildQuoteMessageForProducts = () => '';
const previousBrandV227 = null;
const currentBrandV227 = { label: 'Xiaomi' };
if (prefersSmartphones && (!previousBrandV227 || previousBrandV227.label !== currentBrandV227.label)) {
  const header = currentBrandV227.label;
}
`;
const patched = patchContext(context);
assert.match(patched, /catalog-model-memory-match-v246/);
assert.match(patched, /requestedStorageValuesV246/);
assert.match(patched, /availableBrandLabelsV246\.has/);
assert.doesNotThrow(() => new Function('$json', '$input', '$getWorkflowStaticData', '$', patched));

const nodes = [
  { name: 'Vendas - Contexto Produtos', parameters: { jsCode: patched } },
  { name: 'Dividir mensagens', position: [800, 0], parameters: {} },
  { name: 'Controle Bot - Verificar mensagem atual', parameters: {} },
  { name: 'Handoff - Registrar bot enviado', parameters: {} },
];
const connections = { 'Dividir mensagens': { main: [[{ node: 'Controle Bot - Verificar mensagem atual' }]] } };
patchGraph(nodes, connections);
const result = summarize(nodes, connections);
assert.deepEqual(result, {
  modelMemoryMatcher: true,
  appleHeaderGuard: true,
  sequentialLoop: true,
  splitFeedsLoop: true,
  loopFeedsVerifier: true,
  sentFeedsLoop: true,
});
console.log('n8n catalog order and model matcher regression test passed');
