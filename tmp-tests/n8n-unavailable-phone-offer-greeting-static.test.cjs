const assert = require('node:assert/strict');
const {
  PHONE_OFFER_GUIDANCE,
  isPhoneListConfirmationV165,
  patchWorkflow,
  summarize,
} = require('./n8n-fix-unavailable-phone-offer-greeting.cjs');

const resolverCode = `const source = $json || {};
const text = String($json.conversation || '');
const allowedActions = new Set(['responder_direto','listar_catalogo','perguntar_esclarecimento']);
const parsed = { acao: 'responder_direto', intencao: 'fallback' };
const deterministicFiscalDocumentDecisionV164 = null;
// fiscal-document-ai-guidance-v164
const deterministicSmartwatchCatalogV162 = null;
const deterministicPhoneMemoryFilterV155 = null;
const deterministicStoreLocationV129 = null;
const deterministicServiceDecisionV135 = null;
const legacy = null;
const fallbackDecision = () => ({ acao: 'perguntar_esclarecimento' });
const decision = deterministicFiscalDocumentDecisionV164 || deterministicSmartwatchCatalogV162 || deterministicPhoneMemoryFilterV155 || deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));
const action = allowedActions.has(String(decision.acao || '')) ? String(decision.acao) : 'perguntar_esclarecimento';
const catalogRequest = action === 'listar_catalogo';
return [{ json: { ...source, ...$json, conversationAction: action, conversationIntent: String(decision.intencao || ''), salesCategoryId: catalogRequest ? String(decision.categoria_id || '') : '' } }];`;

const productCode = `const base = $json || {};
const products = Array.isArray(base.products) ? base.products : [];
const prefersSmartphones = base.prefersSmartphones === true;
const greetingLine = '';
const smartwatchAvailabilityIntroV162 = '';
const unavailableDeviceIntroMessage = '';
const finalQuoteMessages = [];
try {} catch (error) {}

return [{
  json: {
    ...base,
    productLookupSource: 'test',
    productLookupFound: products.length > 0,
    productLookupCount: products.length,
    productsInStock: products,
    productsContext: '',
    paymentFeesSource: 'test',
    stockAssistantContext: products.length === 0 && prefersSmartphones
      ? 'O modelo procurado não está disponível agora. Responda de forma natural, avise isso e pergunte se o cliente quer receber a lista dos celulares disponíveis à pronta entrega. Não envie modelos, preços ou links antes de uma confirmação clara.'
      : '',
    output: [greetingLine, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),
  },
}];`;

const nodes = [
  { name: 'Resolver Acao de Conversacao', parameters: { jsCode: resolverCode } },
  { name: 'Vendas - Contexto Produtos', parameters: { jsCode: productCode } },
  {
    name: 'Agente Geral - Atendimento',
    parameters: {
      text: "={{(($json.clienteNome ? 'Nome do cliente salvo: ' + $json.clienteNome + '.\\n' : '') + ($json.stockAssistantContext ? 'Contexto obrigatório de estoque: ' + $json.stockAssistantContext + '\\n' : '') + 'Mensagem do cliente: ' + $json.conversation)}}",
      options: { systemMessage: 'Responda naturalmente.' },
    },
  },
];

patchWorkflow(nodes);
const summary = summarize(nodes);
for (const [key, value] of Object.entries(summary)) assert.equal(value, true, key);

for (const message of ['sim', 'Quero', 'quero receber', 'pode mandar', 'pode mandar a lista', 'me envie', 'sim, por favor', 'claro']) {
  assert.equal(isPhoneListConfirmationV165(message), true, message);
}
for (const message of ['não', 'tem fonte 12v?', 'quero um smartwatch', 'sim, tem entrega?', 'manda uma capa']) {
  assert.equal(isPhoneListConfirmationV165(message), false, message);
}

const staticData = {
  pendingPhoneStockListOffer: {
    '557491131013@s.whatsapp.net': { expiresAt: Date.now() + 60_000 },
  },
};
const executeResolver = new Function('$json', '$getWorkflowStaticData', nodes[0].parameters.jsCode);
const confirmed = executeResolver(
  { remoteJid: '557491131013@s.whatsapp.net', conversation: 'pode mandar' },
  () => staticData,
)[0].json;
assert.equal(confirmed.conversationAction, 'listar_catalogo');
assert.equal(confirmed.conversationIntent, 'catalogo_smartphones_confirmado');
assert.equal(confirmed.salesCategoryId, '8b7c4852-c195-4527-8fd7-c3cc2debda42');
assert.equal(staticData.pendingPhoneStockListOffer['557491131013@s.whatsapp.net'], undefined);

const phoneStatic = {};
const executeProduct = new Function('$json', '$input', '$getWorkflowStaticData', '$', nodes[1].parameters.jsCode);
const phoneResult = executeProduct(
  { remoteJid: '557491131013@s.whatsapp.net', conversation: 'Tem S22 Ultra?', products: [], prefersSmartphones: true },
  {},
  () => phoneStatic,
  () => ({ first: () => ({ json: {} }) }),
)[0].json;
assert.equal(phoneResult.stockAssistantContext, PHONE_OFFER_GUIDANCE);
assert.equal(phoneResult.aiResponseGuidance, PHONE_OFFER_GUIDANCE);
assert.ok(phoneStatic.pendingPhoneStockListOffer['557491131013@s.whatsapp.net']);
assert.match(phoneResult.aiResponseGuidance, /especialista conferir o modelo/);
assert.match(phoneResult.aiResponseGuidance, /pergunte se ele quer receber a lista/);
assert.match(phoneResult.aiResponseGuidance, /Nao envie a lista/);

const otherStatic = {};
const otherResult = executeProduct(
  { remoteJid: '557400000000@s.whatsapp.net', conversation: 'Tem fonte 12v?', products: [], prefersSmartphones: false },
  {},
  () => otherStatic,
  () => ({ first: () => ({ json: {} }) }),
)[0].json;
assert.equal(otherResult.stockAssistantContext, '');
assert.equal(otherResult.aiResponseGuidance, '');
assert.deepEqual(otherStatic.pendingPhoneStockListOffer || {}, {});

const agentText = nodes[2].parameters.text;
assert.match(agentText, /Saudacao pendente: sim/);
assert.match(agentText, /\[\[SAUDACAO\]\]/);

console.log(JSON.stringify({ passed: 28, summary }, null, 2));
