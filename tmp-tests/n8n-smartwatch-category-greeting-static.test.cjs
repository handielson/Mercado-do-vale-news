const assert = require('node:assert/strict');
const { patchWorkflow, summarize } = require('./n8n-fix-smartwatch-category-greeting.cjs');

const resolverCode = `const source = {};
const text = String($json.conversation || '').trim();
const rawOutput = String($json.output || '').trim();
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const safeJsonParse = (value) => { try { return JSON.parse(value); } catch { return null; } };
const allowedActions = new Set(['buscar_produto','listar_catalogo','perguntar_esclarecimento']);
const parsed = safeJsonParse(rawOutput);
const normalizedPhoneMemoryTextV155 = normalize(text);
const deterministicPhoneMemoryFilterV155 = /celular/.test(normalizedPhoneMemoryTextV155) && /128gb/.test(normalizedPhoneMemoryTextV155) ? { acao: 'listar_catalogo' } : null;
const deterministicStoreLocationV129 = null;
const deterministicServiceDecisionV135 = null;
const legacyDecision = () => null;
const fallbackDecision = () => ({ acao: 'perguntar_esclarecimento' });
const legacy = legacyDecision($json, text);
const decision = deterministicPhoneMemoryFilterV155 || deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));
const action = allowedActions.has(String(decision.acao || '')) ? String(decision.acao) : 'perguntar_esclarecimento';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const productQuery = String(decision.produto_busca || $json.productSearchTerm || text || '').trim();
const catalogRequest = action === 'listar_catalogo';
const productSearchRequest = action === 'buscar_produto';
return [{ json: {
  conversationAction: action,
  productSearchTerm: catalogRequest ? 'smartphones' : productQuery,
  salesCategoryName: catalogRequest ? 'smartphones' : String($json.salesCategoryName || ''),
  salesCategoryId: catalogRequest ? SMARTPHONES_CATEGORY_ID : String($json.salesCategoryId || ''),
  conversationDecision: decision,
} }];`;

const parseCode = `const source = $('Vendas - Preparar Contexto IA').first().json;
const parsed = { saudacao_detectada: false };
const normalizeGreetingV160 = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const pureGreetingV160 = (value) => /^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite)(?: tudo bem)?$/.test(normalizeGreetingV160(value));
const currentStartsWithGreetingV160 = /^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite)(?:\\b|$)/.test(normalizeGreetingV160(source.conversation));
return [{ json: { ...source, saudacaoDetectada: parsed.saudacao_detectada === true || currentStartsWithGreetingV160, pure: pureGreetingV160(source.conversation) } }];`;

const productCode = `const base = $json;
const products = [{ name: 'Smartwatch Teste' }];
const unavailableRequestedDevice = false;
const finalQuoteMessages = ['produto'];
const unavailableDeviceIntroMessage = '';
const memoryFilterTitleV155 = '';
const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Recife' });
const greetingLine = (() => {
  if (base.saudacaoDetectada !== true) return '';
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
})();
const titleOne = memoryFilterTitleV155 || (unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento');
const titleTwo = memoryFilterTitleV155 || (unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento');
return [{ json: { output: [greetingLine, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'), titleOne, titleTwo } }];`;

const nodes = [
  { name: 'Resolver Acao de Conversacao', parameters: { jsCode: resolverCode } },
  { name: 'Parse Classificacao', parameters: { jsCode: parseCode } },
  { name: 'Vendas - Contexto Produtos', parameters: { jsCode: productCode } },
];
patchWorkflow(nodes);
const summary = summarize(nodes);
Object.entries(summary).forEach(([key, value]) => assert.equal(value, true, key));

const resolver = new Function('$json', nodes[0].parameters.jsCode);
const smartwatch = resolver({
  conversation: 'Ai tem smartwhatch?',
  output: JSON.stringify({ acao: 'listar_catalogo', produto_busca: 'smartphones' }),
})[0].json;
assert.equal(smartwatch.conversationAction, 'listar_catalogo');
assert.equal(smartwatch.productSearchTerm, 'smartwatchs');
assert.equal(smartwatch.salesCategoryName, 'Smartwatchs');
assert.equal(smartwatch.salesCategoryId, '6acd2038-2dd6-463d-a33b-3a0e80ee4350');

for (const phrase of ['Tem smartwatch?', 'Tem smartwacth?', 'Tem relógio inteligente?', 'Tem Apple Watch?']) {
  const result = resolver({ conversation: phrase, output: '{}' })[0].json;
  assert.equal(result.salesCategoryId, '6acd2038-2dd6-463d-a33b-3a0e80ee4350', phrase);
}
const accessory = resolver({
  conversation: 'Tem pulseira para smartwatch?',
  output: JSON.stringify({ acao: 'buscar_produto', produto_busca: 'pulseira smartwatch' }),
})[0].json;
assert.equal(accessory.conversationAction, 'buscar_produto');
assert.equal(accessory.salesCategoryId, '');
assert.equal(accessory.productSearchTerm, 'pulseira smartwatch');

const generic = resolver({ conversation: 'Quero o catálogo', output: JSON.stringify({ acao: 'listar_catalogo' }) })[0].json;
assert.equal(generic.salesCategoryId, '8b7c4852-c195-4527-8fd7-c3cc2debda42');

const parse = new Function('$', '$json', nodes[1].parameters.jsCode);
const lookup = () => ({ first: () => ({ json: { conversation: 'Bomm dia' } }) });
assert.equal(parse(lookup, {})[0].json.saudacaoDetectada, true);
assert.equal(parse(lookup, {})[0].json.pure, true);

const product = new Function('$json', nodes[2].parameters.jsCode)({
  saudacaoDetectada: true,
  clienteNome: 'Leonardo Silva',
  productCategoryId: '6acd2038-2dd6-463d-a33b-3a0e80ee4350',
})[0].json;
assert.match(product.output, /^(?:Bom dia|Boa tarde|Boa noite), Leonardo, tudo bem\? 😊/);
assert.match(product.output, /Temos sim! Vou te mostrar os smartwatches disponíveis agora:/);
assert.equal(product.titleOne, '⌚ Smartwatches disponíveis agora');
assert.equal(product.titleTwo, '⌚ Smartwatches disponíveis agora');

console.log(JSON.stringify({ passed: 12, summary }, null, 2));
