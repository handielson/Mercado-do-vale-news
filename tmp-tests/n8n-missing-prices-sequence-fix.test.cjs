'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, NAMES } = require('./n8n-missing-prices-sequence-fix.cjs');

const original = JSON.parse(fs.readFileSync('.local/missing-prices-workflow-before.json', 'utf8'));
const workflow = patchWorkflow(original);
const jid = '5587900000000@s.whatsapp.net';
const categoryId = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const node = (name) => workflow.nodes.find((item) => item.name === name);
const execute = (name, input = {}, sources = {}, state = {}, all = [input]) => {
  const code = node(name)?.parameters?.jsCode;
  assert.equal(typeof code, 'string');
  const lookup = (key) => {
    const values = sources[key];
    if (values === undefined) throw new Error(`Unexpected source ${key} in ${name}`);
    const list = Array.isArray(values) ? values : [values];
    return { first: () => ({ json: list[0] }), all: () => list.map((json) => ({ json })), item: { json: list[0] } };
  };
  return new Function('$json', '$input', '$', '$getWorkflowStaticData', code)(
    input, { all: () => all.map((json) => ({ json })), first: () => ({ json: input }) }, lookup, () => state,
  );
};
const products = [
  { id: 'note14-green', model_id: 'note14', model_name: 'Redmi Note 14 5G', name: 'Redmi Note 14 5G Verde', brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: 143800, specs: { ram: '6GB', storage: '128GB', color: 'Verde', display: 6.67, tipo_de_display: 'AMOLED', battery_mah: 5000, cam_principal_mpx: 108, carregamento: '33W' }, slug: 'redmi-note-14-5g', images: [] },
  { id: 'note15-purple', model_id: 'note15', model_name: 'Redmi Note 15 4G', name: 'Redmi Note 15 4G Roxo', brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: 133000, specs: { ram: '6GB', storage: '128GB', color: 'Roxo' }, slug: 'redmi-note-15-4g', images: [] },
  { id: 'other-memory', model_id: 'other', model_name: 'Redmi 15', name: 'Redmi 15 Preto', brand: 'Xiaomi', status: 'active', stock_quantity: 1, price_retail: 99900, specs: { ram: '8GB', storage: '256GB', color: 'Preto' }, slug: 'redmi-15', images: [] },
];

function prepared(messageId = 'INBOUND-1', conversation = 'Telefone com 6 gigas e 128 de armazenamento') {
  return execute('Vendas - Preparar Busca', { remoteJid: jid, messageId, conversation,
    salesRequestKind: 'categoria', salesCategoryId: categoryId, salesCategoryName: 'smartphones' })[0].json;
}
function catalog(base, state, rows = products) {
  return execute('Vendas - Contexto Produtos', {}, {
    'Vendas - Preparar Busca': base,
    'Vendas - Buscar Produtos': rows,
    'switc Mensagens': base,
  }, state, [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }])[0].json;
}

test('patch is idempotent and changes only seven existing Code nodes, not graph', () => {
  assert.deepEqual(patchWorkflow(workflow), workflow);
  assert.deepEqual(workflow.connections, original.connections);
  assert.deepEqual(workflow.nodes.map(({ name }) => name), original.nodes.map(({ name }) => name));
  for (const before of original.nodes) {
    const after = node(before.name);
    if (!NAMES.includes(before.name)) assert.deepEqual(after, before);
    else {
      const { parameters: ignoredBefore, ...restBefore } = before;
      const { parameters: ignoredAfter, ...restAfter } = after;
      assert.deepEqual(restAfter, restBefore);
    }
  }
});

test('spoken 6 gigas and 128 de armazenamento filters exact configuration, without confusing 5G', () => {
  const six = prepared();
  assert.deepEqual(six.requestedRamGb, [6]);
  assert.deepEqual(six.requestedStorageGb, [128]);
  assert.equal(six.phoneMemoryFilterRequest, true);
  const quote = catalog(six, {});
  assert.equal(quote.productLookupCount, 2);
  assert.match(quote.deterministicCatalogOutput, /Redmi Note 14 5G\[\[BR\]\]\s+✨/);
  assert.match(quote.deterministicCatalogOutput, /Redmi Note 14 5G[\s\S]*6GB\/128GB[\s\S]*1\.438,00[\s\S]*Cartão: 12x/);
  assert.match(quote.deterministicCatalogOutput, /Redmi Note 15 4G[\s\S]*6GB\/128GB[\s\S]*1\.330,00[\s\S]*Cartão: 12x/);
  assert.doesNotMatch(quote.deterministicCatalogOutput, /Redmi 15 Preto/);
  const network = prepared('INBOUND-2', 'Telefone 5G com 6 gigas e 128 de armazenamento');
  assert.deepEqual(network.requestedRamGb, [6]);
  assert.deepEqual(network.requestedStorageGb, [128]);
  assert.equal(network.requestedNetwork, '5g');
  const bare = prepared('INBOUND-3', 'Telefone 6GB/128GB');
  assert.deepEqual(bare.requestedRamGb, [6]);
  assert.deepEqual(bare.requestedStorageGb, [128]);
  assert.equal(prepared('INBOUND-4', 'Fone Bluetooth 6GB').phoneMemoryFilterRequest, false);
});

