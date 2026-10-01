const assert = require('node:assert/strict');
const { MARKER, patchWorkflow } = require('./n8n-fix-product-specialist-handoff-notification.cjs');

const workflow = {
  nodes: [{
    name: 'Vendas - Preparar Handoff Especialista',
    parameters: {
      jsCode: "const source = $('origem').first().json; return [{ json: { ...source, specialistHandoffBy: 'bot-product-specialist', specialistHandoffDurationSeconds: 7200 } }];",
    },
  }],
  connections: { preserved: { main: [[]] } },
};

const updated = patchWorkflow(workflow);
const code = updated.nodes[0].parameters.jsCode;
assert.match(code, new RegExp(MARKER));
assert.match(code, /specialistHandoffBy:\s*'bot-handoff-request'/);
assert.doesNotMatch(code, /bot-product-specialist/);
assert.deepEqual(updated.connections, workflow.connections);
assert.match(workflow.nodes[0].parameters.jsCode, /bot-product-specialist/);

console.log('Product specialist handoff now uses the admin notification relay');
