// visit-split-messages-v1: "posso ir aí ver?" sai em mensagens separadas, como a retirada; nada de bloco único.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE } = require('../scripts/n8n-visit-split-messages.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;

const day = { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' };
const company = (extra = {}) => ({ name: 'Mercado do Vale', address: 'ABILIO MOURATO CRUZ, 5 - LOJA c - COHAB MASSANGANO - PETROLINA - PE - CEP: 56310-150',
  business_hours: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, day])), ...extra });
const runNode = (code, conversation, settings) => new Function('$', '$json', code)(() => ({ first: () => ({ json: { remoteJid: '5587999990000@s.whatsapp.net', conversation } }) }), settings)[0].json;
const runSplit = (code, json) => new Function('$', '$json', code)(() => ({ first: () => ({ json: {} }) }), json).map((item) => item.json);

test('visita e "onde fica" em mensagens separadas; pino com coordenadas', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const patched = patchWorkflow(workflow);
  assert.deepEqual(patchWorkflow(patched), patched, 'idempotente');
  const code = (wf, name) => wf.nodes.find((node) => node.name === name).parameters.jsCode;
  const node = code(patched, NODE), split = code(patched, 'Dividir mensagens');

  const visit = runNode(node, 'Posso ir aí na loja ver os aparelhos?', company());
  const sent = runSplit(split, visit);
  assert.equal(sent.length, 4);
  assert.deepEqual(sent.map((item) => item.message), [
    'Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.\n🕒 Horário regular de hoje: 08:00 às 18:00 (pausa 12:00–14:00). Em feriados, confirme conosco.',
    '📍 Nosso endereço: ABILIO MOURATO CRUZ, 5 - LOJA c - COHAB MASSANGANO - PETROLINA - PE - CEP: 56310-150',
    '📍 Localização da loja: https://maps.google.com/?q=ABILIO%20MOURATO%20CRUZ%2C%205%20-%20LOJA%20c%20-%20COHAB%20MASSANGANO%20-%20PETROLINA%20-%20PE%20-%20CEP%3A%2056310-150',
    'Se algum modelo te interessou, me diga qual para eu conferir a disponibilidade antes da visita. 😊',
  ]);
  assert.equal(visit.output.split('|||').length, 4, 'texto de reserva também separa');

  const where = runSplit(split, runNode(node, 'Onde fica a loja?', company()));
  assert.equal(where.length, 3);
  assert.match(where[0].message, /^📍 Nosso endereço: /);
  assert.match(where[2].message, /ajuda para chegar/);

  const pinned = runSplit(split, runNode(node, 'Posso ir aí na loja ver?', company({ address_lat: '-9.3891', address_lng: '-40.5030' })));
  assert.equal(pinned[2].messageType, 'location');
  assert.equal(pinned[2].latitude, -9.3891);

  // Fluxo publicado sem a correção: um bloco só (caso real 16/11).
  if (!code(workflow, NODE).includes(MARK))
    assert.equal(runSplit(split, runNode(code(workflow, NODE), 'Posso ir aí na loja ver os aparelhos?', company())).length, 1, 'reproduz o bloco único');
});