test('outbound splitter carries catalog provenance and real send coordinates', () => {
  const source = { remoteJid: jid, messageId: 'INBOUND-1', output: '1. Redmi Note 14 5G[[BR]]💰 R$ 1.438,00[[MSG]]Qual modelo?',
    deterministicCatalogOutput: '1. Redmi Note 14 5G[[BR]]💰 R$ 1.438,00[[MSG]]Qual modelo?' };
  const items = execute('Dividir mensagens', source, {
    'Resolver Acao de Conversacao': source,
    'switc Mensagens': source,
    'Contato - Resolver': source,
    'Contato - Preparar': source,
  });
  assert.ok(items.length >= 2);
  for (const [index, item] of items.entries()) {
    assert.equal(item.json.catalogDeliveryCandidateV1, true);
    assert.equal(item.json.inboundWaMessageId, 'INBOUND-1');
    assert.equal(item.json.messageIndex, index + 1);
    assert.equal(item.json.totalMessages, items.length);
  }
  const ordinary = execute('Dividir mensagens', { ...source, output: 'Tudo bem?', deterministicCatalogOutput: '' }, {
    'Resolver Acao de Conversacao': source, 'switc Mensagens': source,
    'Contato - Resolver': source, 'Contato - Preparar': source,
  });
  assert.equal(ordinary[0].json.catalogDeliveryCandidateV1, false);
});

test('six matching models remain split into three WhatsApp messages with card prices', () => {
  const six = Array.from({ length: 6 }, (_, index) => ({
    id: `phone-${index}`, model_id: `model-${index}`, model_name: `Redmi Modelo ${index + 1}`,
    name: `Redmi Modelo ${index + 1} Preto`, brand: 'Xiaomi', status: 'active', stock_quantity: 1,
    price_retail: 100000 + index * 10000,
    specs: { ram: '6GB', storage: '128GB', color: 'Preto' }, slug: `redmi-modelo-${index + 1}`, images: [],
  }));
  const base = prepared();
  const quote = catalog(base, {}, six);
  const splitterInput = { ...quote, messageId: 'INBOUND-1', remoteJid: jid, output: quote.deterministicCatalogOutput };
  const messages = execute('Dividir mensagens', splitterInput, {
    'Resolver Acao de Conversacao': base,
    'switc Mensagens': base,
    'Contato - Resolver': base,
    'Contato - Preparar': base,
  });
  assert.equal(messages.length, 3);
  assert.match(messages[0].json.message, /1\. Redmi Modelo 1[\s\S]*💰[\s\S]*💳 Cartão: 12x/);
  assert.match(messages[1].json.message, /4\. Redmi Modelo 4[\s\S]*💰[\s\S]*💳 Cartão: 12x/);
  assert.match(messages[2].json.message, /Qual modelo/);
});

test('late Quais vc tem? permits compatible pending catalog but cancellation and unrelated turn still stop it', () => {
  const originalItem = { remoteJid: jid, inboundWaMessageId: 'INBOUND-1', conversation: 'Telefone com 6 gigas e 128 de armazenamento', conversationAction: 'listar_catalogo', salesCategoryId: categoryId };
  const run = (text, id = 'INBOUND-2') => execute('Controle Bot - Aplicar mensagem atual', {}, {
    'Loop - Enviar mensagens em ordem': originalItem,
  }, {}, [{ rows: [{ direction: 'inbound', wa_message_id: id, message_text: text }] }]);
  assert.equal(run('Quais vc tem?').length, 1);
  assert.equal(run('Quais modelos tem?').length, 1);
  assert.equal(run('Não quero mais').length, 0);
  assert.equal(run('Obrigado, até amanhã').length, 0);
});

