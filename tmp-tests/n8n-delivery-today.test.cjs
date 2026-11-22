// delivery-today-v1: "vc entrega hj" → motoboy + já já confirmo; aviso ao admin pela frase "chamar um motoboy".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-delivery-today.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const run = (w, conversation, remoteJid = '558781026485@s.whatsapp.net') => {
  const code = w.nodes.find((n) => n.name === m.NODE).parameters.jsCode;
  return new Function('$json', '$getWorkflowStaticData', code)({ conversation, remoteJid }, () => ({}))[0].json;
};

test('caso real: "vc entrega hj" diz que vamos chamar um motoboy e já já confirma, e pede o bairro', { skip }, () => {
  const r = run(m.patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8'))), 'vc entrega hj');
  assert.equal(r.output, 'Vamos chamar um motoboy para fazer a sua entrega e já já te confirmo, tá bom? 😊🛵[[BR]]Enquanto isso, me diga o bairro da entrega (pelo seu DDD 87, considerei Petrolina-PE).');
  assert.equal(r.deliveryTodayV1, true);
  assert.match(r.output, /chamar um motoboy/, 'a frase que dispara o aviso ao admin');
});

test('sem DDD conhecido pede o CEP; pergunta de entrega sem "hoje" fica igual a antes', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = m.patchWorkflow(before);
  assert.match(run(after, 'entrega agora?', '551199990000@s.whatsapp.net').output, /me envie os 8 números do CEP/);
  for (const t of ['vocês entregam?', 'faz entrega em juazeiro?']) assert.equal(run(after, t).output, run(before, t).output, t);
});

test('patch idempotente e só no Entrega - Politica', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = m.patchWorkflow(before);
  assert.deepEqual(m.patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), [m.NODE]);
});
