'use strict';
// burst-dedupe-v1: duas execuções da mesma rajada não podem enviar a mesma lista duas vezes.
// Precisa do fluxo exportado: MDV_N8N_SALES_SNAPSHOT=<workflow.json> node --test tmp-tests/n8n-burst-dedupe.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchWorkflow, assertExpectedGraph, APPLY, CHECK, MARK } = require('../scripts/n8n-burst-dedupe.cjs');

const snapshotPath = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshotPath || !fs.existsSync(snapshotPath) ? 'sem MDV_N8N_SALES_SNAPSHOT' : false;

function load() {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const before = raw.nodes ? raw : raw.workflow;
  const after = patchWorkflow(before);
  return { before, after, code: after.nodes.find((n) => n.name === APPLY).parameters.jsCode };
}

function runApply(code, { item, rows, plan }) {
  const nodes = {
    'Loop - Enviar mensagens em ordem': { all: () => [{ json: item }] },
    'Dividir mensagens': { all: () => plan.map((json) => ({ json })) },
  };
  const ctx = {
    $input: { all: () => [{ json: { rows } }] },
    $: (name) => { if (nodes[name]) return nodes[name]; throw new Error(`no node ${name}`); },
  };
  return vm.runInNewContext(`(function(){${code}\n})()`, ctx);
}

const LIST = 'Segue a lista atualizada de celulares disponíveis. 📱[[BR]][[BR]]📱 Orçamento';
const XIAOMI = '🏷️ *Xiaomi / Redmi*[[BR]]4. Redmi 17 4G[[BR]]💰 R$ 1.000,00 à vista no PIX';
const msg1 = { direction: 'inbound', wa_message_id: 'ACFA1', message_text: 'Quero receber a lista atualizada de celulares.', created_at: '2026-11-26T16:17:26Z' };
const msg2 = { direction: 'inbound', wa_message_id: 'ACB55', message_text: 'Qual preço do celula', created_at: '2026-11-26T16:18:24Z' };
const out = (text, at) => ({ direction: 'outbound', message_text: text.replace(/\[\[BR\]\]/g, '\n'), source_node: 'Controle Bot - Registrar Saida', created_at: at });
const catalog = { conversationAction: 'listar_catalogo', conversation: 'Quero receber a lista atualizada de celulares.', catalogDeliveryCandidateV1: true };
const plan = (inbound) => [
  { ...catalog, message: 'Boa tarde, Wal! Tudo bem? 😊', messageIndex: 1, inboundWaMessageId: inbound },
  { ...catalog, message: LIST, messageIndex: 2, inboundWaMessageId: inbound },
  { ...catalog, message: XIAOMI, messageIndex: 3, inboundWaMessageId: inbound },
];

test('patch só troca o Aplicar e o limite da conferência', { skip }, () => {
  const { before, after } = load();
  assertExpectedGraph(before, after);
  const changed = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name).sort();
  assert.deepEqual(changed, [APPLY, CHECK].sort());
  assert.match(after.nodes.find((n) => n.name === CHECK).parameters.url, /limit=50/);
  assert.equal(JSON.stringify(patchWorkflow(after)), JSON.stringify(after), 'patch precisa ser idempotente');
  assert.ok(after.nodes.find((n) => n.name === APPLY).parameters.jsCode.includes(MARK));
});

test('incidente 26/11: a 2ª execução não reenvia a lista que a 1ª já entregou', { skip }, () => {
  const { code } = load();
  const rows = [msg1, msg2, out('Boa tarde, Wal! Tudo bem? 😊', '2026-11-26T16:18:44Z'), out(LIST, '2026-11-26T16:18:52Z'), out(XIAOMI, '2026-11-26T16:19:02Z')];
  const p = plan('ACB55').slice(1).map((m, i) => ({ ...m, messageIndex: i + 1 }));
  assert.deepEqual(runApply(code, { item: p[0], rows, plan: p }), [], 'lista repetida');
  assert.deepEqual(runApply(code, { item: p[1], rows, plan: p }), [], 'bloco Xiaomi repetido');
});

test('sem o patch, o fluxo atual reenviava (reproduz o bug)', { skip }, () => {
  const { before } = load();
  const code = before.nodes.find((n) => n.name === APPLY).parameters.jsCode;
  const rows = [msg1, msg2, out(LIST, '2026-11-26T16:18:52Z')];
  const p = plan('ACB55').slice(1).map((m, i) => ({ ...m, messageIndex: i + 1 }));
  assert.equal(runApply(code, { item: p[0], rows, plan: p }).length, 1);
});

test('a 1ª execução continua enviando o que ainda não saiu', { skip }, () => {
  const { code } = load();
  const rows = [msg1, msg2, out('Boa tarde, Wal! Tudo bem? 😊', '2026-11-26T16:18:44Z')];
  const p = plan('ACFA1');
  assert.equal(runApply(code, { item: p[1], rows, plan: p }).length, 1);
});

test('pedido repetido depois da nossa resposta recebe a lista de novo', { skip }, () => {
  const { code } = load();
  const msg3 = { direction: 'inbound', wa_message_id: 'ACC33', message_text: 'manda a lista de celulares de novo', created_at: '2026-11-26T16:23:00Z' };
  const rows = [msg1, out(LIST, '2026-11-26T16:18:52Z'), msg3];
  const p = plan('ACC33');
  assert.equal(runApply(code, { item: p[1], rows, plan: p }).length, 1);
});

test('mesma mensagem duas vezes no próprio plano não é confundida com outra execução', { skip }, () => {
  const { code } = load();
  const rows = [msg1, msg2, out(XIAOMI, '2026-11-26T16:19:02Z')];
  const p = [{ ...catalog, message: XIAOMI, messageIndex: 1, inboundWaMessageId: 'ACB55' }, { ...catalog, message: XIAOMI, messageIndex: 2, inboundWaMessageId: 'ACB55' }];
  assert.equal(runApply(code, { item: p[1], rows, plan: p }).length, 1);
});
