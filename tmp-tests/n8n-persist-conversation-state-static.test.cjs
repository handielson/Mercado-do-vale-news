const assert = require('node:assert/strict');
const vm = require('node:vm');
const {
  MARKER,
  patchHydration,
  patchWorkflow,
  validate,
  preparePersistenceCode,
  restorePersistenceCode,
} = require('./n8n-persist-conversation-state.cjs');

const applyFixture = {
  name: 'Controle Bot - Aplicar Controle',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [0, 0],
  parameters: { jsCode: `const source = $('Controle Bot - Verificar Cliente').first().json || {};
const payload = $json || {};
const remoteJid = String(source.remoteJid || '');
const staticData = $getWorkflowStaticData('global');
const control = payload.control || {};
const baseOutput = { ...source, n8nBotControl: control };
baseOutput.n8nBotBlocked = Boolean(control.blocked || baseOutput.humanHandoffPaused);
if (payload.resetPending) {
  staticData.salesPostList = staticData.salesPostList || {};
  delete staticData.salesPostList[remoteJid];
}
return [{ json: baseOutput }];` },
};

patchHydration(applyFixture);
assert.match(applyFixture.parameters.jsCode, new RegExp(`${MARKER}:hydrate`));
const remoteJid = '559999999999@s.whatsapp.net';
const staticData = {
  salesPostList: { [remoteJid]: { step: 'stale-local' } },
  pendingDeviceClarification: { [remoteJid]: { brand: 'stale-local' } },
};
const persistedState = { salesPostList: { step: 'awaiting_quantity', expiresAt: Date.now() + 60_000 } };
const hydrated = vm.runInNewContext(`(function(){${applyFixture.parameters.jsCode}})()`, {
  $json: { control: { conversation_state: persistedState, conversation_state_revision: 7 } },
  $: () => ({ first: () => ({ json: { remoteJid } }) }),
  $getWorkflowStaticData: () => staticData,
  Date,
})[0].json;
assert.equal(hydrated.conversationStateRevision, 7);
assert.equal(staticData.salesPostList[remoteJid].step, 'awaiting_quantity');
assert.equal(staticData.pendingDeviceClarification[remoteJid], undefined, 'an authoritative persisted revision must clear absent state');

const templateHttp = {
  id: 'http-template',
  name: 'Controle Bot - Consumir Reset',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [0, 0],
  onError: 'continueRegularOutput',
  parameters: {},
};
const workflow = {
  nodes: [
    applyFixture,
    templateHttp,
    { id: 'divider', name: 'Dividir mensagens', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1000, 0], parameters: { jsCode: 'return $input.all();' } },
    { id: 'a', name: 'Resposta A', type: 'n8n-nodes-base.noOp', position: [0, 0], parameters: {} },
    { id: 'b', name: 'Resposta B', type: 'n8n-nodes-base.noOp', position: [0, 0], parameters: {} },
  ],
  connections: {
    'Resposta A': { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] },
    'Resposta B': { main: [[], [{ node: 'Dividir mensagens', type: 'main', index: 0 }]] },
  },
};

patchWorkflow(workflow);
const validation = validate(workflow);
assert.deepEqual(validation.hydratedKeys, ['salesPostList', 'pendingDeviceClarification']);
assert.equal(workflow.connections['Resposta A'].main[0][0].node, 'Estado Conversa - Preparar');
assert.equal(workflow.connections['Resposta B'].main[1][0].node, 'Estado Conversa - Preparar');
const nodeCount = workflow.nodes.length;
patchWorkflow(workflow);
assert.equal(workflow.nodes.length, nodeCount, 'patch must be idempotent');

const preparedState = {
  salesPostList: { [remoteJid]: { step: 'awaiting_payment_method', expiresAt: Date.now() + 60_000 } },
  pendingDeviceClarification: {},
};
const prepared = vm.runInNewContext(`(function(){${preparePersistenceCode}\n})()`, {
  $json: { remoteJid, output: 'Resposta preservada', conversationStateRevision: 7 },
  $: () => ({ first: () => ({ json: { remoteJid, conversationStateRevision: 7 } }) }),
  $getWorkflowStaticData: () => preparedState,
  Date,
})[0].json;
assert.equal(prepared.output, 'Resposta preservada');
assert.equal(prepared.conversationStatePersistRequest.expectedRevision, 7);
assert.equal(prepared.conversationStatePersistRequest.conversationState.salesPostList.step, 'awaiting_payment_method');

const restored = vm.runInNewContext(`(function(){${restorePersistenceCode}\n})()`, {
  $json: { control: { conversation_state_revision: 8 } },
  $: () => ({ first: () => ({ json: prepared }) }),
})[0].json;
assert.equal(restored.output, 'Resposta preservada');
assert.equal(restored.conversationStateRevision, 8);

console.log('n8n persistent conversation state workflow checks passed');
