'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {patchWorkflow} = require('../scripts/build-n8n-meta-parity.cjs');

const workflowPath = process.env.N8N_WORKFLOW_FIXTURE || path.join(__dirname, '..', '.local', 'meta-current-workflow.private.json');
const original = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

test('candidate composes only the four intended Code nodes', () => {
  const candidate = patchWorkflow(original);
  assert.deepEqual(candidate.connections, original.connections);
  assert.deepEqual(candidate.nodes.filter((node, index) =>
    JSON.stringify(node) !== JSON.stringify(original.nodes[index])).map(node => node.name).sort(),
  ['Resolver Acao de Conversacao', 'Vendas - Contexto Produtos', 'Vendas - Preparar Busca', 'Vendas - Verificar Pos Lista'].sort());
  assert.deepEqual(patchWorkflow(candidate), candidate);
});
