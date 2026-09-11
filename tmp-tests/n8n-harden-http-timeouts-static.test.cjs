const assert = require('node:assert/strict');
const {
  patchHttpTimeouts,
  validateHttpTimeouts,
} = require('./n8n-harden-http-timeouts.cjs');

const workflow = {
  nodes: [
    { name: 'Vendas - Buscar CEP ViaCEP', type: 'n8n-nodes-base.httpRequest', parameters: { method: 'GET', options: {} } },
    { name: 'OpenAI - Transcrever audio', type: 'n8n-nodes-base.httpRequest', parameters: { method: 'POST' } },
    { name: 'Vendas - Gerar cards da lista', type: 'n8n-nodes-base.httpRequest', parameters: { method: 'POST', options: { timeout: 120000 } } },
    { name: 'Enviar WhatsApp', type: 'n8n-nodes-base.httpRequest', parameters: { method: 'POST', options: {} }, retryOnFail: false },
    { name: 'Vendas - Buscar Produtos', type: 'n8n-nodes-base.httpRequest', parameters: { method: 'GET', options: {} } },
    { name: 'Não HTTP', type: 'n8n-nodes-base.code', parameters: { options: {} } },
  ],
  connections: { 'Enviar WhatsApp': { main: [[]] } },
};

const originalConnections = structuredClone(workflow.connections);
const originalRetrySettings = workflow.nodes.map((node) => ({
  name: node.name,
  retryOnFail: node.retryOnFail,
  maxTries: node.maxTries,
  waitBetweenTries: node.waitBetweenTries,
}));
const firstChanges = patchHttpTimeouts(workflow);
assert.deepEqual(firstChanges, [
  { name: 'Vendas - Buscar CEP ViaCEP', timeout: 15000 },
  { name: 'OpenAI - Transcrever audio', timeout: 120000 },
  { name: 'Enviar WhatsApp', timeout: 30000 },
  { name: 'Vendas - Buscar Produtos', timeout: 30000 },
]);
assert.equal(workflow.nodes[0].parameters.options.timeout, 15000);
assert.equal(workflow.nodes[1].parameters.options.timeout, 120000);
assert.equal(workflow.nodes[3].parameters.options.timeout, 30000);
assert.equal(workflow.nodes[4].parameters.options.timeout, 30000);
assert.equal(workflow.nodes[3].retryOnFail, false, 'POST retries must remain disabled');
assert.deepEqual(workflow.nodes.map((node) => ({
  name: node.name,
  retryOnFail: node.retryOnFail,
  maxTries: node.maxTries,
  waitBetweenTries: node.waitBetweenTries,
})), originalRetrySettings, 'all existing retry settings must be preserved');
assert.deepEqual(workflow.connections, originalConnections, 'connections must remain untouched');

const validation = validateHttpTimeouts(workflow);
assert.equal(validation.httpNodes, 5);
assert.equal(patchHttpTimeouts(workflow).length, 0, 'patch must be idempotent');

console.log('n8n HTTP timeout hardening static checks passed');
