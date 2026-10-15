'use strict';
// Offline contract tests execute the supplied workflow's real Code nodes. External
// services and the model are fixtures; no patch module is imported by this suite.
// Run: $env:MDV_N8N_SALES_SNAPSHOT='.local/n8n-sales-candidate.json'; node --test tmp-tests/n8n-sales-end-to-end.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
assert.ok(snapshot, 'MDV_N8N_SALES_SNAPSHOT must identify the exact exported candidate; no silent skip or auto-patching');
const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const nodes = new Map(workflow.nodes.map(node => [node.name, node]));
const jid = '5587990000000@s.whatsapp.net'; // synthetic, never a customer
const clone = value => JSON.parse(JSON.stringify(value));
function execute(name, input = {}, sources = {}, state = {}, all = [input]) {
  const code = nodes.get(name)?.parameters?.jsCode;
  assert.equal(typeof code, 'string', `Missing executable Code node: ${name}`);
  const lookup = source => {
    assert.ok(Object.hasOwn(sources, source), `Unmocked upstream node ${source} from ${name}`);
    const values = Array.isArray(sources[source]) ? sources[source] : [sources[source]];
    return { first: () => ({ json: values[0] }), all: () => values.map(json => ({ json })), item: { json: values[0] } };
  };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', '$execution', '$runIndex', code)(
    input, { all: () => all.map(json => ({ json })), first: () => ({ json: input }) }, lookup, () => state, { id: '900001' }, 0);
}
const product = (id, model, ram, storage, color, price) => ({ id, model_id: model, model_name: model,
  name: `${model} ${color}`, brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: price,
  specs: { ram, storage, color }, slug: id, images: [] });
const products = [product('fixture-black128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900),
  product('fixture-purple256', 'Redmi 15', '8GB', '256GB', 'Roxo', 122400),
  product('fixture-black256', 'Redmi 15', '8GB', '256GB', 'Preto', 122400),
  product('fixture-15c', 'Redmi 15C', '8GB', '256GB', 'Verde', 113200)];
function catalog() {
  const state = {};
  const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid };
  const result = execute('Vendas - Contexto Produtos', {}, { 'Vendas - Preparar Busca': base,
    'Vendas - Buscar Produtos': clone(products), 'switc Mensagens': base }, state,
  [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }])[0].json;
  return { state, result };
}
// Model the persisted shape issued by v626. Only fixture state is merged;
// every runtime Code node still comes unchanged from the exact candidate.
function legacyGroupedCatalog() {
  const {state,result}=catalog();
  const options=state.salesPostList[jid].options;
  const configurations=options.filter(option=>option.name==='Redmi 15');
  assert.equal(configurations.length,2,'new catalogs must separate physical memory');
  const family={...configurations[0],number:1,
    memory:configurations.map(option=>option.memory).join(' / '),
    memoryOptions:configurations.flatMap(option=>option.memoryOptions),
    colors:configurations.flatMap(option=>option.colors)};
  state.salesPostList[jid].options=[family,...options.filter(option=>option.name!=='Redmi 15').map((option,index)=>({...option,number:index+2}))];
  return {state,result};
}
function optionFor(state,productId) {
  const option=state.salesPostList[jid].options.find(option=>option.colors.some(color=>color.productId===productId));
  assert.ok(option,'fixture SKU must exist in a numbered option');
  return option;
}
async function say(state, conversation, extra = {}) {
  const source = { remoteJid: jid, conversation, salesFlowAction: 'indefinido', ...extra };
  return (await execute('Vendas - Verificar Pos Lista', {}, { 'Parse Classificacao': source }, state))[0]?.json;
}
function collecting(step) {
  const { state } = catalog();
  Object.assign(state.salesPostList[jid], { step, selectedOptionNumber: optionFor(state,'fixture-purple256').number, orderDraft: {
    productId: 'fixture-purple256', name: 'Redmi 15', memory: '8GB/256GB', color: 'Roxo', price: 'R$ 1.224,00',
    unitPriceCents: 122400, quantity: 1, fulfillment: 'delivery', deliveryNeighborhood: 'Centro' } });
  return state;
}
const field = { collectionReply: { decision: 'field_value', confidence: 0.99 } };

