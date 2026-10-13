const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow } = require('./n8n-payjoy-knowledge-patch.cjs');
assert(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT, 'Provide read-only workflow snapshot');
const original = JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT, 'utf8'));
const updated = patchWorkflow(original);
const code = name => updated.nodes.find(n => n.name === name).parameters.jsCode;
const jid = 'fixture@s.whatsapp.net';
const state = () => ({ payjoyByJid: { [jid]: { status: 'awaiting_result', updatedAt: Date.now(), expiresAt: Date.now() + 86400000 } } });
const source = { remoteJid: jid, conversation: 'isso é oq', recentMessages: [{direction:'outbound', text:'Faça a análise diretamente com a PayJoy pelo link oficial.'}], conversationHistory: 'Loja: Faça a análise diretamente com a PayJoy pelo link oficial.' };
const parse = (question, src = source) => new Function('$json', '$', code('Parse Classificacao'))(
  { output: JSON.stringify({ intencao: 'formas_pagamento', payjoy_knowledge_question: question }) },
  () => ({ first: () => ({ json: src }) }),
)[0].json;
const route = (src, store = state()) => new Function('$json', '$', '$getWorkflowStaticData', code('Resolver Acao de Conversacao'))(
  src, () => ({ first: () => ({ json: src }) }), () => store,
)[0].json;

test('dúvida depois do link alcança IA geral sem reiniciar a política nem mudar o estado', () => {
  for (const conversation of ['isso é oq', 'como funciona', 'como faz', 'o que preciso fazer']) {
    const store = state();
    const before = structuredClone(store);
    const result = route(parse({ isQuestion: true, confidence: 0.98 }, {...source, conversation}), store);
    assert.equal(result.conversationAction, 'perguntar_esclarecimento', conversation);
    assert.equal(result.conversationIntent, 'payjoy_duvida', conversation);
    assert.match(result.aiResponseGuidance, /link já foi enviado/);
    assert.deepEqual(store.payjoyByJid, before.payjoyByJid);
  }
  assert(updated.connections['Switch Especialistas'].main[11].some(edge => edge.node === 'Agente Geral - Atendimento'));
});

test('saída inválida e baixa confiança não desviam a rota', () => {
  for (const value of [null, { isQuestion: 'true', confidence: 1 }, { isQuestion: true, confidence: '1' }, { isQuestion: true, confidence: 0.79 }, { isQuestion: true, confidence: 2 }]) {
    const parsed = parse(value);
    assert.equal(parsed.payjoyKnowledgeQuestion, false);
    assert.notEqual(route(parsed).conversationIntent, 'payjoy_duvida');
  }
});

test('uma pergunta vaga em outro assunto não vira PayJoy mesmo se o modelo errar', () => {
  const result = parse({ isQuestion: true, confidence: 0.99 }, { ...source, recentMessages: [...source.recentMessages, { direction:'outbound', text:'Este é um carregador de 30W.' }] });
  assert.equal(result.payjoyKnowledgeQuestion, false);
  assert.equal(parse({isQuestion:true, confidence:0.99}, {...source, recentMessages:[]}).payjoyKnowledgeQuestion, false);
});

test('aprovação, cálculo, pedido humano e reenvio continuam nas rotas existentes', () => {
  for (const [text, extra] of [
    ['Fui aprovada', {}], ['Fui reprovada', {}],
    ['Quero falar com atendente', { intencao: 'pedido_humano' }],
    ['Manda o link da PayJoy novamente', {}],
    ['Valor aprovado 1600 com 14% de entrada', {}],
  ]) {
    const store = state(), src = { ...source, conversation: text, ...extra };
    const expected = new Function('$json', '$', '$getWorkflowStaticData', original.nodes.find(n => n.name === 'Resolver Acao de Conversacao').parameters.jsCode)(src, () => ({ first: () => ({ json: src }) }), () => structuredClone(store))[0].json;
    const result = route({ ...src, payjoyKnowledgeQuestion: true }, store);
    assert.equal(result.conversationAction, expected.conversationAction, text);
  }
});

test('patch preserva grafo, pagamentos, prints e nós alheios, e pode ser reaplicado', () => {
  const scope = new Set(['Agente Inicial - Classificador', 'Agente Geral - Atendimento', 'Parse Classificacao', 'Resolver Acao de Conversacao', 'Pagamento - Politica']);
  for (const n of original.nodes) if (!scope.has(n.name)) assert.deepEqual(updated.nodes.find(x => x.id === n.id), n);
  assert.deepEqual(updated.connections, original.connections);
  assert.deepEqual(patchWorkflow(updated), updated);
  assert.doesNotMatch(updated.nodes.find(n => n.name === 'Agente Geral - Atendimento').parameters.options.systemMessage, /ANALISE DIRETAMENTE COM A FINANCEIRA/);
});

test('lista de pagamentos mantém oferta pendente e só oferece o link da análise', () => {
  const store = {};
  const result = new Function('$json', '$', '$getWorkflowStaticData', code('Pagamento - Politica'))(
    {payjoy_analysis_url:'https://app.payjoy.com/br/d2c?fixture=1'},
    () => ({first:() => ({json:{remoteJid:jid, conversation:'Quais formas de pagamento?'}})}),
    () => store,
  )[0].json;
  const {paymentMethodsMessage} = require('../services/payjoyKnowledge.cjs');
  assert.equal(result.output, paymentMethodsMessage);
  assert.equal(store.payjoyByJid[jid].status, 'awaiting_link_confirmation');
  assert.equal(result.payjoyFollowupKind, '');
  assert.doesNotMatch(result.output, /https?:\/\//);
});
