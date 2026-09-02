import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  MARKER,
  patchPrepareSearch,
  patchProductContext,
  patchSalesAgent,
  patchGraph,
  composerCode,
} = require('./n8n-ai-natural-sales-responses.cjs');

const oldBudgetBlock = `const priceContextV288 = /\\b(?:ate|maximo|limite|orcamento|investir|gastar|faixa|valor|preco)\\b|r\\$/i.test(rawFilterTextV288);
const bareBudgetContinuationV288 = /^\\s*(?:r\\$\\s*)?\\d{2,6}(?:[.,]\\d{1,2})?\\s*$/i.test(rawFilterTextV288)
  && Boolean(source.n8nBotControl?.sales_preferences?.active || previousSalesFiltersV288.cameraQuality || previousSalesFiltersV288.cameraPriority || previousSalesFiltersV288.screenQuality || previousSalesFiltersV288.screenPriority || previousSalesFiltersV288.nfc || previousSalesFiltersV288.ramGb?.length || previousSalesFiltersV288.storageGb?.length);
if (priceContextV288 || bareBudgetContinuationV288) {
  const moneyMatch = rawFilterTextV288.match(/(?:r\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d{2,6}(?:[.,]\\d{1,2})?)/i);
  const cents = parseMoneyCentsV288(moneyMatch?.[1] || '');
  if (cents) salesFilterPatchV288.maxPriceCents = cents;
}`;

const prepareFixture = `
const source = $json;
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const previousSalesFiltersV288 = { ...(source.previousFilters || {}) };
const salesFilterPatchV288 = {};
const rawFilterTextV288 = String(source.conversation || source.classificacaoMensagem || '');
const normalizedFilterTextV288 = normalize(rawFilterTextV288);
const parseMoneyCentsV288 = (value) => {
  const clean = String(value || '').replace(/\\s/g, '').replace(/\\.(?=\\d{3}(?:\\D|$))/g, '').replace(',', '.');
  const parsed = Number(clean.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
};
${oldBudgetBlock}
const mergedSalesFiltersV288 = { ...previousSalesFiltersV288, ...salesFilterPatchV288 };
const specificDeviceModelRequest = source.specificDeviceModelRequest === true;
const requestedDeviceModelQuery = specificDeviceModelRequest ? String(source.salesSearchQuery || '').trim() : '';
const requestedDeviceModelLabel = requestedDeviceModelQuery || '';
return [{ json: { maxPriceCents: Number(mergedSalesFiltersV288.maxPriceCents || 0), requestedDeviceModelQuery } }];
`;

const prepareNode = { parameters: { jsCode: prepareFixture } };
patchPrepareSearch(prepareNode);
const runPrepare = (json) => new Function('$json', prepareNode.parameters.jsCode)(json)[0].json;

for (const message of [
  'Valor do POCO X8 Pro?',
  'Qual o preço do iPhone 15?',
  'Valor do Redmi Note 14?',
  'Preço do Galaxy S25 Ultra',
]) {
  const result = runPrepare({
    conversation: message,
    salesSearchQuery: message,
    specificDeviceModelRequest: true,
    previousFilters: { maxPriceCents: 800 },
  });
  assert.equal(result.maxPriceCents, 0, `${message} must not become a price ceiling`);
}

assert.equal(runPrepare({ conversation: 'até 2500', specificDeviceModelRequest: false }).maxPriceCents, 250000);
assert.equal(runPrepare({ conversation: 'orçamento de 2.500', specificDeviceModelRequest: false }).maxPriceCents, 250000);
assert.equal(runPrepare({ conversation: 'posso gastar 1800', specificDeviceModelRequest: false }).maxPriceCents, 180000);
assert.equal(runPrepare({ conversation: 'R$ 2.630,00', specificDeviceModelRequest: false }).maxPriceCents, 263000);
assert.equal(
  runPrepare({
    conversation: '1500',
    specificDeviceModelRequest: false,
    previousFilters: { cameraPriority: true },
    n8nBotControl: { sales_preferences: { active: true } },
  }).maxPriceCents,
  150000,
);

