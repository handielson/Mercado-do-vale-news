// sales-list-delivered-v1: lista gravada mas não entregue não é herdada (caso 558781318075).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-sales-list-delivered.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const jid = '558781318075@s.whatsapp.net';
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

function guardRun(state, recent) {
  const w = m.patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8')));
  const code = w.nodes.find((n) => n.name === m.NODE).parameters.jsCode;
  const start = code.indexOf(`// ${m.MARK}`);
  const end = code.indexOf('let activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;');
  assert.ok(start > 0 && end > start, 'guarda antes do activeState');
  const staticData = { salesPostList: state ? { [jid]: state } : {} };
  new Function('staticData', 'source', 'remoteJid', 'now', code.slice(start, end))(staticData, { recentMessages: recent }, jid, Date.now());
  return staticData.salesPostList[jid];
}
const listState = (msAgo) => ({ flow: 'sales_post_list', step: 'awaiting_product_choice', createdAt: iso(msAgo), options: [{ name: 'Redmi 15' }] });
const before = [{ direction: 'inbound', text: 'Oi', created_at: iso(10 * 60000) }, { direction: 'outbound', text: 'Eu sou a Val', created_at: iso(9 * 60000) },
  { direction: 'inbound', text: 'Val estou precisando de um celular bom e barato', created_at: iso(90000) }];

test('caso real: lista gravada e descartada no envio → estado descartado', { skip }, () => {
  assert.equal(guardRun(listState(40000), [...before, { direction: 'inbound', text: 'Qual a promoção de hoje', created_at: iso(5000) }]), undefined);
});
test('lista entregue → estado mantido', { skip }, () => {
  const st = guardRun(listState(40000), [...before, { direction: 'outbound', text: '1. Redmi 15\n💰 R$ 1.349,00 à vista no PIX', created_at: iso(30000) },
    { direction: 'outbound', text: 'Qual modelo voce quer ver em mais detalhes? 😊', created_at: iso(25000) }, { direction: 'inbound', text: 'Qual a promoção de hoje', created_at: iso(5000) }]);
  assert.equal(st.step, 'awaiting_product_choice');
});
test('lista antiga (mais de 15 min) → não mexe', { skip }, () => {
  assert.equal(guardRun(listState(20 * 60000), before).step, 'awaiting_product_choice');
});
test('histórico curto que não cobre o momento da lista → não mexe', { skip }, () => {
  assert.equal(guardRun(listState(40000), [{ direction: 'inbound', text: 'a', created_at: iso(10000) }]).step, 'awaiting_product_choice');
});
test('outro passo (ex.: escolhendo cor) → não mexe', { skip }, () => {
  assert.equal(guardRun({ ...listState(40000), step: 'awaiting_color_choice' }, before).step, 'awaiting_color_choice');
});
