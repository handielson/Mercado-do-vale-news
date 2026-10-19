'use strict';
const assert = require('node:assert/strict');
const AGENT = 'Agente Inicial - Classificador';
const PARSER = 'Parse Classificacao';
const BRANCH = 'Classificacao - Falhou?';
const SCOPED_NODES = [AGENT, PARSER, BRANCH];
const MARKER = '// attendance-classifier-recovery-v1';
const PARSE_BLOCK = String.raw`// attendance-classifier-recovery-v1
let parsed;
try {
  parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60\s*$/i, '').trim()) : raw;
} catch (_) {}
const classifierIntentsV1 = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano',
  'formas_pagamento', 'entrega_frete', 'horario_loja', 'fallback', 'localizacao_loja', 'compra_generica']);
const classifierFailureV1 = Boolean($json.error) || !parsed || typeof parsed !== 'object'
  || Array.isArray(parsed) || !classifierIntentsV1.has(String(parsed.intencao || '').trim());
if (classifierFailureV1) {
  // Retain the inbound context, but never consume collection fields, grant link consent,
  // create a purchase or invent a human handoff when classification is unavailable.
  if (source.fromMe === true || source.n8nBotBlocked === true) return [];
  return [{ json: {
    ...source,
    classifierRecovery: true,
    messages: undefined,
    specificProductBlueprintMedia: undefined,
    phoneCatalogFollowupEligible: false,
    phoneCatalogFollowupToken: '',
    payjoyFollowupKind: '',
    replyToWaMessageId: '',
    replyToText: '',
    output: 'Não consegui processar sua mensagem agora. Pode tentar novamente em instantes? 😊',
  } }];
}

`;
const edge = node => ({ node, type: 'main', index: 0 });
function get(w, name) {
  const found = w.nodes.filter(n => n.name === name);
  assert.equal(found.length, 1, 'Missing or ambiguous node: ' + name);
  return found[0];
}
function patchWorkflow(input) {
  const w = structuredClone(input);
  const agent = get(w, AGENT), parser = get(w, PARSER);
  assert.equal(agent.type, '@n8n/n8n-nodes-langchain.agent');
  assert.equal(parser.type, 'n8n-nodes-base.code');
  agent.onError = 'continueRegularOutput';
  let code = parser.parameters.jsCode;
  if (!code.includes(MARKER)) {
    const start = code.indexOf('let parsed;');
    const end = code.indexOf('// payjoy-contextual-intent-v5:parse');
    assert.ok(start >= 0 && end > start, 'Classifier parser boundary drift');
    assert.match(code.slice(start, end), /catch \(error\)/);
    code = code.slice(0, start) + PARSE_BLOCK + code.slice(end);
  } else assert.ok(code.includes(PARSE_BLOCK), 'Classifier recovery implementation drift');
  parser.parameters.jsCode = code;
  const expectedOld = { main: [[edge('Vendas - Buscar Configuracoes Loja')]] };
  const expectedNew = { main: [[edge(BRANCH)]] };
  assert.ok(JSON.stringify(w.connections[PARSER]) === JSON.stringify(expectedOld)
    || JSON.stringify(w.connections[PARSER]) === JSON.stringify(expectedNew), 'Classifier connections drift');
  const branch = {
    id: 'attendance-classifier-recovery-v1-if', name: BRANCH,
    type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1824, 384],
    notes: 'Falhas e respostas inválidas do classificador recebem uma resposta segura pelo envio existente, sem consumir o estado de venda.',
    parameters: { options: {}, conditions: {
      options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'strict' },
      combinator: 'and', conditions: [{ id: 'attendance-classifier-recovery-v1-condition',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
        leftValue: '={{$json.classifierRecovery === true}}', rightValue: true,
      }],
    } },
  };
  const oldBranch = w.nodes.find(n => n.name === BRANCH || n.id === branch.id);
  if (oldBranch) assert.deepEqual(oldBranch, branch, 'Recovery branch drift');
  else w.nodes.push(branch);
  w.connections[PARSER] = expectedNew;
  const branchEdges = { main: [[edge('Dividir mensagens')], [edge('Vendas - Buscar Configuracoes Loja')]] };
  if (w.connections[BRANCH]) assert.deepEqual(w.connections[BRANCH], branchEdges);
  w.connections[BRANCH] = branchEdges;
  return w;
}
module.exports = { patchWorkflow, SCOPED_NODES, MARKER };