test('rebase of unsent list does not suppress quote; actual final Evolution acknowledgement enables suppression', () => {
  const base = prepared();
  const state = {};
  const first = catalog(base, state);
  assert.match(first.deterministicCatalogOutput, /R\$\s*1\.438,00/);
  const second = catalog({ ...base, conversationStateRebase: true }, state);
  assert.match(second.deterministicCatalogOutput, /R\$\s*1\.438,00/);
  const pending = state.salesPostList[jid];
  assert.equal(pending.preparedForInboundWaMessageId, 'INBOUND-1');
  const finalItem = { remoteJid: jid, inboundWaMessageId: 'INBOUND-1', catalogDeliveryCandidateV1: true, messageIndex: 3, totalMessages: 3 };
  execute('Handoff - Registrar bot enviado', {}, { 'Loop - Enviar mensagens em ordem': finalItem }, state, [{ key: { id: 'WA-3' } }]);
  assert.ok(state.catalogDeliveryAcceptedV1[jid]['INBOUND-1']);
  const next = catalog({ ...prepared('INBOUND-2', 'Obrigado'), conversation: 'Obrigado' }, state);
  assert.equal(next.deterministicCatalogOutput, '');
});

test('failed or partial Evolution send never marks catalog presented', () => {
  const base = prepared();
  const state = {};
  catalog(base, state);
  const item = { remoteJid: jid, inboundWaMessageId: 'INBOUND-1', catalogDeliveryCandidateV1: true, messageIndex: 1, totalMessages: 3 };
  execute('Handoff - Registrar bot enviado', {}, { 'Loop - Enviar mensagens em ordem': item }, state, [{ key: { id: 'WA-1' } }]);
  assert.equal(state.catalogDeliveryAcceptedV1, undefined);
  execute('Handoff - Registrar bot enviado', {}, { 'Loop - Enviar mensagens em ordem': { ...item, messageIndex: 3 } }, state, [{}]);
  assert.equal(state.catalogDeliveryAcceptedV1, undefined);
  assert.match(catalog({ ...base, messageId: 'INBOUND-2' }, state).deterministicCatalogOutput, /R\$\s*1\.330,00/);
});

test('concurrent first catalog ACK after second run prepared state suppresses second rebase', () => {
  const state = {};
  const first = prepared('INBOUND-1');
  const second = prepared('INBOUND-2', 'Quais vc tem?');
  catalog(first, state);
  catalog({ ...second, conversationStateRebase: true }, state);
  assert.equal(state.salesPostList[jid].preparedForInboundWaMessageId, 'INBOUND-2');
  execute('Handoff - Registrar bot enviado', {}, {
    'Loop - Enviar mensagens em ordem': { remoteJid: jid, inboundWaMessageId: 'INBOUND-1', catalogDeliveryCandidateV1: true, messageIndex: 3, totalMessages: 3 },
  }, state, [{ response: { message: { key: { id: 'WA-ACK-FIRST' } } } }]);
  assert.ok(state.catalogDeliveryAcceptedV1[jid]['INBOUND-1']);
  const replay = catalog({ ...second, conversationStateRebase: true }, state);
  assert.equal(replay.deterministicCatalogOutput, '');
});

test('first catalog ACK before second rebase also prevents a duplicate follow-up list', () => {
  const state = {};
  const first = prepared('INBOUND-1');
  catalog(first, state);
  execute('Handoff - Registrar bot enviado', {}, {
    'Loop - Enviar mensagens em ordem': { remoteJid: jid, inboundWaMessageId: 'INBOUND-1', catalogDeliveryCandidateV1: true, messageIndex: 3, totalMessages: 3 },
  }, state, [{ key: { id: 'WA-ACK-FIRST' } }]);
  const second = prepared('INBOUND-2', 'Quais vc tem?');
  const replay = catalog({ ...second, conversationStateRebase: true }, state);
  assert.equal(replay.deterministicCatalogOutput, '');
});

