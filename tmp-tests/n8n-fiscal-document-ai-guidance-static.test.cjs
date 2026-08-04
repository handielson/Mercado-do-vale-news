const assert = require('node:assert/strict');
const {
  POLICY_GUIDANCE,
  detectFiscalDocumentIntentV164,
  patchWorkflow,
  summarize,
} = require('./n8n-add-fiscal-document-ai-guidance.cjs');

const resolverCode = `const source = $json || {};
const text = String($json.conversation || '');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const allowedActions = new Set(['responder_direto','listar_catalogo','perguntar_esclarecimento']);
const parsed = { acao: 'listar_catalogo', intencao: 'vendas_produtos' };
const normalizedPhoneMemoryTextV155 = normalize(text);
const deterministicPhoneMemoryFilterV155 = null;
// smartwatch-category-greeting-v162
const normalizedSmartwatchTextV162 = normalize(text);
const deterministicSmartwatchCatalogV162 = null;
const deterministicStoreLocationV129 = null;
const deterministicServiceDecisionV135 = null;
const legacy = null;
const fallbackDecision = () => ({ acao: 'perguntar_esclarecimento' });
const decision = deterministicSmartwatchCatalogV162 || deterministicPhoneMemoryFilterV155 || deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));
const action = allowedActions.has(String(decision.acao || '')) ? String(decision.acao) : 'perguntar_esclarecimento';
const directOutput = '';
return [{
  json: {
    ...source,
    ...$json,
    conversationAction: action,
    conversationIntent: String(decision.intencao || ''),
    directOutput,
  },
}];`;

const nodes = [
  { name: 'Resolver Acao de Conversacao', parameters: { jsCode: resolverCode } },
  {
    name: 'Agente Geral - Atendimento',
    parameters: {
      text: "={{'Mensagem do cliente: ' + $json.conversation)}}",
      options: { systemMessage: 'Responda em portugues.' },
    },
  },
];

patchWorkflow(nodes);
const summary = summarize(nodes);
for (const [key, value] of Object.entries(summary)) assert.equal(value, true, key);

const fiscalCases = [
  'Vocês emitem nota fiscal?',
  'Tem NF?',
  'Vocês fornecem NF-e?',
  'Sai NFe na compra?',
  'Recebo cupom fiscal?',
  'Pode mandar o DANFE?',
];
for (const message of fiscalCases) assert.equal(detectFiscalDocumentIntentV164(message), true, message);

const ordinaryCases = [
  'Tem NFC no Redmi?',
  'Quero informações do produto',
  'Preciso de um carregador',
  'Nota 10 para o atendimento',
];
for (const message of ordinaryCases) assert.equal(detectFiscalDocumentIntentV164(message), false, message);

const executeResolver = new Function('$json', nodes[0].parameters.jsCode);
const fiscalResult = executeResolver({ conversation: 'Boa tarde, vocês emitem nota fiscal?' })[0].json;
assert.equal(fiscalResult.conversationAction, 'responder_direto');
assert.equal(fiscalResult.conversationIntent, 'documentos_compra');
assert.equal(fiscalResult.directOutput, '');
assert.equal(fiscalResult.aiResponseGuidance, POLICY_GUIDANCE);
assert.match(fiscalResult.aiResponseGuidance, /palavras proprias/);
assert.match(fiscalResult.aiResponseGuidance, /comprovante de compra e venda/);
assert.match(fiscalResult.aiResponseGuidance, /consultar os dados da compra a qualquer momento/);
assert.match(fiscalResult.aiResponseGuidance, /termo de garantia e o comprovante de venda/);
assert.match(fiscalResult.aiResponseGuidance, /Nao afirme que a loja emite nota fiscal/);

const ordinaryResult = executeResolver({ conversation: 'Tem NFC no Redmi?' })[0].json;
assert.equal(ordinaryResult.conversationAction, 'listar_catalogo');
assert.equal(ordinaryResult.aiResponseGuidance, '');

console.log(JSON.stringify({ passed: fiscalCases.length + ordinaryCases.length + 14, summary }, null, 2));