test('exact workflow acknowledges only a delivered team notification, never a concurrent claim', () => {
  const source = {salesOrderNeedsHandoff:true,output:'Vou solicitar à equipe a confirmação da disponibilidade.'};
  const run = adminNotification => execute('Handoff - Retomar resposta solicitada', {adminNotification}, {'Atendente - Horario':source})[0].json;
  assert.equal(run({notified:true,code:'TEST'}).salesOrderHandoffConfirmed,true);
  const duplicate = run({notified:false,duplicate:true,deliveryConfirmed:true,code:'TEST'});
  assert.equal(duplicate.salesOrderHandoffConfirmed,true);
  assert.match(duplicate.output,/já foi avisada sobre este atendimento.*ainda precisam de confirmação/);
  for(const receipt of [{notified:false,duplicate:true,deliveryConfirmed:false,code:'TEST'},{notified:false,duplicate:true,code:'TEST'},{}]) {
    const result = run(receipt);
    assert.equal(result.salesOrderHandoffConfirmed,false);
    assert.match(result.output,/não consegui confirmar/);
  }
});

test('export graph has no missing nodes and state persistence precedes outbound splitting', () => {
  for (const [source, connections] of Object.entries(workflow.connections)) {
    assert.ok(nodes.has(source), `Dangling source ${source}`);
    for (const outputs of Object.values(connections)) for (const output of outputs) for (const edge of output)
      assert.ok(nodes.has(edge.node), `Dangling target ${edge.node}`);
  }
  const targets = name => (workflow.connections[name]?.main || []).flat().map(edge => edge.node);
  assert.ok(targets('Estado Conversa - Preparar').includes('Estado Conversa - Persistir'));
  assert.ok(targets('Estado Conversa - Persistir').includes('Estado Conversa - Restaurar'));
  assert.ok(!targets('Estado Conversa - Persistir').includes('Dividir mensagens'));
});

test('AI context keeps each memory/color/price relation separate from another model', () => {
  const { result } = catalog();
  const lines = result.productsContext.split('\n');
  const small = lines.find(line => /Redmi 15\b/.test(line) && /6GB\/128GB/.test(line));
  assert.ok(small); assert.match(small, /999,00/); assert.doesNotMatch(small, /Roxo|1\.224,00|8GB\/256GB/);
  const large = lines.find(line => /Redmi 15\b/.test(line) && /8GB\/256GB/.test(line));
  assert.ok(large); assert.match(large, /1\.224,00/); assert.doesNotMatch(large, /1\.132,00/);
});

test('purple selection binds product ID, memory and price to the same variant', async () => {
  const { state } = catalog();
  const number=optionFor(state,'fixture-purple256').number;
  state.salesPostList[jid].selectedOptionNumber = number;
  const result = await say(state, 'Roxo', { salesFlowAction: 'escolher_cor', salesFlowItemNumber: number, salesFlowColor: 'Roxo' });
  assert.equal(result.orderDraft.productId, 'fixture-purple256');
  assert.equal(result.orderDraft.memory, '8GB/256GB');
  assert.equal(result.orderDraft.unitPriceCents, 122400);
});

test('new numbered catalog selects each configuration and exact SKU without memory ambiguity',async()=>{
  for(const [number,color,id,memory,price] of [[1,'Preto','fixture-black128','6GB/128GB',99900],[2,'Preto','fixture-black256','8GB/256GB',122400],[2,'Roxo','fixture-purple256','8GB/256GB',122400]]) {
    const {state,result}=catalog();
    assert.equal(result.productLookupCount,3);
    assert.deepEqual(state.salesPostList[jid].options.map(option=>[option.number,option.name,option.memory]),
      [[1,'Redmi 15','6GB/128GB'],[2,'Redmi 15','8GB/256GB'],[3,'Redmi 15C','8GB/256GB']]);
    const choice=await say(state,String(number),{salesFlowAction:'escolher_item',salesFlowItemNumber:number});
    const selected=choice.orderDraft ? choice : await say(state,color,{salesFlowAction:'escolher_cor',salesFlowItemNumber:number,salesFlowColor:color});
    assert.equal(selected.orderDraft.productId,id);
    assert.equal(selected.orderDraft.memory,memory);
    assert.equal(selected.orderDraft.unitPriceCents,price);
    assert.equal(selected.orderDraft.color,color);
    assert.equal(state.salesPostList[jid].selectedOptionNumber,number);
    assert.equal(selected.salesPostListStep,'awaiting_purchase_confirmation');
  }
});

test('legacy same color in two memories asks configuration before drafting', async () => {
  const { state } = legacyGroupedCatalog();
  state.salesPostList[jid].selectedOptionNumber = 1;
  const ambiguous = await say(state, 'Preto', { salesFlowAction: 'escolher_cor', salesFlowItemNumber: 1, salesFlowColor: 'Preto' });
  assert.equal(ambiguous.orderDraft, undefined); assert.equal(ambiguous.salesPostListStep, 'awaiting_memory');
  const exact = await say(state, '256');
  assert.equal(exact.orderDraft.productId, 'fixture-black256'); assert.equal(exact.orderDraft.unitPriceCents, 122400);
});

