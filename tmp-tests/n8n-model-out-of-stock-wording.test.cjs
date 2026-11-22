// model-waiting-stock-v1: frase do dono para modelo fora da lista já enviada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-model-out-of-stock-wording.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
test('o prompt do Especialista - Vendas usa a frase "Esse modelo acabou e estamos esperando chegar"', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = m.patchWorkflow(before);
  const prompt = after.nodes.find((n) => n.name === m.NODE).parameters.options.systemMessage;
  assert.ok(prompt.includes('"Esse modelo acabou e estamos esperando chegar, Nome. Se quiser, me diga o que é mais importante para você — como preço, câmera ou armazenamento — e te indico uma opção entre os modelos da lista."'));
  assert.ok(!prompt.includes(m.OLD));
  assert.deepEqual(m.patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), [m.NODE]);
  assert.deepEqual(after.connections, before.connections);
});
