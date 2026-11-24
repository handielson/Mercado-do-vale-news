'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { MARK, NODES, patchWorkflow } = require('../scripts/n8n-bot-handoff-announce.cjs');

const file = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !file || !fs.existsSync(file) ? 'MDV_N8N_SALES_SNAPSHOT ausente' : false;
const load = () => { const raw = JSON.parse(fs.readFileSync(file, 'utf8')); return raw.workflow || raw; };
const code = (w, name) => w.nodes.find((n) => n.name === name).parameters.jsCode;

// Runs a Code node body with minimal n8n globals.
const run = (src, { json, nodes = {}, staticData = {} }) => {
  const $ = (name) => {
    const v = nodes[name];
    if (!v) return { isExecuted: false, first: () => { throw Error('not executed'); }, all: () => [] };
    return { isExecuted: true, first: () => ({ json: v[0] }), all: () => v.map((j) => ({ json: j })) };
  };
  const input = { all: () => (Array.isArray(json) ? json : [json]).map((j) => ({ json: j })) };
  return new Function('$json', '$', '$input', '$getWorkflowStaticData', '$runIndex', src)(
    Array.isArray(json) ? json[0] : json, $, input, () => staticData, 0);
};

const HANDOFF = 'Entendi, Joseilson. Um atendente precisa conferir a simulação.';
const prepared = (extra = {}) => ({ remoteJid: '557488559887@s.whatsapp.net', conversation: 'Ela já fez a simulação na payjoy deu 1600 também',
  output: HANDOFF, humanHandoffPaused: true, handoffRequested: true, productSpecialistHandoffRequested: true,
  specialistHandoffBy: 'bot-handoff-request', n8nBotControl: {}, recentMessages: [], ...extra });
const persisted = (reason) => ({ control: { conversation_state: {}, conversation_state_revision: 12, human_handoff_active: true },
  conversationStateWrite: { applied: false, reason, currentEventVersion: 9e15 } });

test('patch muda só os 2 nós, é idempotente e compila', { skip }, () => {
  const before = load(), after = patchWorkflow(before);
  const changed = after.nodes.filter((n, i) => n.parameters?.jsCode !== before.nodes[i].parameters?.jsCode).map((n) => n.name);
  assert.deepEqual(changed.sort(), [...NODES].sort());
  assert.ok(!changed.includes('Vendas - Contexto Produtos'));
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(patchWorkflow(after), after);
  for (const n of NODES) { new Function(code(after, n)); assert.ok(code(after, n).includes(MARK)); }
});

for (const reason of ['revision_conflict', 'stale_or_duplicate_event']) {
  test(`incidente: ${reason} depois do handoff do bot — antes descartava, agora entrega o aviso`, { skip }, () => {
    const before = load(), after = patchWorkflow(before);
    const ctx = { json: persisted(reason), nodes: { 'Estado Conversa - Preparar': [prepared()] } };
    const old = run(code(before, 'Estado Conversa - Restaurar'), ctx);
    assert.ok(old.length === 0 || old[0].json.output === '', 'antes: aviso descartado');
    const out = run(code(after, 'Estado Conversa - Restaurar'), ctx);
    assert.equal(out.length, 1);
    assert.equal(out[0].json.output, HANDOFF);
    assert.equal(out[0].json.conversationStateRebase, false);
  });
}

test('sem handoff do bot, rebase e descarte continuam iguais', { skip }, () => {
  const before = load(), after = patchWorkflow(before);
  for (const extra of [{ productSpecialistHandoffRequested: false, handoffRequested: false, specialistHandoffBy: '' },
    { specialistHandoffBy: 'whatsapp-manual-handoff' }]) {
    for (const reason of ['revision_conflict', 'stale_or_duplicate_event']) {
      const ctx = () => ({ json: persisted(reason), nodes: { 'Estado Conversa - Preparar': [prepared(extra)] } });
      assert.deepEqual(run(code(after, 'Estado Conversa - Restaurar'), ctx()), run(code(before, 'Estado Conversa - Restaurar'), ctx()));
    }
  }
  const ctx = () => ({ json: { control: { conversation_state: {}, conversation_state_revision: 12, blocked: true },
    conversationStateWrite: { applied: false, reason: 'stale_or_duplicate_event' } }, nodes: { 'Estado Conversa - Preparar': [prepared()] } });
  assert.deepEqual(run(code(after, 'Estado Conversa - Restaurar'), ctx()), [], 'bloqueado continua sem resposta');
});

const rows = (extra = []) => ({ rows: [
  { direction: 'inbound', wa_message_id: 'A1', message_text: 'Ela já fez a simulação', created_at: '2026-11-24T18:40:00Z' },
  { direction: 'inbound', wa_message_id: 'A2', message_text: 'Vou manda o print aqui', created_at: '2026-11-24T18:41:00Z' }, ...extra] });
const item = { inboundWaMessageId: 'A1', conversation: 'Ela já fez a simulação', message: HANDOFF, messageType: 'text' };

test('envio: aviso de handoff do bot sai mesmo com mensagem nova; resposta comum segue descartada', { skip }, () => {
  const before = load(), after = patchWorkflow(before);
  const src = (w) => code(w, 'Controle Bot - Aplicar mensagem atual');
  const handoffRun = { 'Loop - Enviar mensagens em ordem': [item], 'Vendas - Retomar Resposta Especialista': [{ specialistHandoffBy: 'bot-handoff-request' }] };
  assert.equal(run(src(before), { json: [rows()], nodes: handoffRun }).length, 0, 'antes: aviso derrubado');
  assert.equal(run(src(after), { json: [rows()], nodes: handoffRun }).length, 1);
  const plain = { 'Loop - Enviar mensagens em ordem': [item] };
  assert.equal(run(src(after), { json: [rows()], nodes: plain }).length, 0);
  const team = rows([{ direction: 'outbound', source_node: 'whatsapp-manual-handoff', message_text: 'oi', created_at: '2026-11-24T18:42:00Z' }]);
  assert.equal(run(src(after), { json: [team], nodes: handoffRun }).length, 0, 'equipe já respondeu: bot não fala por cima');
});
