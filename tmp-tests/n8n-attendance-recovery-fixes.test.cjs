'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { patchWorkflow, SCOPED_NODES } = require('./n8n-attendance-recovery-fixes.cjs');
const file = process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT;
assert.ok(file, 'Provide read-only MDV_PAYJOY_WORKFLOW_SNAPSHOT');
const original = JSON.parse(fs.readFileSync(file, 'utf8'));
const updated = patchWorkflow(original);
const node = (w, name) => w.nodes.find(n => n.name === name);
const source = { remoteJid: 'synthetic@s.whatsapp.net', Instancia: 'synthetic', messageId: 'synthetic-id',
  conversation: 'sim', payjoyLinkContext: { ativo: true }, salesConversationState: { ativo: true, stage: 'awaiting_delivery_neighborhood' },
};
function run(w, payload, inbound = source) {
  const state = { salesPostList: { synthetic: { stage: 'awaiting_delivery_neighborhood' } } };
  const before = structuredClone(state);
  const result = new Function('$json', '$', '$getWorkflowStaticData', node(w, 'Parse Classificacao').parameters.jsCode)(
    payload, name => { assert.equal(name, 'Vendas - Preparar Contexto IA'); return { first: () => ({ json: inbound }) }; }, () => state,
  );
  assert.deepEqual(state, before);
  return result;
}
test('recovery patch is pure, scoped and idempotent', () => {
  const before = structuredClone(original);
  assert.deepEqual(patchWorkflow(updated), updated);
  assert.deepEqual(original, before);
  for (const n of original.nodes) if (!SCOPED_NODES.includes(n.name)) assert.deepEqual(node(updated, n.name), n);
  for (const [name, edges] of Object.entries(original.connections)) {
    if (name !== 'Parse Classificacao') assert.deepEqual(updated.connections[name], edges, name);
  }
  assert.equal(updated.nodes.length, original.nodes.length + (node(original, 'Classificacao - Falhou?') ? 0 : 1));
  assert.equal(node(updated, 'Agente Inicial - Classificador').onError, 'continueRegularOutput');
});
test('400, timeout, empty and malformed outputs yield one safe reply without accepting consent or consuming sale data', () => {
  for (const payload of [{ error: '400 synthetic' }, { error: { name: 'TimeoutError' } }, {}, { output: '' },
    { output: 'garbage' }, { output: 'null' }, { output: '[]' }, { output: '{}' }, { output: '{"intencao":"unrecognized"}' },
    { error: 'failure', output: JSON.stringify({ intencao: 'formas_pagamento', payjoy_link_reply: { decision: 'accept', confidence: 1 } }) },
  ]) {
    const items = run(updated, payload);
    assert.equal(items.length, 1);
    assert.equal(items[0].json.classifierRecovery, true);
    assert.match(items[0].json.output, /tentar novamente/);
    assert.doesNotMatch(items[0].json.output, /https?:|encaminh|aprov|pedido realizado/i);
    assert.deepEqual(items[0].json.salesConversationState, source.salesConversationState);
    assert.equal(items[0].json.payjoyLinkReply, undefined);
    assert.equal(items[0].json.remoteJid, source.remoteJid);
    assert.equal(items[0].json.messageId, source.messageId);
    assert.equal(items[0].json.error, undefined);
  }
});
test('successful classification preserves existing parser behavior', () => {
  for (const intent of ['vendas_produtos', 'fallback', 'formas_pagamento', 'pedido_humano']) {
    const payload = { output: JSON.stringify({ intencao: intent, mensagem: 'sim', confianca: 0.9, venda: {}, fluxo_venda: {} }) };
    assert.deepEqual(run(updated, payload), run(original, payload));
  }
});
test('recovery cannot respond to self messages or blocked conversations', () => {
  for (const inbound of [{ ...source, fromMe: true }, { ...source, n8nBotBlocked: true }]) {
    assert.deepEqual(run(updated, { error: 'synthetic' }, inbound), []);
  }
  for (const name of ['é minha mensagen', 'Controle Bot - Bloqueado?', 'Controle Bot - Pausa global?',
    'Controle Bot - Aplicar mensagem atual', 'Controle Bot - Verificar mensagem atual']) {
    assert.deepEqual(node(updated, name), node(original, name), name);
    assert.deepEqual(updated.connections[name], original.connections[name], name);
  }
});
test('failed path reuses one existing send loop and bypasses collection and inference', () => {
  const branch = node(updated, 'Classificacao - Falhou?');
  assert.equal(branch.type, 'n8n-nodes-base.if');
  assert.equal(branch.parameters.conditions.conditions[0].leftValue, '={{$json.classifierRecovery === true}}');
  assert.deepEqual(updated.connections[branch.name].main.map(group => group.map(x => x.node)),
    [['Dividir mensagens'], ['Vendas - Buscar Configuracoes Loja']]);
  assert.deepEqual(updated.connections['Dividir mensagens'], original.connections['Dividir mensagens']);
  assert.equal(updated.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest').length,
    original.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest').length);
});
test('recovery composes with the existing send path while unexecuted branch references throw', () => {
  const inbound = { ...source, messages: [{ text: 'stale output' }], specificProductBlueprintMedia: {
    type: 'image', mediaUrl: 'https://api.xiaomipetrolina.com.br/images/stale.jpg',
  }, phoneCatalogFollowupEligible: true, phoneCatalogFollowupToken: 'stale', payjoyFollowupKind: 'stale' };
  const recovery = run(updated, { error: 'synthetic' }, inbound)[0].json;
  const execute = (name, payload, lookup, items = [{ json: payload }], state = {}) =>
    new Function('$json', '$', '$input', '$getWorkflowStaticData', node(updated, name).parameters.jsCode)(
      payload, lookup, { all: () => items }, () => state,
    );
  const unavailable = name => { throw Error('Node never executed: ' + name); };
  const lookup = name => {
    if (['switc Mensagens', 'Contato - Resolver', 'Contato - Preparar'].includes(name)) return { first: () => ({ json: source }) };
    return unavailable(name);
  };
  const split = execute('Dividir mensagens', recovery, lookup);
  assert.equal(split.length, 1);
  assert.equal(split[0].json.messageType, 'text');
  assert.match(split[0].json.message, /tentar novamente/);
  assert.equal(split[0].json.phoneCatalogFollowupEligible, false);
  assert.equal(split[0].json.payjoyFollowupKind, '');
  const loop = name => name === 'Loop - Enviar mensagens em ordem'
    ? { all: () => split, first: () => split[0] } : unavailable(name);
  for (const [messageId, expected] of [['synthetic-id', 1], ['newer-inbound', 0]]) {
    const gate = execute('Controle Bot - Aplicar mensagem atual', {}, loop, [{ json: { rows: [
      { direction: 'inbound', wa_message_id: messageId, message_text: 'new synthetic message' },
    ] } }]);
    assert.equal(gate.length, expected, 'Existing stale-message gate preserved');
  }
  assert.deepEqual(execute('Controle Bot - Restaurar Saida', {}, loop), split);
  const sent = execute('Handoff - Registrar bot enviado', {}, unavailable, [{ json: { key: { id: 'synthetic-sent' } } }]);
  assert.equal(sent.length, 1);
  const accepted = execute('Envio - Restaurar item aceito', {}, loop)[0].json;
  assert.equal(accepted.evolutionAccepted, true);
  for (const name of ['Follow-up Lista - Ultimo bloco?', 'PayJoy - Agendar retorno?']) {
    const expression = node(updated, name).parameters.conditions.conditions[0].leftValue;
    assert.equal(Boolean(new Function('$json', 'return (' + expression.slice(3, -2) + ')')(accepted)), false, name);
  }
});