const contextFixture = `
const base = {};
const brandLabel = 'Xiaomi';
const products = [];
const finalQuoteMessages = [];
const prefersSmartphones = true;
const hasStructuredPreferenceV288 = false;
const phoneNfcFilterRequestV228 = false;
const phoneMemoryFilterRequestV155 = false;
const unavailableRequestedDevice = true;
const requestedDeviceModelLabel = 'POCO X8 Pro';
const requestedDeviceBrandLabel = 'Xiaomi';
const isCompleteCategoryRequest = false;
const greetingLine = 'Boa tarde';
const smartwatchAvailabilityIntroV162 = 'Temos estas opcoes';
if (base.needsDeviceClarification === true) {
  return [{
    json: {
      ...base,
      productLookupFound: false,
      productLookupCount: 0,
      productInStock: [],
      output: 'O senhor esta falando de celulares ' + brandLabel + '?',
    },
  }];
}
const unavailableDeviceIntroMessage = unavailableRequestedDevice
  ? 'Esse ' + (requestedDeviceModelLabel || requestedDeviceBrandLabel || 'modelo') + ' acabou no momento, mas temos outros celulares disponiveis. Vou te enviar a lista completa.'
  : '';
// unavailable-phone-offer-greeting-v165
const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones && !hasStructuredPreferenceV288 && !phoneNfcFilterRequestV228 && !phoneMemoryFilterRequestV155;
const unavailablePhoneGuidanceV165 = unavailablePhoneOfferV165 ? "O cliente procurou um celular. Responda com palavras proprias." : '';
// first-contact-cordiality-v227
const cordialCatalogIntroV227 = greetingLine
  ? 'Vou atualizar as opções disponíveis para você e já envio a lista. Só um momento! 📱✨'
  : String(base.metaSmartphoneCatalogIntro || '').trim();

const structuredFilterNeedsHandoffV288 = hasStructuredPreferenceV288 && products.length === 0;
const structuredFilterGuidanceV288 = structuredFilterNeedsHandoffV288
  ? 'Obrigado pelas informações 😊 Não consegui identificar com segurança, de forma automática, qual opção combina melhor com todas as suas preferências.'
  : '';
const phoneCatalogFollowupEligibleV289 = Boolean(isCompleteCategoryRequest && prefersSmartphones && products.length > 0);
return [{ json: {
    productsContext: '',
    stockAssistantContext: structuredFilterGuidanceV288 || unavailablePhoneGuidanceV165 || String(base.stockAssistantContext || ''),
    aiResponseGuidance: structuredFilterGuidanceV288 || unavailablePhoneGuidanceV165 || String(base.aiResponseGuidance || ''),
    output: [greetingLine, cordialCatalogIntroV227, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),
} }];
`;

const contextNode = { parameters: { jsCode: contextFixture } };
patchProductContext(contextNode);
for (const stale of [
  'acabou no momento',
  'O senhor esta falando de celulares',
  'Vou atualizar as opções disponíveis para você',
  'unavailableDeviceIntroMessage',
  'unavailablePhoneGuidanceV165',
  'structuredFilterGuidanceV288',
]) {
  assert.doesNotMatch(contextNode.parameters.jsCode, new RegExp(stale));
}
assert.match(contextNode.parameters.jsCode, /salesAvailabilityStatusV322/);
assert.match(contextNode.parameters.jsCode, /deterministicCatalogOutputV322/);

const agentNode = { parameters: { options: {} } };
patchSalesAgent(agentNode);
assert.match(agentNode.parameters.options.systemMessage, new RegExp(`${MARKER}:agent`));
assert.match(agentNode.parameters.options.systemMessage, /Nunca transforme busca vazia em afirmacao de indisponibilidade/);
assert.match(agentNode.parameters.options.systemMessage, /Nao reproduza a lista deterministica/);
assert.match(agentNode.parameters.text, /Saudacao pendente/);
assert.match(agentNode.parameters.options.systemMessage, /Saudacao pendente: sim/);
assert.doesNotMatch(agentNode.parameters.options.systemMessage, /Esse .* acabou no momento/);

const nodes = [
  { name: 'Vendas - Contexto Produtos', parameters: { jsCode: contextNode.parameters.jsCode } },
  { name: 'Especialista - Vendas', position: [100, 100], parameters: agentNode.parameters },
  {
    id: 'sales-product-found-if-v152', name: 'Vendas - Produto encontrado?', type: 'n8n-nodes-base.if',
    typeVersion: 2.2, parameters: {},
  },
  { name: 'Vendas - Preparar Handoff Especialista', parameters: {} },
  { name: 'Dividir mensagens', parameters: {} },
];
const connections = {
  'Vendas - Contexto Produtos': { main: [[{ node: 'Vendas - Produto encontrado?', type: 'main', index: 0 }]] },
  'Vendas - Produto encontrado?': { main: [[], []] },
  'Especialista - Vendas': { main: [[{ node: 'Vendas - Preparar Handoff Especialista', type: 'main', index: 0 }]] },
};
patchGraph(nodes, connections);
assert.equal(connections['Vendas - Contexto Produtos'].main[0][0].node, 'Especialista - Vendas');
assert.equal(connections['Especialista - Vendas'].main[0][0].node, 'Vendas - Compor Resposta IA');
assert.equal(connections['Vendas - Compor Resposta IA'].main[0][0].node, 'Vendas - Precisa Handoff?');
assert.equal(connections['Vendas - Precisa Handoff?'].main[0][0].node, 'Vendas - Preparar Handoff Especialista');
assert.equal(connections['Vendas - Precisa Handoff?'].main[1][0].node, 'Dividir mensagens');

const compose = new Function('$json', '$', composerCode());
const source = {
  deterministicCatalogOutput: '📱 LISTA OFICIAL',
  requiresSpecialistHandoff: false,
};
const composed = compose(
  { output: 'Encontrei estas opções para você 😊' },
  () => ({ first: () => ({ json: source }) }),
)[0].json;
assert.equal(composed.output, 'Encontrei estas opções para você 😊[[MSG]]📱 LISTA OFICIAL');
assert.equal(composed.requiresSpecialistHandoff, false);

console.log('n8n AI natural sales responses regression test passed');
