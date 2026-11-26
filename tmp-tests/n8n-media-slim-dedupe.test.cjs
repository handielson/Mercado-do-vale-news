'use strict';
// media-response-slim-v1 + recent-dup-v2 (conversa 558781242854, 26/11).
// MDV_N8N_SALES_SNAPSHOT=<workflow.json> node --test tmp-tests/n8n-media-slim-dedupe.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchWorkflow, assertExpectedGraph, APPLY, SLIM, SEND, HANDOFF, MARK_DUP } = require('../scripts/n8n-media-slim-dedupe.cjs');

const snapshotPath = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshotPath || !fs.existsSync(snapshotPath) ? 'sem MDV_N8N_SALES_SNAPSHOT' : false;
const load = () => {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const before = raw.nodes ? raw : raw.workflow;
  const after = patchWorkflow(before);
  return { before, after, code: after.nodes.find((n) => n.name === APPLY).parameters.jsCode };
};
function runApply(code, { item, rows, plan }) {
  const nodes = { 'Loop - Enviar mensagens em ordem': { all: () => [{ json: item }] }, 'Dividir mensagens': { all: () => plan.map((json) => ({ json })) } };
  const ctx = { $input: { all: () => [{ json: { rows } }] }, $: (name) => { if (nodes[name]) return nodes[name]; throw new Error(`no node ${name}`); } };
  return vm.runInNewContext(`(function(){${code}\n})()`, ctx);
}
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const LIST = '🏷️ *Xiaomi / Redmi*[[BR]]10. Redmi Note 17[[BR]]💰 R$ 1.385,00 à vista no PIX';
const catalog = { conversationAction: 'listar_catalogo', conversation: 'Quanto tem de ram', catalogDeliveryCandidateV1: true };
const inb = (id, text, at) => ({ direction: 'inbound', wa_message_id: id, message_text: text, created_at: at });
const out = (text, at) => ({ direction: 'outbound', message_text: text.replace(/\[\[BR\]\]/g, '\n'), source_node: 'Controle Bot - Registrar Saida', created_at: at });

test('grafo: só insere o resumo entre Enviar Imagem e Handoff; idempotente', { skip }, () => {
  const { before, after } = load();
  assertExpectedGraph(before, after);
  const changed = after.nodes.slice(0, before.nodes.length).filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name);
  assert.deepEqual(changed, [APPLY]);
  assert.equal(JSON.stringify(patchWorkflow(after)), JSON.stringify(after));
  const slim = after.nodes.find((n) => n.name === SLIM);
  assert.equal(slim.type, 'n8n-nodes-base.set', 'precisa rodar fora do runner de JavaScript');
  assert.equal(slim.parameters.includeOtherFields, false, 'não pode carregar o base64 da Evolution');
  assert.deepEqual(after.connections[SEND].main[0].map((c) => c.node), [SLIM]);
  assert.deepEqual(after.connections[SLIM].main[0].map((c) => c.node), [HANDOFF]);
  const handoff = after.nodes.find((n) => n.name === HANDOFF).parameters.jsCode;
  assert.match(handoff, /json\.key\?\.id/, 'Handoff continua lendo key.id, que o resumo mantém');
  assert.ok(slim.parameters.assignments.assignments.some((a) => a.name === 'key' && /\$json\.key\?\.id/.test(a.value)));
});

test('incidente 26/11 15h: lista já enviada por outra execução há 2 min não sai de novo, mesmo com resposta no meio', { skip }, () => {
  const { code, before } = load();
  const rows = [inb('A1', 'Aí não é o pro', ago(4)), out('Nao encontrei esse modelo no estoque atual.', ago(3.5)),
    inb('B1', 'Quanto tem de ram', ago(3)), out(LIST, ago(2))];
  const plan = [{ ...catalog, message: LIST, messageIndex: 1, inboundWaMessageId: 'B1' }];
  const oldCode = before.nodes.find((n) => n.name === APPLY).parameters.jsCode;
  assert.equal(runApply(oldCode, { item: plan[0], rows, plan }).length, 1, 'fluxo antigo reenviava');
  assert.deepEqual(runApply(code, { item: plan[0], rows, plan }), []);
});

test('mesma lista enviada há mais de 5 min pode sair de novo', { skip }, () => {
  const { code } = load();
  const rows = [out(LIST, ago(12)), inb('C1', 'manda a lista de celulares de novo', ago(1))];
  const plan = [{ ...catalog, conversation: 'manda a lista de celulares de novo', message: LIST, messageIndex: 1, inboundWaMessageId: 'C1' }];
  assert.equal(runApply(code, { item: plan[0], rows, plan }).length, 1);
});

test('texto curto e repetição do próprio plano não são bloqueados', { skip }, () => {
  const { code } = load();
  const rows = [inb('D1', 'lista de celulares', ago(2)), out('Oi! 😊', ago(1.5)), out(LIST, ago(1))];
  const plan = [{ ...catalog, message: 'Oi! 😊', messageIndex: 1, inboundWaMessageId: 'D1' }, { ...catalog, message: LIST, messageIndex: 2, inboundWaMessageId: 'D1' }, { ...catalog, message: LIST, messageIndex: 3, inboundWaMessageId: 'D1' }];
  assert.equal(runApply(code, { item: plan[0], rows, plan }).length, 1, 'texto curto');
  assert.equal(runApply(code, { item: plan[2], rows, plan }).length, 1, 'segunda cópia do próprio plano');
  assert.ok(code.includes(MARK_DUP));
});
