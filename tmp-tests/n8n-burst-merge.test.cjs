// burst-merge-v1: mensagens seguidas do cliente lidas juntas; execução da mensagem antiga para.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-burst-merge.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const load = () => JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const T0 = Date.parse('2026-11-22T15:29:31Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const row = (direction, s, text, id) => ({ direction, created_at: at(s), message_text: text, wa_message_id: id || '' });

function merge(ownId, rows) {
  const nodes = { 'Controle Bot - Verificar Cliente': { messageId: ownId, remoteJid: 'x@s.whatsapp.net' }, 'switc Mensagens': {} };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
  return new Function('$', '$json', m.MERGE_CODE)($, { rows }).map((i) => i.json);
}

const caso = [
  row('outbound', -125, 'Qual modelo voce quer ver em mais detalhes? 😊', 'O1'),
  row('inbound', 0, 'Realme c71', 'A'),
  row('inbound', 17, 'Realme c72', 'B'),
];

test('caso real: a execução do "Realme c71" para, a do "Realme c72" responde as duas juntas', () => {
  assert.deepEqual(merge('A', caso), []);
  const [r] = merge('B', caso);
  assert.equal(r.burstConversationV1, 'Realme c71\nRealme c72');
  assert.equal(r.burstCountV1, 2);
});

test('mensagem única ou depois da nossa resposta: segue normal, sem juntar', () => {
  assert.equal(merge('A', caso.slice(0, 2))[0].burstConversationV1, '');
  const depois = [...caso, row('outbound', 60, 'Temos o Realme C71', 'O2'), row('inbound', 90, 'quanto no cartão?', 'C')];
  assert.equal(merge('C', depois)[0].burstConversationV1, '');
});

test('mensagem antiga demais (mais de 3 min) não entra; repetida não duplica', () => {
  const rows = [row('inbound', -400, 'oi', 'Z'), row('inbound', 0, 'Realme c71', 'A'), row('inbound', 5, 'Realme c71', 'A2'), row('inbound', 9, 'tem?', 'B')];
  assert.equal(merge('B', rows)[0].burstConversationV1, 'Realme c71\ntem?');
});

test('falha ao ler o histórico ou id desconhecido: nunca derruba a resposta', () => {
  const nodes = { 'Controle Bot - Verificar Cliente': { messageId: 'A' } };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
  assert.equal(new Function('$', '$json', m.MERGE_CODE)($, { error: 'timeout' }).length, 1);
  assert.equal(merge('NAO-EXISTE', caso).length, 1);
  assert.equal(merge('', caso).length, 1);
});

test('mensagem nova sem texto (figurinha/reação) não faz a anterior parar', () => {
  assert.equal(merge('A', [...caso.slice(0, 2), row('inbound', 4, '', 'S')]).length, 1);
});

test('Aplicar Controle e Resolver usam o texto junto; sem o nó (Meta) ficam iguais', { skip }, () => {
  const after = m.patchWorkflow(load());
  for (const name of m.CHANGED) {
    const code = after.nodes.find((n) => n.name === name).parameters.jsCode;
    assert.ok(code.includes(m.MARK));
    assert.ok(code.includes(`$('${m.MERGE}')`));
  }
  const apply = after.nodes.find((n) => n.name === 'Controle Bot - Aplicar Controle').parameters.jsCode;
  const run = (burst) => {
    const nodes = { 'Controle Bot - Verificar Cliente': { remoteJid: 'x@s.whatsapp.net', conversation: 'Realme c72' } };
    const $ = (name) => { if (name === m.MERGE && !burst) throw new Error('nó não executado'); return { first: () => ({ json: name === m.MERGE ? burst : nodes[name] }) }; };
    const store = {};
    return new Function('$', '$json', '$getWorkflowStaticData', '$execution', apply)($, { control: {} }, () => store, { id: '1' })[0].json;
  };
  assert.equal(run({ burstConversationV1: 'Realme c71\nRealme c72', burstCountV1: 2 }).conversation, 'Realme c71\nRealme c72');
  assert.equal(run(null).conversation, 'Realme c72');
  assert.equal(run({ burstConversationV1: '' }).conversation, 'Realme c72');
});

test('grafo: só insere Aguardar 10s -> Buscar -> Juntar entre Pausa global? e Buscar Controle; idempotente', { skip }, () => {
  const before = load();
  const after = m.patchWorkflow(before);
  m.assertExpectedGraph(before, after);
  assert.deepEqual(m.patchWorkflow(after), after);
  const wait = after.nodes.find((n) => n.name === m.WAIT);
  assert.deepEqual([wait.parameters.amount, wait.parameters.unit], [10, 'seconds']);
  const mudou = after.nodes.slice(0, before.nodes.length).filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name).sort();
  assert.deepEqual(mudou, [...m.CHANGED].sort());
});
