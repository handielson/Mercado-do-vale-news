'use strict';
// card-machine-wording-v1: cartão "na maquininha" e "não aceitamos cartão virtual", nunca "presencial".
// MDV_N8N_SALES_SNAPSHOT=<workflow.json> node --test tmp-tests/n8n-card-machine-wording.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../scripts/n8n-card-machine-wording.cjs');
const snapshotPath = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshotPath || !fs.existsSync(snapshotPath) ? 'sem MDV_N8N_SALES_SNAPSHOT' : false;

test('textos de cartão falam em maquininha e cartão virtual, sem "presencial"', { skip }, () => {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const before = raw.nodes ? raw : raw.workflow;
  const after = M.patchWorkflow(before);
  M.assertExpectedGraph(before, after);
  const changed = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name);
  assert.deepEqual(changed, M.CHANGED);
  assert.equal(JSON.stringify(M.patchWorkflow(after)), JSON.stringify(after));
  const code = after.nodes.find((n) => n.name === M.NODE).parameters.jsCode;
  assert.doesNotMatch(code, /pagamento no cartão é presencial|feito presencialmente/);
  assert.equal(code.split(M.MACHINE).length - 1, 2, 'juros do cartão e parcelamento');
  assert.match(code, /pagamento é feito na maquininha, no ato da entrega ou retirada\. Não aceitamos cartão virtual\./);
  new Function('$', '$json', '$getWorkflowStaticData', `return (async () => {${code}\n})`);
});
