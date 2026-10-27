'use strict';

const assert = require('node:assert/strict');

const MARKER = 'payjoy-spaced-context-v1';
const SCOPED_NODES = ['Parse Classificacao', 'Resolver Acao de Conversacao', 'Pagamento - Politica'];

function replaceOnce(source, oldText, newText, label) {
  assert.equal(source.split(oldText).length - 1, 1, `${label}: anchor changed`);
  return source.replace(oldText, newText);
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = name => {
    const found = workflow.nodes.find(item => item.name === name);
    assert.ok(found, `Missing ${name}`);
    return found;
  };

  const parse = node('Parse Classificacao');
  if (!parse.parameters.jsCode.includes(`${MARKER}:parse`)) {
    parse.parameters.jsCode = replaceOnce(
      parse.parameters.jsCode,
      "const payjoyKnowledgeGrounded = /\\bpayjoy\\b/i.test(String(source.conversation || '')) || /\\bpayjoy\\b/i.test(String(payjoyLastOutbound?.text || ''));",
      `// ${MARKER}:parse
const payjoyMessagesV3937 = Array.isArray(source.recentMessages) ? source.recentMessages : [];
const payjoyCurrentTextV3937 = String(source.conversation || '').trim();
const payjoyCurrentIndexV3937 = payjoyMessagesV3937.findLastIndex(row => row.direction === 'inbound' && String(row.text || '').trim() === payjoyCurrentTextV3937);
const payjoyPreviousV3937 = payjoyCurrentIndexV3937 > 0 ? payjoyMessagesV3937[payjoyCurrentIndexV3937 - 1] : null;
const payjoyCurrentAtV3937 = Date.parse(payjoyMessagesV3937[payjoyCurrentIndexV3937]?.created_at || '');
const payjoyPreviousAtV3937 = Date.parse(payjoyPreviousV3937?.created_at || '');
const payjoyRecentTopicV3937 = payjoyPreviousV3937?.direction === 'inbound'
  && /^pay\\s*joy[?.!\\s]*$/i.test(String(payjoyPreviousV3937.text || ''))
  && Number.isFinite(payjoyCurrentAtV3937) && Number.isFinite(payjoyPreviousAtV3937)
  && payjoyCurrentAtV3937 >= payjoyPreviousAtV3937
  && payjoyCurrentAtV3937 - payjoyPreviousAtV3937 <= 2 * 60 * 1000;
const payjoyCurrentMentionV3937 = /\\bpay\\s*joy\\b/i.test(payjoyCurrentTextV3937);
const payjoyProcedureV3937 = /\\b(?:como\\s+(?:que\\s+)?(?:faz|faco|faço)|onde\\s+(?:faco|faço|faz|preencho)\\s+(?:a\\s+)?analise|qual\\s+(?:e\\s+)?(?:o\\s+)?link\\s+(?:da\\s+)?(?:analise|pay\\s*joy))\\b/i.test(payjoyCurrentTextV3937);
const payjoyNegationV3937 = /\\b(?:nao\\s+quero|não\\s+quero|desisti|deixa\\s+pra\\s+la|deixa\\s+pra\\s+lá)\\b/i.test(payjoyCurrentTextV3937);
const payjoyStartAnalysisRequest = payjoyProcedureV3937 && !payjoyNegationV3937 && (payjoyCurrentMentionV3937 || payjoyRecentTopicV3937);
const payjoyKnowledgeGrounded = payjoyCurrentMentionV3937 || payjoyRecentTopicV3937 || /\\bpay\\s*joy\\b/i.test(String(payjoyLastOutbound?.text || ''));`,
      'PayJoy context grounding',
    );
    parse.parameters.jsCode = replaceOnce(parse.parameters.jsCode, '    payjoyKnowledgeQuestion,\n    payjoyLinkReply,', '    payjoyKnowledgeQuestion,\n    payjoyStartAnalysisRequest,\n    payjoyLinkReply,', 'PayJoy parse output');
  }

  const resolver = node('Resolver Acao de Conversacao');
  if (!resolver.parameters.jsCode.includes(`${MARKER}:resolver`)) {
    resolver.parameters.jsCode = replaceOnce(
      resolver.parameters.jsCode,
      'const payjoyKnowledgeDecision = $json.payjoyKnowledgeQuestion === true',
      `// ${MARKER}:resolver
const payjoyStartDecisionV3937 = $json.payjoyStartAnalysisRequest === true && !payjoyHumanV1 && !payjoyDeclineV3 && !payjoyOutcomeV1
  ? { acao: 'responder_politica_pagamento', intencao: 'payjoy', confianca: 1, motivo: 'Cliente pediu como iniciar a analise PayJoy no contexto imediato.' } : null;
const payjoyKnowledgeDecision = $json.payjoyKnowledgeQuestion === true`,
      'PayJoy start route',
    );
    resolver.parameters.jsCode = replaceOnce(
      resolver.parameters.jsCode,
      'collectionProductDecisionV1 || collectionQuestionDecisionV1 || payjoyKnowledgeDecision || payjoyQuestionV5',
      'payjoyStartDecisionV3937 || collectionProductDecisionV1 || collectionQuestionDecisionV1 || payjoyKnowledgeDecision || payjoyQuestionV5',
      'PayJoy route priority',
    );
  }

  const payment = node('Pagamento - Politica');
  if (!payment.parameters.jsCode.includes(`${MARKER}:payment`)) {
    payment.parameters.jsCode = replaceOnce(
      payment.parameters.jsCode,
      'const payjoyPendingLinkV1 = payjoyAcceptV5 && !payjoyDeclineV3 && !approved && !denied || payjoyAnalysisContinuationV3;',
      `// ${MARKER}:payment
const payjoyStartAnalysisRequestV3937 = source.payjoyStartAnalysisRequest === true && !payjoyDeclineV3 && !approved && !denied;
const payjoyPendingLinkV1 = payjoyStartAnalysisRequestV3937 || payjoyAcceptV5 && !payjoyDeclineV3 && !approved && !denied || payjoyAnalysisContinuationV3;`,
      'PayJoy official-link reuse',
    );
  }

  for (const name of SCOPED_NODES) new Function('$json', '$', '$getWorkflowStaticData', node(name).parameters.jsCode);
  assert.deepEqual(workflow.connections, input.connections);
  return workflow;
}

module.exports = { MARKER, SCOPED_NODES, patchWorkflow };
