'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {patchWorkflow, NODE} = require('../scripts/n8n-meta-catalog-intent-parity.cjs');

const workflowPath = process.env.N8N_WORKFLOW_FIXTURE || path.join(__dirname, '..', '.local', 'meta-current-workflow.private.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const candidate = patchWorkflow(workflow);
const code = candidate.nodes.find(node => node.name === NODE).parameters.jsCode;

function prepare(conversation, fields = {}) {
  const source = {conversation, salesSearchQuery: 'Poco X8 Pro 5G', requestedDeviceBrand: 'xiaomi', ...fields};
  const rows = vm.runInNewContext(`(function(){${code}})()`, {$json: source}, {timeout: 3000});
  return rows[0].json;
}

test('aceitar promoções após contexto de modelo não declara o modelo indisponível', () => {
  const output = prepare('Sim para ver as promoções para hoje');
  assert.equal(output.specificDeviceModelRequest, false);
  assert.equal(output.requestedDeviceModelQuery, '');
});

test('pedido explícito de modelo mantém busca específica', () => {
  const output = prepare('Quero o Poco X8 Pro 5G');
  assert.equal(output.specificDeviceModelRequest, true);
  assert.match(output.requestedDeviceModelQuery, /poco x8 pro 5g/);
});

test('promoções de marca sem modelo não disparam mensagem de modelo indisponível', () => {
  const output = prepare('Quero as promoções do Poco', {salesSearchQuery: 'Poco'});
  assert.equal(output.specificDeviceModelRequest, false);
  const modelPromotion = prepare('Tem promoção do Poco X8 Pro 5G?');
  assert.equal(modelPromotion.specificDeviceModelRequest, true);
});

test('seleção numérica segue o contexto da lista', () => {
  const output = prepare('Quero o 10', {salesSearchQuery: '', salesFlowAction: 'escolher_item', salesFlowItemNumber: 10,
    salesConversationState: {opcoes: [{numero: 10, nome: 'Poco C81 Pro', memoria: '4GB/256GB'}]}});
  assert.match(output.productSearchTerm, /poco c81 pro/i);
});