test('Pix lowest-price follow-up routes to contextual sales, while generic Pix methods stay generic', () => {
  const state = {};
  catalog(prepared(), state);
  const run = (conversation) => execute('Resolver Acao de Conversacao', {
    remoteJid: jid, conversation, output: '', intencao: 'formas_pagamento',
  }, { 'switc Mensagens': { remoteJid: jid, conversation } }, state)[0].json;
  const lowest = run('No Pix, menor valor?');
  assert.equal(lowest.conversationIntent, 'negociacao_preco_pix');
  assert.equal(lowest.conversationAction, 'calcular_parcelamento');
  assert.match(lowest.aiResponseGuidance, /valores cadastrados/);
  const values = run('Valores?');
  assert.equal(values.conversationAction, 'calcular_parcelamento');
  assert.equal(values.conversationIntent, 'preco_catalogo');
  const switchNode = node('Switch Especialistas');
  const posListIndex = switchNode.parameters.rules.values.findIndex((rule) => rule.conditions.conditions.some((condition) => condition.rightValue === 'calcular_parcelamento'));
  assert.ok(posListIndex >= 0);
  assert.equal(workflow.connections['Switch Especialistas'].main[posListIndex][0].node, 'Vendas - Buscar Configuracoes Loja');
  const generic = run('Quais formas de pagamento aceitam? Tem Pix?');
  assert.notEqual(generic.conversationIntent, 'negociacao_preco_pix');
  const withoutState = execute('Resolver Acao de Conversacao', { remoteJid: jid,
    conversation: 'No Pix, menor valor?', intencao: 'formas_pagamento' },
  { 'switc Mensagens': { remoteJid: jid, conversation: 'No Pix, menor valor?' } }, {})[0].json;
  assert.equal(withoutState.conversationIntent, 'negociacao_preco_pix_sem_contexto');
  assert.match(withoutState.aiResponseGuidance, /Pergunte qual modelo/);
});

test('two-turn Valores? and No Pix, menor valor? quote exact Pix/card prices from selected configurations', async () => {
  const base = prepared();
  const state = {};
  const first = catalog(base, state);
  assert.match(first.deterministicCatalogOutput, /6GB\/128GB/);
  const recentMessages = [{ direction: 'outbound', text: 'O Redmi Note 14 5G e o Redmi Note 15 4G atendem ao pedido.' }];
  const answer = async (conversation) => (await execute('Vendas - Verificar Pos Lista', {}, {
    'Parse Classificacao': { remoteJid: jid, conversation, recentMessages },
  }, state))[0].json;
  const prices = await answer('Valores?');
  assert.equal(prices.salesPostListHandled, true);
  assert.match(prices.output, /Redmi Note 14 5G\[\[BR\]\]\s+✨[^\[]+/);
  assert.match(prices.output, /Redmi Note 14 5G[\s\S]*6GB\/128GB[\s\S]*R\$\s*1\.438,00[\s\S]*12x de R\$\s*134,09/);
  assert.match(prices.output, /Redmi Note 15 4G[\s\S]*6GB\/128GB[\s\S]*R\$\s*1\.330,00[\s\S]*12x de R\$\s*124,02/);
  assert.match(prices.output, /🎨 Cores: Verde/);
  assert.match(prices.output, /🎨 Cores: Roxo/);
  assert.equal((prices.output.match(/━━━━━━━━━━━━━━━━━━━━━━/g) || []).length, 2);
  const lower = await answer('No Pix, menor valor?');
  assert.equal(lower.salesPostListHandled, true);
  assert.match(lower.output, /menor preço cadastrado no Pix é R\$\s*1\.330,00 no Redmi Note 15 4G/);
  assert.doesNotMatch(lower.output, /formas? de pagamento|PayJoy|desconto de R\$/i);
  const unrelated = await answer('Quais formas de pagamento aceitam?');
  assert.notEqual(unrelated.output, lower.output);
});

test('price follow-up in a broad catalog quotes only models named in the last outbound context', async () => {
  const state = {};
  catalog(prepared(), state);
  const options = state.salesPostList[jid].options;
  state.salesPostList[jid].options = [...options, ...Array.from({ length: 6 }, (_, index) => ({
    number: index + 3, name: `Outro Modelo ${index}`, memory: '8GB/256GB',
    price: 'R$ 999,00', priceCents: 99900, card: { installment: 'R$ 93,00', total: 'R$ 1.116,00' },
  }))];
  const source = { remoteJid: jid, conversation: 'No Pix, menor valor?', recentMessages: [
    { direction: 'outbound', text: 'O Redmi Note 14 5G e o Redmi Note 15 4G atendem ao pedido.' },
  ] };
  const answer = (await execute('Vendas - Verificar Pos Lista', {}, { 'Parse Classificacao': source }, state))[0].json;
  assert.equal(answer.salesPostListHandled, true);
  assert.match(answer.output, /R\$\s*1\.438,00/);
  assert.match(answer.output, /R\$\s*1\.330,00/);
  assert.doesNotMatch(answer.output, /Outro Modelo|R\$\s*999,00/);
});
