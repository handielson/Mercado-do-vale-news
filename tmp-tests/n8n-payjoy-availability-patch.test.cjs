'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARKER } = require('./n8n-payjoy-availability-patch.cjs');

const sourcePath = process.env.MDV_N8N_SOURCE_SNAPSHOT;
const candidatePath = process.env.MDV_N8N_CANDIDATE_SNAPSHOT || process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT;
if (!candidatePath) throw Error('Provide a candidate snapshot');
const source = sourcePath ? JSON.parse(fs.readFileSync(sourcePath, 'utf8')) : null;
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const policy = candidate.nodes.find(node => node.name === 'Pagamento - Politica').parameters.jsCode;
const run = (message, store = {}) => new Function('$json', '$', '$getWorkflowStaticData', policy)(
  { payjoy_analysis_url: 'https://www.payjoy.com/br/test-only' },
  () => ({ first: () => ({ json: { remoteJid: 'test@s.whatsapp.net', conversation: message } }) }),
  () => store,
)[0].json;

test('candidate changes only the payment policy and is idempotent', () => {
  if (source) {
    assert.deepEqual(patchWorkflow(source), candidate);
    assert.deepEqual(candidate.connections, source.connections);
    assert.equal(candidate.nodes.filter((node, index) => JSON.stringify(node) !== JSON.stringify(source.nodes[index])).length, 1);
  }
  assert.deepEqual(patchWorkflow(candidate), candidate);
  assert.equal(policy.split(MARKER).length - 1, 1);
});

test('availability question gets answer and asks consent without handoff or link', () => {
  for (const message of ['Os celulares são pela payjoy?', 'Vocês trabalham com PayJoy?', 'Tem celular pela PayJoy?']) {
    const store = {};
    const result = run(message, store);
    assert.match(result.output, /financiar celulares pela PayJoy/);
    assert.match(result.output, /elegibilidade do aparelho/);
    assert.match(result.output, /Quer que eu envie o link/);
    assert.equal(result.payjoyNeedsHandoff, false);
    assert.doesNotMatch(result.output, /https?:\/\//);
    assert.equal(store.payjoyByJid['test@s.whatsapp.net'].status, 'awaiting_link_confirmation');
  }
});

test('separate accepted turn sends official link; unrelated uncertainty still follows existing path', () => {
  const store = {};
  run('Os celulares são pela PayJoy?', store);
  const result = new Function('$json', '$', '$getWorkflowStaticData', policy)(
    { payjoy_analysis_url: 'https://www.payjoy.com/br/test-only' },
    () => ({ first: () => ({ json: { remoteJid: 'test@s.whatsapp.net', conversation: 'Pode enviar', payjoyLinkReply: { decision: 'accept', confidence: 0.99 } } }) }),
    () => store,
  )[0].json;
  assert.match(result.output, /https:\/\/www\.payjoy\.com\/br\/test-only/);
  assert.equal(store.payjoyByJid['test@s.whatsapp.net'].status, 'awaiting_result');
  const unrelated = run('PayJoy é segura?');
  assert.equal(unrelated.payjoyNeedsHandoff, true);
});
