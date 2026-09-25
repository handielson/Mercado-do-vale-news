const assert = require('node:assert/strict');
const { replicaCount, decodeWorkflowExport } = require('./n8n-deploy-payjoy-workflow.cjs');

const services = 'n8n_n8n 0/0\nn8n_n8n-db 1/1\nn8n_n8n-runner 0/0\n';
assert.equal(replicaCount(services, 'n8n_n8n'), '0/0');
assert.equal(replicaCount(services, 'n8n_n8n-runner'), '0/0');

const nodes = [{ name: 'Pagamento - Política', parameters: { jsCode: 'const x = "\\n";' } }];
const connections = { 'Pagamento - Política': { main: [[]] } };
const raw = JSON.stringify({
  id: 'workflow',
  nodesHex: Buffer.from(JSON.stringify(nodes)).toString('hex'),
  connectionsHex: Buffer.from(JSON.stringify(connections)).toString('hex'),
});
assert.deepEqual(decodeWorkflowExport(raw), { id: 'workflow', nodes, connections });

console.log('PayJoy n8n deploy helpers passed');
