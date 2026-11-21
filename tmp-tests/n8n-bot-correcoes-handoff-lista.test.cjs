'use strict';
// Teste das correções do bot (scripts/n8n-bot-correcoes-handoff-lista.cjs) contra a cópia exata do fluxo ativo
// (MDV_N8N_SALES_SNAPSHOT = JSON com nodes e connections).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, FETCH_SHIM, MARK } = require('../scripts/n8n-bot-correcoes-handoff-lista.cjs');

const snapshot = JSON.parse(fs.readFileSync(process.env.MDV_N8N_SALES_SNAPSHOT, 'utf8'));
const after = patchWorkflow(snapshot);
const code = name => after.nodes.find(n => n.name === name).parameters;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
// Como no executor do n8n: sem fetch global.
const run = (jsCode, env) => new AsyncFunction('$input', '$', '$json', '$getWorkflowStaticData', '$runIndex', 'helpers', 'fetch', jsCode)(
  env.$input, env.$, env.$json, env.$getWorkflowStaticData || (() => ({})), 0, env.helpers, undefined);

test('fetch do executor: helpers.httpRequest com resposta em objeto ou texto, status de erro sem exceção', async () => {
  const chamadas = [];
  const helpers = { httpRequest: async opts => { chamadas.push(opts); return opts.url.includes('erro') ? { statusCode: 503, body: 'fora' } : opts.url.includes('txt') ? { statusCode: 200, body: '{"b":2}' } : { statusCode: 200, body: [{ a: 1 }] }; } };
  const r = await run(FETCH_SHIM + "const a = await mdvFetchV1('https://x/brands', { headers: { A: '1' } }); const b = await mdvFetchV1('https://x/txt'); const c = await mdvFetchV1('https://x/erro');"
    + 'return [a.ok, await a.json(), b.ok, await b.json(), c.ok, c.status];', { helpers });
  assert.deepEqual(r, [true, [{ a: 1 }], true, { b: 2 }, false, 503]);
  assert.equal(chamadas[0].returnFullResponse, true); assert.equal(chamadas[0].ignoreHttpStatusErrors, true); assert.deepEqual(chamadas[0].headers, { A: '1' });
  for (const n of ['Vendas - Verificar Pos Lista', 'Vendas - Preparar Contexto IA', 'Loja - Horario Atendimento']) assert.ok(code(n).jsCode.startsWith(FETCH_SHIM), n);
});

const T = s => new Date(Date.parse('2026-11-21T13:42:34Z') + s * 1000).toISOString();
function enviar(rows, original) {
  const item = { json: { inboundWaMessageId: 'W1', conversation: 'Boot ajuda na venda', conversationAction: 'conversa', ...original } };
  return run(code('Controle Bot - Aplicar mensagem atual').jsCode, { $input: { all: () => [{ json: { rows } }] }, $: () => ({ all: () => [item] }) });
}
const inbound = (id, s, text) => ({ direction: 'inbound', wa_message_id: id, created_at: T(s), message_text: text, source_node: 'Controle Bot - Registrar Entrada' });
const humano = (s, text) => ({ direction: 'outbound', wa_message_id: null, created_at: T(s), message_text: text, source_node: 'whatsapp-manual-handoff' });

test('equipe respondeu depois da pergunta do cliente: a resposta do bot não sai (caso do Eder)', async () => {
  assert.equal((await enviar([inbound('W1', 0, 'Boot ajuda na venda'), humano(17, 'Bom dia'), humano(61, 'De garantia')])).length, 0);
  assert.equal((await enviar([humano(-60, 'Bom dia'), inbound('W1', 0, 'Boot ajuda na venda')])).length, 1, 'mensagem da equipe antes da pergunta não bloqueia');
  assert.equal((await enviar([inbound('W1', 0, 'Boot ajuda na venda')])).length, 1);
});

test('cumprimento ou confirmação depois do pedido não derruba a resposta; pedido novo de outro assunto ainda derruba', async () => {
  const lista = { conversation: 'Quero receber a lista atualizada de celulares.', conversationAction: 'listar_catalogo' };
  for (const t of ['Bom dia', 'blz', 'Ok!', 'boa tarde', 'Obrigado']) assert.equal((await enviar([inbound('W1', 0, lista.conversation), inbound('W2', 19, t)], lista)).length, 1, t);
  assert.equal((await enviar([inbound('W1', 0, 'qual o horário?'), inbound('W2', 19, 'quero uma capinha azul')], { conversation: 'qual o horário?' })).length, 0);
});

function restaurar(write, prepared) {
  const control = { conversation_state_revision: 1, conversation_state: {}, blocked: 0 };
  return run(code('Estado Conversa - Restaurar').jsCode, { $json: { control, conversationStateWrite: write },
    $: () => ({ first: () => ({ json: { remoteJid: '558788099550@s.whatsapp.net', conversation: 'Quero receber a lista', ...prepared } }) }) });
}

test('lista montada enquanto chegava outra mensagem: entrega a lista; evento repetido ou outra resposta: não (caso do Marcelo)', async () => {
  const lista = { conversationAction: 'listar_catalogo', output: 'Segue a lista atualizada', conversationEventVersion: 848 };
  const r = await restaurar({ applied: false, reason: 'stale_or_duplicate_event', currentEventVersion: 850 }, lista);
  assert.equal(r.length, 1); assert.equal(r[0].json.catalogDeliveredAfterStaleV1, true); assert.equal(r[0].json.output, 'Segue a lista atualizada');
  assert.equal((await restaurar({ applied: false, reason: 'stale_or_duplicate_event', currentEventVersion: 848 }, lista)).length, 0, 'mesmo evento repetido');
  assert.equal((await restaurar({ applied: false, reason: 'stale_or_duplicate_event', currentEventVersion: 850 }, { ...lista, conversationAction: 'conversa', deterministicCatalogOutput: '' })).length, 0);
});

test('agente geral não promete envio futuro', () => {
  const p = code('Agente Geral - Atendimento').options.systemMessage;
  assert.ok(!p.includes('avise brevemente que vai atualizar as opcoes e enviar em seguida'));
  assert.ok(p.includes('Nunca prometa enviar algo depois') && p.includes(MARK));
});

test('reaplicar não muda nada e só os seis nós mudam', () => {
  assert.equal(JSON.stringify(patchWorkflow(after)), JSON.stringify(after));
  const mudou = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(snapshot.nodes[i])).map(n => n.name).sort();
  assert.equal(mudou.length, 6);
  assert.deepEqual(after.connections, snapshot.connections);
});
