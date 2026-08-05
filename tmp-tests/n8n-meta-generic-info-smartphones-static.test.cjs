const assert = require('node:assert/strict');
const {
  META_INTRO_GUIDANCE,
  SMARTPHONES_CATEGORY_ID,
  isMetaSmartphonesListMessageV167,
  patchWorkflow,
  summarize,
} = require('./n8n-meta-generic-info-smartphones.cjs');

const resolverCode = `const source = $json || {};
const text = String($json.conversation || '');
const allowedActions = new Set(['responder_direto','listar_catalogo','perguntar_esclarecimento']);
const parsed = { acao: 'perguntar_esclarecimento', intencao: 'fallback' };
// meta-generic-info-smartphones-v166
const metaSmartphonesListMessageV166 = true;
const deterministicMetaSmartphonesListV166 = metaSmartphonesListMessageV166 ? {
  acao: 'listar_catalogo',
  intencao: 'meta_anuncio_lista_smartphones',
  produto_busca: 'smartphones',
  categoria_nome: 'smartphones',
  categoria_id: '${SMARTPHONES_CATEGORY_ID}',
} : null;
// unavailable-phone-offer-greeting-v165
const deterministicPhoneStockListDecisionV165 = null;
const deterministicFiscalDocumentDecisionV164 = null;
const fiscalDocumentGuidanceV164 = '';
const legacy = null;
const fallbackDecision = () => ({ acao: 'perguntar_esclarecimento' });
const decision = deterministicMetaSmartphonesListV166 || deterministicPhoneStockListDecisionV165 || deterministicFiscalDocumentDecisionV164 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));
const action = allowedActions.has(String(decision.acao || '')) ? String(decision.acao) : 'perguntar_esclarecimento';
const directOutput = '';
return [{ json: {
  ...source,
  conversationAction: action,
  conversationIntent: String(decision.intencao || ''),
  aiResponseGuidance: fiscalDocumentGuidanceV164 || String($json.aiResponseGuidance || ''),
  directOutput,
} }];`;

const productContextCode = `const base = $json || {};
const greetingLine = '';
const smartwatchAvailabilityIntroV162 = '';
const unavailableDeviceIntroMessage = '';
const finalQuoteMessages = ['LISTA REAL DE CELULARES', 'Qual numero chamou sua atencao?'];
return [{ json: {
  ...base,
  output: [greetingLine, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),
} }];`;

const nodes = [
  { name: 'Resolver Acao de Conversacao', parameters: { jsCode: resolverCode } },
  {
    name: 'Agente Geral - Atendimento',
    position: [1000, 0],
    parameters: { text: '={{$json.conversation}}', options: { systemMessage: 'Responda naturalmente.' } },
  },
  { name: 'Vendas - Contexto Produtos', parameters: { jsCode: productContextCode } },
  { name: 'Vendas - Preparar Busca', parameters: { jsCode: 'return [{ json: $json }];' } },
  { name: 'Dividir mensagens', parameters: { jsCode: 'return [];' } },
];
const connections = {
  'Agente Geral - Atendimento': { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] },
};

patchWorkflow(nodes, connections);
const summary = summarize(nodes, connections);
for (const [key, value] of Object.entries(summary)) assert.equal(value, true, key);

for (const message of [
  'Olá! Posso ter mais informações sobre isso?',
  'ola posso ter mais informacoes sobre isso',
  '  OLÁ, POSSO TER MAIS INFORMAÇÕES SOBRE ISSO?!  ',
]) {
  assert.equal(isMetaSmartphonesListMessageV167(message), true, message);
}
for (const message of [
  'Olá',
  'Posso ter mais informações?',
  'Quero informações sobre uma capa',
  'Tem mais informações sobre o Redmi 15?',
  'Olá! Posso ter mais informações sobre entrega?',
]) {
  assert.equal(isMetaSmartphonesListMessageV167(message), false, message);
}

const executeResolver = new Function('$json', '$getWorkflowStaticData', nodes[0].parameters.jsCode);
const metaResult = executeResolver(
  { remoteJid: '558799999999@s.whatsapp.net', conversation: 'Olá! Posso ter mais informações sobre isso?' },
  () => ({}),
)[0].json;
assert.equal(metaResult.conversationAction, 'responder_direto');
assert.equal(metaResult.conversationIntent, 'meta_anuncio_intro_smartphones');
assert.equal(metaResult.metaSmartphoneAdRequest, true);
assert.equal(metaResult.directOutput, '');
assert.equal(metaResult.aiResponseGuidance, META_INTRO_GUIDANCE);
assert.match(metaResult.aiResponseGuidance, /palavras proprias/);
assert.match(metaResult.aiResponseGuidance, /catalogo real sera anexado/);

const ordinaryResult = executeResolver(
  { remoteJid: '558799999999@s.whatsapp.net', conversation: 'Quero informações sobre uma capa' },
  () => ({}),
)[0].json;
assert.equal(ordinaryResult.conversationAction, 'perguntar_esclarecimento');
assert.equal(ordinaryResult.metaSmartphoneAdRequest, false);

const restoreNode = nodes.find((node) => node.name === 'Meta - Preservar introducao e listar');
const executeRestore = new Function('$json', '$', restoreNode.parameters.jsCode);
const restored = executeRestore(
  { output: 'Que bom ter você por aqui! Vou mostrar as opções disponíveis.' },
  () => ({ first: () => ({ json: metaResult }) }),
)[0].json;
assert.equal(restored.metaSmartphoneCatalogIntro, 'Que bom ter você por aqui! Vou mostrar as opções disponíveis.');
assert.equal(restored.salesCategoryId, SMARTPHONES_CATEGORY_ID);
assert.equal(restored.salesRequestKind, 'categoria');
assert.equal(restored.saudacaoDetectada, false);

assert.throws(
  () => executeRestore({ output: '' }, () => ({ first: () => ({ json: metaResult }) })),
  /introducao da IA.*vazia/i,
  'catalog must never be sent without an AI introduction',
);

const productNode = nodes.find((node) => node.name === 'Vendas - Contexto Produtos');
const productResult = new Function('$json', '$input', '$getWorkflowStaticData', '$', productNode.parameters.jsCode)(
  restored,
  {},
  () => ({}),
  () => ({ first: () => ({ json: restored }) }),
)[0].json;
const parts = productResult.output.split('[[MSG]]');
assert.equal(parts[0], restored.metaSmartphoneCatalogIntro);
assert.equal(parts[1], 'LISTA REAL DE CELULARES');
assert.equal(parts[2], 'Qual numero chamou sua atencao?');

assert.equal(connections['Agente Geral - Atendimento'].main[0][0].node, 'Meta - Anuncio de smartphones?');
assert.equal(connections['Meta - Anuncio de smartphones?'].main[0][0].node, 'Meta - Preservar introducao e listar');
assert.equal(connections['Meta - Anuncio de smartphones?'].main[1][0].node, 'Dividir mensagens');
assert.equal(connections['Meta - Preservar introducao e listar'].main[0][0].node, 'Vendas - Preparar Busca');

patchWorkflow(nodes, connections);
assert.equal(summarize(nodes, connections).oldRuleRemoved, true, 'patch must be idempotent and old rule must stay removed');

console.log(JSON.stringify({ passed: 31, summary }, null, 2));
