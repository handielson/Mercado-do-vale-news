const assert = require('node:assert/strict');
const { updateExistingPayJoyWorkflow } = require('./n8n-payjoy-workflow-patch.cjs');

const original = {
  nodes: [{
    name: 'Pagamento - Politica',
    parameters: { jsCode: "const payjoyByJid = {}; let payjoyFollowupKind = ''; // texto anterior" },
  }],
  connections: { unchanged: { main: [[]] } },
};

const updated = updateExistingPayJoyWorkflow(original);
const code = updated.nodes[0].parameters.jsCode;

assert.notEqual(updated, original);
assert.deepEqual(updated.connections, original.connections);
assert.match(code, /Sim! Temos financiamento de celulares pela PayJoy/);
assert.equal((code.match(/\|\|\|/g) || []).length >= 2, true);
assert.match(code, /payjoyFollowupKind/);
assert.doesNotMatch(original.nodes[0].parameters.jsCode, /Sim! Temos financiamento/);

console.log('PayJoy copy updater: focused node replacement OK');
