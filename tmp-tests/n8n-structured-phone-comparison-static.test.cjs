const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  MARKER,
  patchPrepareSearch,
  patchProductContext,
  patchComposer,
  summarize,
} = require('./n8n-structured-phone-comparison.cjs');

const source = fs.readFileSync(path.join(__dirname, 'n8n-structured-phone-comparison.cjs'), 'utf8');
assert.match(source, /workflow_entity/);
assert.match(source, /workflow_history/);
assert.match(source, /entityHistoryEqual/);
assert.match(source, /structuredCatalogOnlyV365 \? catalogOutput/);
assert.match(source, /câmera de/);
assert.match(source, /resistência/);

const prepareNode = { name: 'Vendas - Preparar Busca', parameters: { jsCode: `
const source = $json;
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const rawText = String(source.conversation || source.classificacaoMensagem || '');
const normalized = normalize(rawText);
const classifiedSearchQuery = String(source.salesSearchQuery || '').trim();
const requestedDeviceBrand = /\\bpoco\\b/.test(normalize([rawText, classifiedSearchQuery].join(' '))) ? 'xiaomi' : '';
const genericPhoneWords = new Set(['celular']);
const tokens = normalized.split(' ').filter((token) => token && !['modelo', 'de'].includes(token));
const explicitPhoneDeviceRequest = false;
const phoneNfcFilterRequestV228 = false;
const phone5gFilterRequestV338 = false;
const phoneMemoryFiltersV155 = (() => {
  let working = String(rawText || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  const ram = new Set(); const storage = new Set();
  const capacityToGb = (number, unit) => Math.round(Number(number) * (/^t/i.test(String(unit || '')) ? 1024 : 1));
  const mask = (text) => ' '.repeat(text.length);
  const collect = (pattern, target, numberIndex = 1, unitIndex = 2) => { working = working.replace(pattern, (...args) => { const gb = capacityToGb(args[numberIndex], args[unitIndex]); if (gb) target.add(gb); return mask(args[0]); }); };
  collect(/\\b(\\d{1,3})\\s*(gb|g)\\s*(?:de\\s*)?(?:ram|memoria\\s+ram)\\b/gi, ram);
  collect(/\\b(?:ram|memoria\\s+ram)\\s*(?:de|com)?\\s*(\\d{1,3})\\s*(gb|g)\\b/gi, ram);
  return { requestedRamGb: [...ram], requestedStorageGb: [...storage] };
})();
const requestedRamGb = phoneMemoryFiltersV155.requestedRamGb;
const requestedStorageGb = phoneMemoryFiltersV155.requestedStorageGb;
const phoneMemoryFilterRequest = (explicitPhoneDeviceRequest || phoneNfcFilterRequestV228 || phone5gFilterRequestV338) && (requestedRamGb.length > 0 || requestedStorageGb.length > 0);
const brandAliasesForModel = ['poco', 'xiaomi'];
const modelTokens = tokens.filter((token) => !genericPhoneWords.has(token) && !brandAliasesForModel.includes(token));
const specificDeviceModelRequest = Boolean(requestedDeviceBrand && modelTokens.length > 0);
const requestedDeviceModelQuery = specificDeviceModelRequest ? modelTokens.join(' ') : '';
return [{ json: {
    requestedDeviceBrand,
    requestedDeviceBrandLabel: 'Xiaomi', requestedRamGb, requestedStorageGb, phoneMemoryFilterRequest, specificDeviceModelRequest, requestedDeviceModelQuery
} }];
` } };

patchPrepareSearch([prepareNode]);
const runPrepare = (json) => new Function('$json', prepareNode.parameters.jsCode)(json)[0].json;
for (const message of ['Poco qualquer modelo contanto que seja 12 de Ram', 'Poco qualquer modelo portando qui seja 12 de Ram']) {
  const result = runPrepare({ conversation: message });
  assert.deepStrictEqual(result.requestedRamGb, [12]);
  assert.strictEqual(result.phoneMemoryFilterRequest, true);
  assert.strictEqual(result.specificDeviceModelRequest, false);
  assert.strictEqual(result.requestedDeviceModelQuery, '');
  assert.strictEqual(result.requestedDeviceFamily, 'poco');
}
const continuation = runPrepare({ conversation: '?', salesSearchQuery: 'poco ram 12gb' });
assert.deepStrictEqual(continuation.requestedRamGb, [12]);
assert.strictEqual(continuation.requestedDeviceFamily, 'poco');
assert.match(prepareNode.parameters.jsCode, new RegExp(MARKER));

const contextNode = { name: 'Vendas - Contexto Produtos', parameters: { jsCode: `
const base = {};
const normalize = (value) => String(value || '').toLowerCase();
const requestedDeviceBrand = String(base.requestedDeviceBrand || '').trim();
const requestedDeviceBrandLabel = String(base.requestedDeviceBrandLabel || requestedDeviceBrand || '').trim();
const brandAliases = { xiaomi: ['xiaomi', 'redmi', 'poco'] };
const productMatchesRequestedBrand = (product) => {
  if (!requestedDeviceBrand) return false;
  const aliases = brandAliases[requestedDeviceBrand] || [requestedDeviceBrand];
  const text = normalize([product.name, product.brand, product.category].filter(Boolean).join(' '));
  return aliases.some((alias) => new RegExp('\\\\b' + alias + '\\\\b').test(text));
};
const prefersSmartphones = true, hasStructuredPreferenceV288 = true, products = [], structuredFilterFallbackV1 = false;
const isQuoteDeviceProduct = () => true;
const buildQuoteMessageForProducts = (chunk, offset, includeHeader, includeQuestion) => {
  const chunkLines = [];
  chunk.forEach((product, index) => {
    chunkLines.push((offset + index + 1) + '. ' + product.name);
  });
  return chunkLines.join('[[BR]]');
};
return [{ json: {
    productLookupCount: products.length,
} }];
` } };
patchProductContext([contextNode]);
assert.match(contextNode.parameters.jsCode, /buildFeatureSummaryV365/);
assert.match(contextNode.parameters.jsCode, /requestedDeviceFamilyV365/);

const composerNode = { name: 'Vendas - Compor Resposta IA', parameters: { jsCode: `
const source = $('Vendas - Contexto Produtos').first().json || {};
const aiOutput = String($json.output || '').trim();
const catalogOutput = String(source.deterministicCatalogOutput || '').trim();
return [{ json: {
    ...source,
    output: [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]'),
    requiresSpecialistHandoff: false,
} }];
` } };
patchComposer([composerNode]);
const composed = new Function('$json', '$', composerNode.parameters.jsCode)(
  { output: 'redação repetida' },
  () => ({ first: () => ({ json: { structuredPhoneComparison: true, deterministicCatalogOutput: 'lista estruturada' } }) }),
)[0].json;
assert.strictEqual(composed.output, 'lista estruturada');

const summary = summarize([prepareNode, contextNode, composerNode]);
for (const key of ['markerPresent', 'impliedRamParsed', 'classifierContinuationParsed', 'familyFilterPresent', 'genericPreferenceNotModel', 'structuredFeatureLinePresent', 'aiEssaySuppressed']) {
  assert.strictEqual(summary[key], true, key);
}
console.log('n8n structured phone comparison static regression: ok');
