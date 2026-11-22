// store-visit-status-v1: endereço diz se a loja está aberta agora; "tô indo" não repete o endereço.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-store-visit-status.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const day = (o) => ({ isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00', ...o });
const business_hours = { monday: day(), tuesday: day(), wednesday: day(), thursday: day(), friday: day(),
  saturday: day({ closeTime: '14:00', hasLunchBreak: false }), sunday: day({ isOpen: false }) };
const company = { address: 'ABILIO MOURATO CRUZ, 5 - LOJA c - COHAB MASSANGANO - PETROLINA - PE', business_hours, name: 'Mercado do Vale' };
const fakeDate = (iso) => { const T = Date.parse(iso); class D extends Date { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } } return D; };
const sentAddress = (iso, minAgo) => ({ direction: 'outbound', text: '📍 Nosso endereço: ABILIO…', created_at: new Date(Date.parse(iso) - minAgo * 60000).toISOString() });

function run(conversation, iso, recent = []) {
  const code = m.patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8'))).nodes.find((n) => n.name === m.NODE).parameters.jsCode;
  const nodes = { 'Parse Classificacao': { conversation }, 'Controle Bot - Aplicar Controle': { recentMessages: recent } };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
  return new Function('$', '$json', 'Date', code)($, company, fakeDate(iso))[0].json;
}
const SUN = '2026-11-22T16:42:48Z'; // domingo 13h42 em Recife

test('caso real: domingo, "manda o endereço que a gente vai agora" avisa que está fechada e quando abre, antes do endereço', { skip }, () => {
  const r = run('Pois manda o endereço aí da loja que a gente vai agora pra o senhor resolver isso aí, viu?', SUN);
  assert.equal(r.storeStatusV1, 'fechada_hoje');
  assert.equal(r.messages[0].text, '⚠️ Hoje (domingo) a loja está fechada. Abrimos amanhã (segunda) às 08:00.');
  assert.match(r.messages[1].text, /^📍 Nosso endereço/);
});

test('caso real: "Tô indo" logo depois do endereço não repete o endereço', { skip }, () => {
  const fechado = run('Tô indo', SUN, [sentAddress(SUN, 1)]);
  assert.equal(fechado.messages.length, 1);
  assert.match(fechado.messages[0].text, /fechada.*Melhor vir quando estivermos abertos/);
  const TER = '2026-11-24T13:00:00Z'; // terça 10h
  const aberto = run('to indo agora', TER, [sentAddress(TER, 5)]);
  assert.equal(aberto.messages.length, 1);
  assert.equal(aberto.messages[0].text, 'Combinado! Te esperamos aqui na loja. 😊\n🕒 Estamos abertos agora, até 12:00 (pausa para almoço até 14:00) e depois até 18:00.');
});

test('horários: antes de abrir, almoço, depois de fechar e sábado à tarde', { skip }, () => {
  assert.equal(run('qual o endereço?', '2026-11-24T10:00:00Z').messages[0].text, '⚠️ A loja ainda não abriu: hoje abrimos às 08:00.');
  assert.equal(run('qual o endereço?', '2026-11-24T15:30:00Z').messages[0].text, '⚠️ Agora estamos na pausa do almoço; voltamos às 14:00.');
  assert.equal(run('qual o endereço?', '2026-11-24T21:30:00Z').messages[0].text, '⚠️ Já encerramos por hoje (fechamos às 18:00). Abrimos amanhã (quarta) às 08:00.');
  assert.equal(run('qual o endereço?', '2026-11-28T18:00:00Z').messages[0].text, '⚠️ Já encerramos por hoje (fechamos às 14:00). Abrimos segunda às 08:00.');
});

test('aberta e só pediu o endereço: sem aviso, igual antes (endereço, mapa, fechamento)', { skip }, () => {
  const r = run('qual o endereço?', '2026-11-24T13:00:00Z');
  assert.equal(r.storeStatusV1, 'aberta');
  assert.deepEqual(r.messages.map((x) => x.text.slice(0, 12)), ['📍 Nosso end', '📍 Localizaç', 'Se precisar ']);
});

test('quer visitar com a loja aberta: mostra até que horas fica aberta', { skip }, () => {
  const r = run('posso passar na loja pra ver?', '2026-11-24T17:30:00Z');
  assert.match(r.messages[0].text, /^Pode sim! 😊 .*\n🕒 Estamos abertos agora, até 18:00\.$/);
});

test('"tô indo" sem endereço recente segue o fluxo normal com o endereço', { skip }, () => {
  const r = run('tô indo', '2026-11-24T13:00:00Z', [sentAddress('2026-11-24T13:00:00Z', 300)]);
  assert.ok(r.messages.some((x) => /Nosso endereço/.test(x.text)));
});

test('patch idempotente e só no nó Loja - Localizacao', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = m.patchWorkflow(before);
  assert.deepEqual(m.patchWorkflow(after), after);
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), [m.NODE]);
});
