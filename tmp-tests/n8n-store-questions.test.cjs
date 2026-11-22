// store-questions-v1: horário e cidade no nó de localização sem repetir o endereço (caso 558798261431, 22/11).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const visit = require('../scripts/n8n-store-visit-status.cjs');
const q = require('../scripts/n8n-store-questions.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const day = (o) => ({ isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00', ...o });
const company = { address: 'ABILIO MOURATO CRUZ, 5 - LOJA c - COHAB MASSANGANO - PETROLINA - PE - CEP: 56310-150', address_city: 'PETROLINA', address_state: 'PE',
  address_neighborhood: 'COHAB MASSANGANO', name: 'Mercado do Vale',
  business_hours: { monday: day(), tuesday: day(), wednesday: day(), thursday: day(), friday: day(), saturday: day({ closeTime: '14:00', hasLunchBreak: false }), sunday: day({ isOpen: false }) } };
const fakeDate = (iso) => { const T = Date.parse(iso); class D extends Date { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } } return D; };
const sent = (iso, minAgo) => ({ direction: 'outbound', text: '📍 Nosso endereço: ABILIO…', created_at: new Date(Date.parse(iso) - minAgo * 60000).toISOString() });
const load = () => {
  let w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  if (!JSON.stringify(w).includes(visit.MARK)) w = visit.patchWorkflow(w);
  return q.patchWorkflow(w);
};
function run(conversation, iso, recent = []) {
  const code = load().nodes.find((n) => n.name === q.NODE).parameters.jsCode;
  const nodes = { 'Parse Classificacao': { conversation }, 'Controle Bot - Aplicar Controle': { recentMessages: recent } };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
  return new Function('$', '$json', 'Date', code)($, company, fakeDate(iso))[0].json;
}
const SUN = '2026-11-22T12:13:48Z'; // domingo 09h13

test('caso real: "Dias de fucionamentos" responde o horário da semana, sem endereço', { skip }, () => {
  const r = run('Dias de fucionamentos', SUN, [sent(SUN, 1)]);
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].text, '🕒 Nosso horário de atendimento:\nSegunda a sexta: 08:00–12:00 e 14:00–18:00\nSábado: 08:00–14:00\nDomingo: fechado\n\n⚠️ Hoje (domingo) a loja está fechada. Abrimos amanhã (segunda) às 08:00.\nEm feriados, confirme conosco antes de vir. 😊');
  assert.doesNotMatch(r.output, /Nosso endereço/);
});

test('caso real: "Juazeiro ou petrolina" logo depois do endereço responde só a cidade', { skip }, () => {
  const r = run('Juazeiro ou petrolina', SUN, [sent(SUN, 1)]);
  assert.equal(r.messages.length, 1);
  assert.match(r.messages[0].text, /^Nossa loja fica em Petrolina-PE, no bairro Cohab Massangano\. 😊\n⚠️ Hoje \(domingo\) a loja está fechada/);
});

test('cidade sem endereço recente: a linha da cidade abre e o endereço vem junto', { skip }, () => {
  const TER = '2026-11-24T13:00:00Z';
  const r = run('É aqui em Juazeiro?', TER);
  assert.equal(r.messages[0].text, 'Nossa loja fica em Petrolina-PE, no bairro Cohab Massangano. 😊');
  assert.ok(r.messages.some((m) => /Nosso endereço/.test(m.text)));
});

test('pedido de endereço continua mandando endereço e mapa, mesmo com cidade ou horário na frase', { skip }, () => {
  const TER = '2026-11-24T13:00:00Z';
  for (const t of ['qual o endereço?', 'me manda a localização', 'onde fica a loja em petrolina?', 'qual o endereço e que horas abre?']) {
    assert.ok(run(t, TER, [sent(TER, 5)]).messages.some((m) => /Nosso endereço/.test(m.text)), t);
  }
});

test('horário num dia aberto mostra até que horas fica aberta', { skip }, () => {
  const r = run('que horas vocês fecham hoje?', '2026-11-24T17:00:00Z');
  assert.match(r.messages[0].text, /\n\n🕒 Estamos abertos agora, até 18:00\./);
});

test('patch idempotente e só no nó de localização', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = load();
  assert.deepEqual(q.patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), [q.NODE]);
});