test('legacy unavailable color/memory never silently chooses another variant', async () => {
  const { state } = legacyGroupedCatalog();
  state.salesPostList[jid].selectedOptionNumber = 1;
  const result = await say(state, '128 roxo', { salesFlowAction: 'escolher_cor', salesFlowItemNumber: 1, salesFlowColor: 'Roxo' });
  assert.equal(result.orderDraft, undefined); assert.match(result.output, /não está disponível/);
});

test('model-generated wrong price cannot precede official catalog', () => {
  const { result, state } = catalog();
  const composed = execute('Vendas - Compor Resposta IA', { output: 'O Redmi 15 8GB/256GB custa R$ 1.132,00.' },
    { 'Vendas - Contexto Produtos': result }, state)[0].json;
  assert.equal(composed.output, result.deterministicCatalogOutput);
});

test('neighborhood then card question preserves neighborhood and pending location', async () => {
  const state = collecting('awaiting_delivery_neighborhood');
  await say(state, 'José e Maria', field);
  assert.equal(state.salesPostList[jid].orderDraft.deliveryNeighborhood, 'José e Maria');
  const result = await say(state, 'Só que ia passar cartão');
  assert.equal(state.salesPostList[jid].step, 'awaiting_delivery_location');
  assert.equal(state.salesPostList[jid].orderDraft.deliveryNeighborhood, 'José e Maria');
  assert.equal(result.salesPostListHandled, false);
  assert.equal(result.collectionInterruption, 'question');
});

test('card question when neighborhood is missing never becomes neighborhood', async () => {
  const state = collecting('awaiting_delivery_neighborhood');
  const result = await say(state, 'Só que ia passar cartão');
  assert.equal(state.salesPostList[jid].step, 'awaiting_delivery_neighborhood');
  assert.equal(state.salesPostList[jid].orderDraft.deliveryNeighborhood, 'Centro');
  assert.equal(result.salesPostListHandled, false);
});

test('product request interrupts address collection without consuming text as address', async () => {
  const state = collecting('awaiting_delivery_address_text');
  const result = await say(state, 'Manda a lista de celulares disponíveis');
  assert.equal(state.salesPostList[jid].orderDraft.deliveryAddress, undefined);
  assert.equal(state.salesPostList[jid].step, 'awaiting_delivery_address_text');
  assert.equal(result.salesPostListHandled, false); assert.equal(result.collectionInterruption, 'product');
});

test('delivery time question does not become name, number or address', async () => {
  for (const step of ['awaiting_customer_full_name', 'awaiting_delivery_number_complement', 'awaiting_delivery_address_text']) {
    const state = collecting(step); const draft = clone(state.salesPostList[jid].orderDraft);
    const result = await say(state, 'Até que horas você pode entregar o celular?');
    assert.equal(result.salesPostListHandled, false, step);
    assert.deepEqual(state.salesPostList[jid].orderDraft, draft, step);
  }
});

test('sim followed by pode cannot populate an address or customer field', async () => {
  const state = collecting('awaiting_delivery_address_confirmation');
  state.salesPostList[jid].orderDraft.deliveryAddress = { street: 'Rua Exemplo', neighborhood: 'Centro', city: 'Petrolina', state: 'PE' };
  await say(state, 'sim', field);
  const before = clone(state.salesPostList[jid].orderDraft);
  await say(state, 'pode', { collectionReply: { decision: 'other', confidence: 0.99 } });
  assert.deepEqual(state.salesPostList[jid].orderDraft, before);
});

test('state write failure suppresses an answer describing unsaved progress', () => {
  const state = collecting('awaiting_payment_method');
  const prepared = { remoteJid: jid, conversation: 'sim', output: 'Pedido confirmado!' };
  const result = execute('Estado Conversa - Restaurar', { conversationStateWrite: { applied: false, reason: 'stale_event' },
    control: { conversation_state_revision: 8, conversation_state: {} } }, { 'Estado Conversa - Preparar': prepared }, state);
  assert.deepEqual(result, []);
});

test('revision conflict replays current short message on canonical predecessor state', async () => {
  const state = collecting('awaiting_delivery_neighborhood');
  const persisted = clone(state.salesPostList[jid]);
  persisted.step = 'awaiting_delivery_location'; persisted.orderDraft.deliveryNeighborhood = 'José e Maria';
  const restored = execute('Estado Conversa - Restaurar', { conversationStateWrite: { applied: false, reason: 'revision_conflict' },
    control: { conversation_state_revision: 10, conversation_state: { salesPostList: persisted } } },
  { 'Estado Conversa - Preparar': { remoteJid: jid, conversation: 'Só que ia passar cartão', output: 'bairro errado' } }, state);
  assert.equal(restored[0]?.json.conversationStateRebase, true);
  assert.equal(restored[0]?.json.output, '');
  assert.equal(state.salesPostList[jid].orderDraft.deliveryNeighborhood, 'José e Maria');
  const replayed = (await execute('Vendas - Verificar Pos Lista', restored[0].json, {}, state))[0].json;
  assert.equal(replayed.collectionInterruption, 'question');
  assert.equal(state.salesPostList[jid].step, 'awaiting_delivery_location');
});

