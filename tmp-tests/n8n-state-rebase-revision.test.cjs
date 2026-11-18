'use strict';
// conversation-state-rebase-revision-v1 (18/11/2026): na retentativa depois de conflito de revisão, o
// "Estado Conversa - Preparar" grava contra a revisão nova, mesmo quando o especialista (ex.: Loja) devolve
// os dados reconstruídos do "Parse Classificacao" com a revisão velha. Antes, as 3 tentativas pediam a
// revisão antiga e a resposta ("Onde fica sua loja") era descartada sem enviar nada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, NODE } = require('../scripts/n8n-state-rebase-revision.cjs');

const file = process.env.MDV_N8N_SALES_SNAPSHOT;
assert.ok(file && fs.existsSync(file), 'MDV_N8N_SALES_SNAPSHOT deve apontar para o workflow exportado');
const before = JSON.parse(fs.readFileSync(file, 'utf8'));
const after = patchWorkflow(before);

const JID = '557400000000@s.whatsapp.net';
const parse = { remoteJid: JID, conversation: 'Onde fica sua loja', conversationStateRevision: 3, conversationEventVersion: 2,
  n8nBotControl: { conversation_state_revision: 3 } };
const control = { remoteJid: JID, conversationStateRevision: 3, n8nBotControl: { conversation_state_revision: 3 } };

function prepare(workflow, { posList, json, runIndex }) {
  const code = workflow.nodes.find(n => n.name === NODE).parameters.jsCode;
  const nodes = { 'Vendas - Verificar Pos Lista': posList, 'Parse Classificacao': parse, 'Controle Bot - Aplicar Controle': control };
  const $ = name => ({ first: () => ({ json: nodes[name] }) });
  const run = new Function('$', '$json', '$runIndex', '$getWorkflowStaticData', code);
  const [{ json: out }] = run($, json, runIndex, () => ({}));
  return out;
}

// Loja - Localizacao devolve {...Parse Classificacao, messages, output}: revisão 3 (velha).
const lojaOutput = { ...parse, output: '📍 Nosso endereço: ...' };
const replay = { ...parse, conversationStateRevision: 4, conversationStateRetryCount: 1, conversationStateRebase: true,
  n8nBotControl: { conversation_state_revision: 4 } };

test('retentativa grava contra a revisão nova mesmo com especialista devolvendo a velha', () => {
  const out = prepare(after, { posList: replay, json: lojaOutput, runIndex: 1 });
  assert.equal(out.conversationStatePersistRequest.expectedRevision, 4);
  assert.equal(out.conversationStateRetryCount, 1);
  assert.equal(out.conversationStateRebase, true);
  assert.equal(out.output, lojaOutput.output);
});

test('o fluxo antigo reproduz o defeito (pedia a revisão 3)', () => {
  const out = prepare(before, { posList: replay, json: lojaOutput, runIndex: 1 });
  assert.equal(out.conversationStatePersistRequest.expectedRevision, 3);
});

test('primeira tentativa continua usando a revisão da própria mensagem', () => {
  const out = prepare(after, { posList: parse, json: lojaOutput, runIndex: 0 });
  assert.equal(out.conversationStatePersistRequest.expectedRevision, 3);
  assert.equal(out.conversationStateRebase, undefined);
});

test('especialista que devolve só o texto (Agente Geral) segue igual', () => {
  const out = prepare(after, { posList: replay, json: { output: 'Oi!' }, runIndex: 1 });
  assert.equal(out.conversationStatePersistRequest.expectedRevision, 4);
  assert.equal(out.output, 'Oi!');
});

test('patch muda só o Preparar, sem mexer no grafo, e é idempotente', () => {
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(patchWorkflow(after), after);
  const changed = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map(n => n.name);
  assert.ok(changed.length === 0 || (changed.length === 1 && changed[0] === NODE), changed.join(','));
});
