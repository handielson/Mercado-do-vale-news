// payjoy-link-delivered-v1: link da PayJoy "enviado" só se saiu de verdade.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-payjoy-link-delivered.cjs');
const burst = require('../scripts/n8n-burst-merge.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const JID = '5587999990000@s.whatsapp.net';
const greeting = require('../scripts/n8n-greeting-courtesy.cjs');
const base = () => {
  let w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  if (!JSON.stringify(w).includes(greeting.MARK)) w = greeting.patchWorkflow(w);
  return w;
};
const load = () => {
  let w = base();
  if (!w.nodes.some((n) => n.name === burst.MERGE)) w = burst.patchWorkflow(w);
  return m.patchWorkflow(w);
};
const code = (w, name) => w.nodes.find((n) => n.name === name).parameters.jsCode;
const offer = { role: 'Loja', direction: 'outbound', text: 'A aprovação e as condições dependem da análise de crédito da PayJoy. Quer que eu envie o link para você fazer a análise?' };
const linkMsg = { role: 'Loja', direction: 'outbound', text: 'https://app.payjoy.com/br/d2c?utm_source=payjoysite' };
const state = (minAgo, extra = {}) => ({ status: 'awaiting_result', updatedAt: Date.now() - minAgo * 60000, expiresAt: Date.now() + 86400000, ...extra });

function runApply(w, payjoy, recentMessages) {
  const store = {};
  const nodes = { 'Controle Bot - Verificar Cliente': { remoteJid: JID, conversation: 'Envia aí.' } };
  const $ = (name) => { if (!nodes[name]) throw new Error('nó não executado'); return { first: () => ({ json: nodes[name] }) }; };
  const payload = { control: { conversation_state_revision: 2, conversation_state: { payjoyByJid: payjoy } }, recentMessages };
  const out = new Function('$', '$json', '$getWorkflowStaticData', '$execution', code(w, 'Controle Bot - Aplicar Controle'))($, payload, () => store, { id: '1' })[0].json;
  return { out, st: store.payjoyByJid?.[JID] };
}

test('Aplicar Controle: awaiting_result recente sem link no histórico volta a esperar o aceite do link', { skip }, () => {
  const w = load();
  const r = runApply(w, state(1), [offer, { role: 'Cliente', direction: 'inbound', text: 'Sim' }]);
  assert.equal(r.st.status, 'awaiting_link_confirmation');
  assert.equal(r.out.payjoyLinkNotDeliveredV1, true);
});

test('Aplicar Controle: com o link no histórico, antigo ou já com valores, não mexe', { skip }, () => {
  const w = load();
  assert.equal(runApply(w, state(1), [offer, linkMsg]).st.status, 'awaiting_result');
  assert.equal(runApply(w, state(180), [offer]).st.status, 'awaiting_result');
  assert.equal(runApply(w, state(1, { awaiting: 'entry_percent' }), [offer]).st.status, 'awaiting_result');
  assert.equal(runApply(w, { status: 'approved', updatedAt: Date.now(), expiresAt: Date.now() + 86400000 }, [offer]).st.status, 'approved');
});

function runRestore(w, conversation, recentMessages) {
  const store = {};
  const prepared = { remoteJid: JID, conversation, recentMessages, conversationStateRetryCount: 0, n8nBotControl: {} };
  const $ = (name) => ({ first: () => ({ json: name === 'Estado Conversa - Preparar' ? prepared : {} }) });
  const persisted = { control: { conversation_state_revision: 2, conversation_state: { payjoyByJid: state(0.5) } },
    conversationStateWrite: { applied: false, reason: 'revision_conflict', currentRevision: 2 } };
  const out = new Function('$', '$json', '$getWorkflowStaticData', '$runIndex', code(w, 'Estado Conversa - Restaurar'))($, persisted, () => store, 0);
  return { out, st: store.payjoyByJid?.[JID] };
}

test('caso real: "Envia aí." em conflito com a execução do "Sim" (link descartado) reenvia o link', { skip }, () => {
  const w = load();
  const r = runRestore(w, 'Envia aí.', [offer, { role: 'Cliente', direction: 'inbound', text: 'Sim' }]);
  assert.equal(r.out.length, 1);
  assert.equal(r.out[0].json.conversationStateRebase, true);
  assert.equal(r.st.status, 'awaiting_link_confirmation');
});

test('conflito com mensagem só de confirmação ("ok") mantém awaiting_result (a resposta anterior sai)', { skip }, () => {
  const w = load();
  assert.equal(runRestore(w, 'ok', [offer]).st.status, 'awaiting_result');
  assert.equal(runRestore(w, 'Envia aí.', [offer, linkMsg]).st.status, 'awaiting_result');
});

test('saudação: nome grudado longo fica de fora, nome normal continua', { skip }, () => {
  const w = load();
  const c = code(w, 'Dividir mensagens');
  assert.ok(c.includes(m.NAME_MARK));
  const run = (clienteNome) => {
    const nodes = { 'Controle Bot - Aplicar Controle': { recentMessages: [], conversation: 'Quero a lista' }, 'switc Mensagens': { remoteJid: JID } };
    const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
    return new Function('$', '$json', c)($, { clienteNome, output: 'Segue a lista.' })[0].json.message;
  };
  assert.match(run('Danielmoraismorais'), /^(Bom dia|Boa tarde|Boa noite)! Tudo bem\? 😊$/);
  assert.match(run('Marcelo Souza'), /^(Bom dia|Boa tarde|Boa noite), Marcelo! Tudo bem\? 😊$/);
});

test('patch idempotente e só nos 3 nós', { skip }, () => {
  const before = base();
  const after = m.patchWorkflow(before);
  assert.deepEqual(m.patchWorkflow(after), after);
  assert.deepEqual(after.connections, before.connections);
  const mudou = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name).sort();
  assert.deepEqual(mudou, [...m.NODES].sort());
});