test('human handoff is still blocked after hydrating conversation state', () => {
  const state = {};
  const result = execute('Controle Bot - Aplicar Controle', { humanHandoffPaused: true,
    control: { human_handoff_active: true } }, { 'Controle Bot - Verificar Cliente': { remoteJid: jid } }, state)[0].json;
  assert.equal(result.n8nBotBlocked, true); assert.equal(result.humanHandoffPaused, true);
});

test('final registration acknowledgement requires a real order or specialist handoff', async () => {
  const state = collecting('awaiting_customer_phone_confirm');
  state.salesPostList[jid].orderDraft.customer = { fullName: 'Pessoa Exemplo', birthdate: '01/01/1990' };
  const result = await say(state, 'sim', field);
  const actualOrder = Boolean(result.orderId || result.orderNumber || result.orderDraft?.orderId);
  assert.ok(actualOrder || result.requiresSpecialistHandoff === true || result.humanHandoffRequested === true,
    'Finishing a local draft must actually route it to the team or refer to a created order');
  if (!actualOrder) assert.notEqual(state.salesPostList[jid].step, 'order_completed', 'A draft is not a completed order');
  if (!actualOrder) {
    assert.equal(result.salesOrderNeedsHandoff, true);
    assert.equal(workflow.connections['Estado Conversa - Rebase necessario?']?.main?.[1]?.[0]?.node,
      'Vendas - Pedido precisa equipe?', 'Accepted persisted draft must traverse the team gate');
    assert.equal(workflow.connections['Vendas - Pedido precisa equipe?']?.main?.[0]?.[0]?.node, 'Atendente - Horario');
    assert.equal(workflow.connections['Atendente - Horario']?.main?.[0]?.[0]?.node, 'Handoff - Persistir solicitado');
  }
});

test('rebase retries are bounded and missing acknowledgement fails closed', () => {
  for (const input of [{}, { conversationStateWrite: { applied: false, reason: 'revision_conflict' },
    control: { conversation_state_revision: 10, conversation_state: {} } }]) {
    const result = execute('Estado Conversa - Restaurar', input, { 'Estado Conversa - Preparar': {
      remoteJid: jid, conversation: 'sim', output: 'não enviar', conversationStateRetryCount: 2 } }, {});
    assert.deepEqual(result, []);
  }
});

test('installment resolver applies fees to selected exact price', () => {
  const state = collecting('awaiting_payment_method');
  const source = { remoteJid: jid, orderDraft: state.salesPostList[jid].orderDraft, needsPaymentOptionsLookup: true };
  const fees = Array.from({ length: 12 }, (_, index) => ({ channel: 'presencial', installments: index + 1, applied_fee_pct: 10 }));
  const result = execute('Vendas - Resolver Parcelamento', {}, { 'Vendas - Verificar Pos Lista': source }, state, fees)[0].json;
  assert.equal(result.orderDraft.unitPriceCents, 122400);
  assert.equal(result.orderDraft.cardBaseCents, 122400);
  assert.equal(result.orderDraft.cardInstallmentOptions.length, 12);
  assert.equal(result.orderDraft.cardInstallmentOptions[11].totalCents, 134640);
});

test('payment list and contextual PayJoy acceptance preserve exact selected device', () => {
  const state = collecting('awaiting_purchase_confirmation');
  const original = clone(state.salesPostList[jid].orderDraft);
  const config = { payjoy_analysis_url: 'https://www.payjoy.com/br/fixture-analysis' };
  const payment = text => execute('Pagamento - Politica', config,
    { 'Resolver Acao de Conversacao': { remoteJid: jid, conversation: text,
      payjoyLinkReply: { decision: 'accept', confidence: 0.99 } } }, state)[0].json;
  const first = payment('Quais formas de pagamento?');
  for (const method of ['Pix', 'Transferência', 'Dinheiro', 'débito', 'crédito', 'Boleto']) assert.ok(first.output.includes(method), method);
  const accepted = payment('sim pode enviar');
  assert.ok(accepted.output.includes(config.payjoy_analysis_url));
  assert.deepEqual(state.salesPostList[jid].orderDraft, original);
});
