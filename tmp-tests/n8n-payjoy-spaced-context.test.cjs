'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, SCOPED_NODES } = require('./n8n-payjoy-spaced-context-patch.cjs');

const original = JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT || '.local/7047-active-workflow-private.json', 'utf8'));
const candidate = patchWorkflow(original);
const code = name => candidate.nodes.find(node => node.name === name).parameters.jsCode;
const jid = 'fixture@s.whatsapp.net';
const officialUrl = 'https://app.payjoy.com/br/d2c?fixture=spaced-context';
const at = '2026-10-27T20:21:30.000Z';
const message = (text, seconds = 0, direction = 'inbound') => ({
  direction, text, created_at: new Date(Date.parse(at) + seconds * 1000).toISOString(),
});

function run(text, recentMessages, { classifierQuestion = true, state = {}, url = officialUrl } = {}) {
  const source = { remoteJid: jid, conversation: text, incomingText: text, recentMessages, payjoyLinkContext: { ativo: false, referenciaDisponivel: false } };
  const classifier = { output: JSON.stringify({ intencao: 'fallback', mensagem: text, confianca: 0.9, payjoy_knowledge_question: { isQuestion: classifierQuestion, confidence: 0.98 }, payjoy_link_reply: { decision: 'other', confidence: 0.98 } }) };
  const parsed = new Function('$json', '$', code('Parse Classificacao'))(classifier, () => ({ first: () => ({ json: source }) }))[0].json;
  const resolved = new Function('$json', '$', '$getWorkflowStaticData', code('Resolver Acao de Conversacao'))(parsed, () => ({ first: () => ({ json: parsed }) }), () => state)[0].json;
  const payment = resolved.conversationAction === 'responder_politica_pagamento'
    ? new Function('$json', '$', '$getWorkflowStaticData', code('Pagamento - Politica'))({ payjoy_analysis_url: url }, () => ({ first: () => ({ json: resolved }) }), () => state)[0].json
    : null;
  return { parsed, resolved, payment, state };
}

test('Pay Joy seguido de Como que faz chega ao envio oficial e preserva o estado de acompanhamento', () => {
  const firstTurn = run('Pay Joy', [message('Oi', -4), message('Pay Joy', -4)]);
  assert.equal(firstTurn.parsed.payjoyStartAnalysisRequest, false);
  assert.equal(firstTurn.payment, null);
  const result = run('Como que faz', [message('Oi', -4), message('Pay Joy', -4), message('Como que faz')]);
  assert.equal(result.parsed.payjoyKnowledgeQuestion, true);
  assert.equal(result.parsed.payjoyStartAnalysisRequest, true);
  assert.equal(result.resolved.conversationAction, 'responder_politica_pagamento');
  assert.ok(result.payment.output.includes(officialUrl));
  assert.equal((result.payment.output.match(/https?:\/\/[^\s|]+/g) || []).length, 1);
  assert.equal(result.payment.payjoyFollowupKind, 'analysis_check');
  assert.equal(result.state.payjoyByJid[jid].status, 'awaiting_result');
  const split = new Function('$json', '$', candidate.nodes.find(node => node.name === 'Dividir mensagens').parameters.jsCode)(
    result.payment,
    () => ({ first: () => ({ json: result.resolved }) }),
  );
  assert.equal(split.filter(item => item.json.message.includes(officialUrl)).length, 1);
  assert.ok(split.every(item => item.json.remoteJid === jid));
});

test('pergunta explícita no mesmo turno também usa o link oficial; dúvida vaga isolada não usa', () => {
  const explicit = run('Pay Joy, como que faz?', [message('Pay Joy, como que faz?')]);
  assert.equal(explicit.parsed.payjoyStartAnalysisRequest, true);
  assert.ok(explicit.payment.output.includes(officialUrl));
  const isolated = run('Como que faz', [message('Como que faz')]);
  assert.equal(isolated.parsed.payjoyStartAnalysisRequest, false);
  assert.equal(isolated.payment, null);
  const explanation = run('Como funciona?', [message('Pay Joy', -4), message('Como funciona?')]);
  assert.equal(explanation.parsed.payjoyKnowledgeQuestion, true);
  assert.equal(explanation.parsed.payjoyStartAnalysisRequest, false);
  assert.equal(explanation.resolved.conversationIntent, 'payjoy_duvida');
  assert.equal(explanation.payment, null);
});

test('assunto interrompido, contexto antigo e recusa não enviam link', () => {
  for (const recent of [
    [message('Pay Joy', -4), message('Quero um carregador', -2), message('Como que faz')],
    [message('Pay Joy', -180), message('Como que faz')],
    [message('Pay Joy', -4), message('Não quero', -2, 'outbound'), message('Como que faz')],
  ]) {
    const result = run('Como que faz', recent);
    assert.equal(result.parsed.payjoyStartAnalysisRequest, false);
    assert.equal(result.payment, null);
  }
  const declined = run('Quero não', [message('Pay Joy', -4), message('Quero não')]);
  assert.equal(declined.parsed.payjoyStartAnalysisRequest, false);
  assert.equal(declined.payment, null);
});

test('link ausente ou não oficial exige conferência humana sem inventar URL', () => {
  for (const url of ['', 'https://payjoy.com.example.com/analysis']) {
    const result = run('Como que faz', [message('Pay Joy', -4), message('Como que faz')], { url });
    assert.equal(result.payment.payjoyNeedsHandoff, true);
    assert.doesNotMatch(result.payment.output, /https?:\/\//);
  }
});

test('patch é idempotente e preserva grafo e nós não relacionados', () => {
  assert.deepEqual(patchWorkflow(candidate), candidate);
  assert.deepEqual(candidate.connections, original.connections);
  assert.equal(candidate.nodes.length, original.nodes.length);
  for (const node of original.nodes) if (!SCOPED_NODES.includes(node.name)) assert.deepEqual(candidate.nodes.find(item => item.id === node.id), node);
});
