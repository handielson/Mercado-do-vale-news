'use strict';
const assert = require('node:assert/strict');
const ACK_NAME = 'WhatsApp - Confirmar recebimento webhook';
// n8n 2.38.5 checks all structural descendants, including both IF outputs.
// Retain the old onReceived response before running any business nodes.
function patchWhatsAppWebhookAck(input) {
  const workflow = structuredClone(input);
  const webhook = workflow.nodes.find(n => n.name === 'Webhook');
  assert.equal(webhook?.type, 'n8n-nodes-base.webhook');
  assert.equal(webhook.parameters.path, 'whatsapp');
  const existing = workflow.nodes.find(n => n.name === ACK_NAME);
  if (existing) {
    assert.equal(webhook.parameters.responseMode, 'responseNode');
    assert.deepEqual(workflow.connections.Webhook.main, [[{node: ACK_NAME, type: 'main', index: 0}]]);
    assert.deepEqual(existing.parameters, ackParameters());
    return workflow;
  }
  assert.equal(webhook.parameters.responseMode || 'onReceived', 'onReceived');
  assert.deepEqual(webhook.parameters.options, {});
  assert.equal(webhook.parameters.responseData, undefined);
  const previous = structuredClone(workflow.connections.Webhook);
  assert.ok(previous.main?.[0]?.length, 'Existing WhatsApp entry connection required');
  webhook.parameters.responseMode = 'responseNode';
  workflow.nodes.push({id: 'whatsapp-webhook-immediate-ack-v1', name: ACK_NAME,
    type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4,
    position: [webhook.position[0] + 160, webhook.position[1]],
    parameters: ackParameters()});
  workflow.connections.Webhook = {main: [[{node: ACK_NAME, type: 'main', index: 0}]]};
  workflow.connections[ACK_NAME] = previous;
  return workflow;
}
function ackParameters() {
  return {respondWith: 'json', responseBody: '{"message":"Workflow was started"}', options: {responseCode: 200}};
}
module.exports = {patchWhatsAppWebhookAck, ACK_NAME};
