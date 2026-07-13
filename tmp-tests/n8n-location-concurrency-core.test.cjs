const assert = require('node:assert/strict');
const { patchWorkflow } = require('./n8n-fix-location-concurrency.cjs');

const nodes = [
  {
    name: 'Agente Inicial - Classificador',
    parameters: { options: { systemMessage: 'Intencoes:\n- pedido_humano\n- fallback' } },
  },
  {
    name: 'Parse Classificacao',
    parameters: { jsCode: `const source = $json;
const parsed = {};
const allowed = new Set(['saudacao', 'pedido_humano', 'fallback']);
const intencao = allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback';
return [{ json: { ...source, intencao } }];` },
  },
  {
    name: 'Resolver Acao de Conversacao',
    parameters: { jsCode: `const text = String($json.conversation || '');
const normalize = (value) => String(value || '').toLowerCase();
const legacy = null;
const fallbackDecision = () => ({ acao: 'perguntar_esclarecimento' });
const allowedActions = new Set(['responder_direto','perguntar_esclarecimento']);
const parsed = null;
const decision = parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision());
return [{ json: { ...$json, conversationAction: decision.acao } }];` },
  },
  { name: 'Switch Especialistas', parameters: { rules: { values: [] } } },
  {
    name: 'Dividir mensagens',
    parameters: { jsCode: `const source = {}; const contact = {}; const prepared = {};
const remoteJid = $json.remoteJid;
const instancia = $json.Instancia || $json.instancia || source.Instancia || contact.Instancia;
const shouldInviteName = true; const nameInvitation = 'nome';
const prefix = shouldInviteName ? [nameInvitation] : [];
const toItem = (message) => ({ json: { message, remoteJid, instancia } });
if (Array.isArray($json.messages)) {
  const messages = [...prefix, ...$json.messages.filter((message) => message && (message.text || message.mediaUrl))];
  return messages.map(toItem);
}
const parts = ['resposta'];
return [...prefix, ...parts].map(toItem);` },
  },
  {
    name: 'Contato - Resposta salvo',
    parameters: { jsCode: "const source = $('Mensagem parece nome?').item.json; return [{ json: source }];" },
  },
];
const connections = { 'Switch Especialistas': { main: [] } };

patchWorkflow(nodes, connections);

const resolver = nodes.find((node) => node.name === 'Resolver Acao de Conversacao').parameters.jsCode;
assert.match(resolver, /consultar_localizacao_loja/);
assert.match(resolver, /deterministicStoreLocationV129 \|\|/);
assert.equal(connections['Switch Especialistas'].main.at(-1)[0].node, 'Loja - Buscar Dados Empresa');
assert.equal(connections['Loja - Localizacao'].main[0][0].node, 'Dividir mensagens');
assert.equal(connections['Dividir mensagens'].main[0][0].node, 'Controle Bot - Verificar mensagem atual');
assert.equal(connections['Controle Bot - Aplicar mensagem atual'].main[0][0].node, 'Controle Bot - Registrar Saida');
const splitter = nodes.find((node) => node.name === 'Dividir mensagens').parameters.jsCode;
assert.match(splitter, /inboundWaMessageId/);
assert.match(splitter, /\.\.\.parts, \.\.\.suffix/);
const contactResponse = nodes.find((node) => node.name === 'Contato - Resposta salvo').parameters.jsCode;
assert.doesNotMatch(contactResponse, /Mensagem parece nome/);
assert.match(contactResponse, /Contato - Preparar/);

console.log('n8n location and concurrent-message graph checks passed');
