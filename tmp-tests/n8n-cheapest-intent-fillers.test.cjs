'use strict';
// Conversa real de 12/11/2026 (sem dados de cliente): "Qual celular mais em conta que você tem aí?" → "não consegui confirmar".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODES } = require('../scripts/n8n-cheapest-intent-fillers.cjs');

const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
assert.ok(snapshot, 'MDV_N8N_SALES_SNAPSHOT deve apontar para o workflow exportado');
const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const alreadyPatched = before.nodes.some((node) => node.parameters?.jsCode?.includes(MARK));
const after = patchWorkflow(before);
const jid = '5587990000000@s.whatsapp.net';

function run(workflow, name, input, sources = {}, state = {}, all = [input]) {
  const code = workflow.nodes.find((node) => node.name === name).parameters.jsCode;
  const lookup = (source) => {
    assert.ok(Object.hasOwn(sources, source), `upstream sem mock: ${source}`);
    const values = Array.isArray(sources[source]) ? sources[source] : [sources[source]];
    return { first: () => ({ json: values[0] }), all: () => values.map((json) => ({ json })), item: { json: values[0] } };
  };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', '$execution', '$runIndex', code)(
    input, { all: () => all.map((json) => ({ json })), first: () => ({ json: input }) }, lookup, () => state, { id: '900002' }, 0);
}
const prepare = (workflow, conversation) => run(workflow, 'Vendas - Preparar Busca', { remoteJid: jid, conversation, salesFlowAction: 'nova_busca' })[0].json;
const CATEGORY = '8b7c4852-c195-4527-8fd7-c3cc2debda42';

test('só o nó Preparar Busca muda, sem mexer no grafo, e é idempotente', () => {
  const changed = after.nodes.filter((node, i) => node.parameters?.jsCode !== before.nodes[i].parameters?.jsCode).map((node) => node.name);
  assert.deepEqual(changed, alreadyPatched ? [] : NODES);
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(patchWorkflow(after), after);
});

test('a frase real e variações viram a lista de celulares do mais barato', () => {
  for (const text of ['Qual celular mais em conta que você tem aí?', 'qual o celular mais barato que vcs tem hoje?',
    'Tem algum celular mais em conta aqui na loja?', 'celular mais barato até 1000', 'quero saber o celular mais barato que tem',
    'Celulares em conta mais barato', 'me mostra os celulares mais em conta']) {
    const base = prepare(after, text);
    assert.equal(base.productCategoryId, CATEGORY, text);
    assert.equal(base.productSearchKind, 'categoria', text);
    assert.equal(base.salesCheapestFirstV1, true, text);
  }
  if (!alreadyPatched) assert.notEqual(prepare(before, 'Qual celular mais em conta que você tem aí?').productCategoryId, CATEGORY, 'antes: o defeito');
});

test('pedido de modelo continua sendo busca do modelo', () => {
  for (const text of ['Redmi 15 tem?', 'quanto custa o poco x7', 'qual o mais barato do redmi 15']) {
    assert.notEqual(prepare(after, text).salesCheapestFirstV1, true, text);
  }
});
