const assert = require('node:assert/strict');
const test = require('node:test');
const {
  SWITCH_NAME,
  FALLBACK_TARGET,
  RULE_COUNT,
  FALLBACK_LABEL,
  patchSpecialistFallback,
  validateSpecialistFallback,
} = require('./n8n-add-specialist-fallback.cjs');

function fixture() {
  return {
    nodes: [
      {
        name: SWITCH_NAME,
        type: 'n8n-nodes-base.switch',
        typeVersion: 3.4,
        parameters: {
          mode: 'rules',
          rules: { values: Array.from({ length: RULE_COUNT }, (_, index) => ({ outputKey: `route-${index}` })) },
          options: { ignoreCase: true },
        },
      },
      { name: FALLBACK_TARGET, type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
      { name: 'Outro no', type: 'n8n-nodes-base.noOp', parameters: {} },
    ],
    connections: {
      [SWITCH_NAME]: {
        main: Array.from({ length: RULE_COUNT }, (_, index) => [{ node: `Destino ${index}`, type: 'main', index: 0 }]),
      },
      'Outro no': { main: [[{ node: FALLBACK_TARGET, type: 'main', index: 0 }]] },
    },
  };
}

test('adds an explicit extra fallback without changing the 13 existing routes', () => {
  const workflow = fixture();
  const originalRoutes = structuredClone(workflow.connections[SWITCH_NAME].main);
  const originalOtherConnection = structuredClone(workflow.connections['Outro no']);
  const result = patchSpecialistFallback(workflow);

  assert.equal(result.alreadyConfigured, false);
  assert.deepEqual(workflow.connections[SWITCH_NAME].main.slice(0, RULE_COUNT), originalRoutes);
  assert.deepEqual(workflow.connections['Outro no'], originalOtherConnection);
  assert.equal(workflow.nodes[0].parameters.options.ignoreCase, true);
  assert.equal(workflow.nodes[0].parameters.options.fallbackOutput, 'extra');
  assert.equal(workflow.nodes[0].parameters.options.renameFallbackOutput, FALLBACK_LABEL);
  validateSpecialistFallback(workflow);
});

test('is idempotent after the fallback is configured', () => {
  const workflow = fixture();
  patchSpecialistFallback(workflow);
  const once = JSON.stringify(workflow);
  const result = patchSpecialistFallback(workflow);

  assert.equal(result.alreadyConfigured, true);
  assert.equal(JSON.stringify(workflow), once);
  validateSpecialistFallback(workflow);
});

test('refuses an unexpected route count', () => {
  const workflow = fixture();
  workflow.nodes[0].parameters.rules.values.pop();
  assert.throws(() => patchSpecialistFallback(workflow), /13/);
});
