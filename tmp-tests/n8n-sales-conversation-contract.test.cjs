const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { patchWorkflow, restorePersistenceCode } = require('./n8n-sales-conversation-contract.cjs');
const snapshotPath = process.env.MDV_N8N_SALES_SNAPSHOT || path.join(__dirname, '../.local/n8n-sales-current.json');
const original = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const originalBeforeTransform = structuredClone(original);
const workflow = patchWorkflow(original);
const nodeCode = (name) => workflow.nodes.find((node) => node.name === name).parameters.jsCode;
const JID = '5500000000000@s.whatsapp.net';
function state(step, extra = {}) {
  return { flow: 'sales_post_list', step, expiresAt: Date.now() + 3600000,
    categoryId: '8b7c4852-c195-4527-8fd7-c3cc2debda42', options: [{ number: 1, name: 'Fixture Smartphone', memory: '8GB/256GB', colors: [{ productId: 'fixture-phone', color: 'Preto' }] }],
    orderDraft: { productId: 'fixture-phone', name: 'Fixture Smartphone', memory: '8GB/256GB', price: 'R$ 1.224,00', fulfillment: 'delivery', ...extra } };
}
async function post(step, text, semantic = null, extra = {}) {
  const fixture = state(step, extra);
  const data = { salesPostList: { [JID]: fixture } };
  const source = { remoteJid: JID, conversation: text, collectionReply: semantic };
  const $ = (name) => ({ first: () => ({ json: name === 'Parse Classificacao' ? source : {} }) });
  const result = await new Function('$json', '$', '$getWorkflowStaticData', nodeCode('Vendas - Verificar Pos Lista'))({}, $, () => data);
  return { result: result[0]?.json, state: data.salesPostList[JID], data, source };
}
function restore(response, prepared, storage = {}) {
  let runIndex;
  const $ = () => ({ first: (branch, run) => { runIndex = run; return { json: prepared }; } });
  const output = new Function('$json', '$', '$getWorkflowStaticData', '$runIndex', restorePersistenceCode)(response, $, () => storage, 1);
  return { output, storage, runIndex };
}
test('transform is pure/idempotent, keeps existing current-message guard and human controls', () => {
  assert.deepEqual(patchWorkflow(workflow), workflow);
  assert.deepEqual(original, originalBeforeTransform, 'transform must never mutate the input snapshot');
  for (const name of ['Controle Bot - Aplicar mensagem atual', 'Handoff - Verificar pausa']) {
    const existing = original.nodes.find((n) => n.name === name);
    if (existing) assert.deepEqual(workflow.nodes.find((n) => n.name === name), existing);
  }
  assert.ok(workflow.nodes.find((n) => n.name === 'Estado Conversa - Persistir').parameters.bodyParameters.parameters.some((p) => p.name === 'allowRebase'));
});
test('reapplying preserves the terminal handoff extension after accepted persistence', () => {
  const extended = structuredClone(workflow);
  extended.connections['Estado Conversa - Rebase necessario?'].main[1] = [{ node: 'Vendas - Pedido precisa equipe?', type: 'main', index: 0 }];
  assert.deepEqual(patchWorkflow(extended), extended);
});
for (const text of ['Só que ia passa cartão', 'Te que horas vc pode entrega celular', 'Até que horas entrega?', 'Quero falar com atendente']) {
  test(`question cannot become neighborhood: ${text}`, async () => {
    const { result, state: updated } = await post('awaiting_delivery_neighborhood', text);
    assert.equal(result.salesPostListHandled, false);
    assert.equal(updated.step, 'awaiting_delivery_neighborhood');
    assert.equal(updated.orderDraft.deliveryNeighborhood, undefined);
  });
}
test('legitimate neighborhood is still captured and proceeds to location', async () => {
  const { result, state: updated } = await post('awaiting_delivery_neighborhood', 'José e Maria', { decision: 'field_value', confidence: 0.95 });
  assert.equal(result.salesPostListHandled, true);
  assert.equal(updated.step, 'awaiting_delivery_location');
  assert.equal(updated.orderDraft.deliveryNeighborhood, 'José e Maria');
});
test('semantic other cannot become a neighborhood even without a known word', async () => {
  const { result, state: updated } = await post('awaiting_delivery_neighborhood', 'Depois a gente vê isso', { decision: 'other', confidence: 0.94 });
  assert.equal(result.salesPostListHandled, false);
  assert.equal(updated.step, 'awaiting_delivery_neighborhood');
});
test('list and model price requests interrupt pending WhatsApp location', async () => {
  for (const text of ['Me manda a lista de modelos', 'Qual o valor do Redmi 15?']) {
    const { result, state: updated } = await post('awaiting_delivery_location', text, null, { deliveryNeighborhood: 'Fixture Bairro' });
    assert.equal(result.salesPostListHandled, false);
    assert.equal(result.collectionInterruption, 'product');
    assert.equal(result.intencao, 'vendas_produtos');
    assert.equal(updated.step, 'awaiting_delivery_location');
    assert.equal(updated.orderDraft.deliveryNeighborhood, 'Fixture Bairro');
    assert.ok(!result.output.includes('localização'));
  }
});
test('question cannot become customer full name or written address', async () => {
  for (const step of ['awaiting_customer_full_name', 'awaiting_delivery_address_text', 'awaiting_delivery_number_complement']) {
    const { result, state: updated } = await post(step, 'Qual o prazo da entrega?');
    assert.equal(result.salesPostListHandled, false);
    assert.equal(updated.step, step);
    assert.equal(updated.orderDraft.customer?.fullName, undefined);
    assert.equal(updated.orderDraft.deliveryAddress, undefined);
    assert.equal(updated.orderDraft.deliveryNumberComplement, undefined);
  }
});
test('canonical resolver routes a product interruption to search, never back to collection', async () => {
  const { result, data, source } = await post('awaiting_delivery_location', 'Qual o valor do Redmi 15?');
  const $ = () => ({ first: () => ({ json: source }) });
  const resolved = new Function('$json', '$', '$getWorkflowStaticData', nodeCode('Resolver Acao de Conversacao'))(result, $, () => data);
  assert.equal(resolved[0].json.conversationAction, 'buscar_produto');
  const question = await post('awaiting_delivery_neighborhood', 'Te que horas vc pode entrega celular');
  const generic = new Function('$json', '$', '$getWorkflowStaticData', nodeCode('Resolver Acao de Conversacao'))(question.result, $, () => question.data);
  assert.equal(generic[0].json.conversationAction, 'perguntar_esclarecimento');
});
test('valid registration full name and CPF continue the existing owner', async () => {
  const name = await post('awaiting_customer_full_name', 'Cliente Teste Exemplo', { decision: 'field_value', confidence: 0.95 });
  assert.equal(name.state.step, 'awaiting_customer_cpf');
  const cpf = await post('awaiting_customer_cpf', '00000000000', { decision: 'field_value', confidence: 0.95 });
  assert.equal(cpf.state.step, 'awaiting_customer_birthdate');
});
test('failed and stale state writes never reach sending', () => {
  for (const response of [{ error: 'network' }, { control: {} }, { control: {}, conversationStateWrite: { applied: false, reason: 'stale_or_duplicate_event' } }])
    assert.deepEqual(restore(response, { remoteJid: JID, conversation: 'sim' }).output, []);
});
test('agent-only output retains latest inbound and rebased revision in persistence', () => {
  const source = { remoteJid: JID, conversation: 'Qual o prazo?', conversationStateRevision: 4, conversationStateEventVersion: 1700000000000002 };
  const data = { salesPostList: { [JID]: state('awaiting_delivery_neighborhood') } };
  let sourceRun;
  const $ = (name) => ({ first: (branch, run) => {
    if (name === 'Vendas - Verificar Pos Lista') { sourceRun = run; return { json: source }; }
    return { json: { conversationStateRevision: 1 } };
  } });
  const output = new Function('$json', '$', '$getWorkflowStaticData', '$runIndex', nodeCode('Estado Conversa - Preparar'))({ output: 'Resposta atual' }, $, () => data, 1);
  assert.equal(sourceRun, 1);
  assert.equal(output[0].json.conversation, source.conversation);
  assert.equal(output[0].json.output, 'Resposta atual');
  assert.equal(output[0].json.conversationStatePersistRequest.expectedRevision, 4);
});
test('CAS conflict rehydrates canonical state and preserves new inbound for bounded rebase', async () => {
  const canonical = state('awaiting_delivery_location', { deliveryNeighborhood: 'Fixture Bairro' });
  const prepared = { remoteJid: JID, conversation: 'Qual o valor do Redmi 15?', conversationStateEventVersion: 1700000000000001,
    conversationStateRevision: 1, salesPostListHandled: true, needsDeliveryCepLookup: true, output: 'obsolete' };
  const response = { control: { conversation_state_revision: 2, conversation_state: { salesPostList: canonical } },
    conversationStateWrite: { applied: false, reason: 'revision_conflict' } };
  const { output, storage, runIndex } = restore(response, prepared);
  assert.equal(runIndex, 1, 'read the matching persistence run, never the first attempt');
  assert.equal(output[0].json.conversationStateRevision, 2);
  assert.equal(output[0].json.conversationStateEventVersion, prepared.conversationStateEventVersion);
  assert.equal(output[0].json.conversationStateRetryCount, 1);
  assert.equal(output[0].json.conversationStateRebase, true);
  assert.equal(output[0].json.needsDeliveryCepLookup, undefined);
  assert.equal(storage.salesPostList[JID].step, 'awaiting_delivery_location');
  assert.notEqual(storage.salesPostList[JID], canonical);
  // Rebase must use the replay's source/revision, not the initial Parse Classificacao payload.
  const $ = () => ({ first: () => ({ json: { conversation: 'old', remoteJid: JID, conversationStateRevision: 1 } }) });
  const rerun = await new Function('$json', '$', '$getWorkflowStaticData', nodeCode('Vendas - Verificar Pos Lista'))(output[0].json, $, () => storage);
  assert.equal(rerun[0].json.conversationStateRevision, 2);
  assert.equal(rerun[0].json.collectionInterruption, 'product');
});
test('rebased response exits retry route only after accepted persistence', () => {
  const prepared = { remoteJid: JID, conversation: 'Fixture Bairro', conversationStateRebase: true, conversationStateRetryCount: 1 };
  const { output } = restore({ control: { conversation_state_revision: 3 }, conversationStateWrite: { applied: true } }, prepared);
  assert.equal(output[0].json.conversationStateRebase, false);
  assert.equal(output[0].json.conversationStateRevision, 3);
  assert.deepEqual(restore({ control: {}, conversationStateWrite: { applied: false, reason: 'revision_conflict' } }, { ...prepared, conversationStateRetryCount: 2 }).output, []);
});
test('FIFO name then CPF rebases the newer field without reusing semantics of the older stage', async () => {
  const first = await post('awaiting_customer_full_name', 'Cliente Teste Exemplo', { decision: 'field_value', confidence: 0.95 });
  const newer = { remoteJid: JID, conversation: '00000000000', conversationStateEventVersion: 1700000000000002,
    collectionReply: { decision: 'other', confidence: 0.95 }, salesConversationState: { etapa: 'awaiting_customer_full_name' } };
  const rebased = restore({ control: { conversation_state_revision: 2, conversation_state: { salesPostList: first.state } },
    conversationStateWrite: { applied: false, reason: 'revision_conflict' } }, newer);
  const $ = () => ({ first: () => ({ json: newer }) });
  const output = await new Function('$json', '$', '$getWorkflowStaticData', nodeCode('Vendas - Verificar Pos Lista'))(rebased.output[0].json, $, () => rebased.storage);
  assert.equal(output[0].json.salesPostListStep, 'awaiting_customer_birthdate');
  assert.equal(output[0].json.conversationStateRevision, 2);
  assert.equal(rebased.storage.salesPostList[JID].orderDraft.customer.fullName, 'Cliente Teste Exemplo');
});
test('rejected terminal attempt cannot hand off stale summary after rebase requires another field', async () => {
  const orderContract = require('./n8n-sales-order-contract.cjs');
  const combined = orderContract.patchWorkflow(workflow);
  const canonical = state('awaiting_customer_cpf');
  const staleAttempt = { remoteJid: JID, conversation: '00000000000', orderDraft: { productId: 'obsolete-phone' },
    salesOrderNeedsHandoff: true, salesOrderSummary: 'obsolete summary', salesOrderHandoffConfirmed: true,
    requiresSpecialistHandoff: true, handoffRequested: true, productSpecialistHandoffRequested: true,
    salesPostListStep: 'awaiting_team_confirmation', output: 'obsolete confirmation' };
  const restored = restore({ control: { conversation_state_revision: 8, conversation_state: { salesPostList: canonical } },
    conversationStateWrite: { applied: false, reason: 'revision_conflict' } }, staleAttempt);
  const replay = restored.output[0].json;
  for (const key of ['salesOrderNeedsHandoff', 'salesOrderSummary', 'salesOrderHandoffConfirmed', 'requiresSpecialistHandoff',
    'handoffRequested', 'productSpecialistHandoffRequested', 'orderDraft', 'salesPostListStep']) assert.equal(replay[key], undefined, key);
  const $ = () => ({ first: () => ({ json: staleAttempt }) });
  const postCode = combined.nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const output = await new Function('$json', '$', '$getWorkflowStaticData', postCode)(replay, $, () => restored.storage);
  assert.equal(output[0].json.salesPostListStep, 'awaiting_customer_birthdate');
  assert.equal(output[0].json.salesOrderNeedsHandoff, undefined);
  assert.equal(output[0].json.salesOrderSummary, undefined);
  assert.equal(output[0].json.requiresSpecialistHandoff, undefined);
  assert.equal(output[0].json.handoffRequested, undefined);
  assert.ok(!output[0].json.output.includes('obsolete'));
});
