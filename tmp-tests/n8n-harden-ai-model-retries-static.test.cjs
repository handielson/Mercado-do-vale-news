const assert = require('node:assert/strict');
const {
  RETRY_NAMES,
  CUSTOMER_SEND_NAMES,
  MAX_TRIES,
  WAIT_BETWEEN_TRIES_MS,
  patchAiModelRetries,
  validateAiModelRetries,
} = require('./n8n-harden-ai-model-retries.cjs');

const nodes = [
  ...[...RETRY_NAMES].map((name, index) => ({
    name,
    type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    parameters: { modelName: `model-${index}` },
    credentials: { openAiApi: { id: `credential-${index}` } },
    ...(name === 'OpenAI Vendas' ? { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 } : {}),
  })),
  ...[...CUSTOMER_SEND_NAMES].map((name) => ({
    name,
    type: 'n8n-nodes-base.httpRequest',
    parameters: { method: 'POST' },
  })),
];
const workflow = { nodes, connections: { Entrada: { main: [[{ node: 'OpenAI Chat Model', type: 'main', index: 0 }]] } } };
const originalConnections = JSON.stringify(workflow.connections);
const originalParameters = new Map(nodes.map((node) => [node.name, JSON.stringify(node.parameters)]));
const originalCredentials = new Map(nodes.map((node) => [node.name, JSON.stringify(node.credentials || null)]));

assert.deepEqual(patchAiModelRetries(workflow), ['OpenAI Chat Model', 'OpenAI Classificador']);
assert.equal(JSON.stringify(workflow.connections), originalConnections);
for (const node of nodes) {
  assert.equal(JSON.stringify(node.parameters), originalParameters.get(node.name));
  assert.equal(JSON.stringify(node.credentials || null), originalCredentials.get(node.name));
}
assert.deepEqual(validateAiModelRetries(workflow), {
  marker: 'ai-model-retries-v1',
  aiModels: 3,
  maxTries: MAX_TRIES,
  waitBetweenTriesMs: WAIT_BETWEEN_TRIES_MS,
});
assert.deepEqual(patchAiModelRetries(workflow), []);
for (const name of CUSTOMER_SEND_NAMES) {
  const node = nodes.find((candidate) => candidate.name === name);
  assert.notEqual(node.retryOnFail, true);
}

console.log('n8n AI model retry static checks passed');
