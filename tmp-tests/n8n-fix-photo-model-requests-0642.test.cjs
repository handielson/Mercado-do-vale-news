'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, NODE_NAME, PARSER_NAME, MARKER, CATEGORY_ID } = require('./n8n-fix-photo-model-requests-0642.cjs');

const snapshot = process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT;
assert.ok(snapshot, 'Set MDV_PAYJOY_WORKFLOW_SNAPSHOT to the current workflow candidate');
const original = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const candidate = patchWorkflow(original);
const code = candidate.nodes.find(node => node.name === NODE_NAME).parameters.jsCode;
const parserCode = candidate.nodes.find(node => node.name === PARSER_NAME).parameters.jsCode;
const execute = new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', code);
const image = name => `https://api.xiaomipetrolina.com.br/images/${name}.jpg`;
const product = (name, category = CATEGORY_ID) => ({
  id: `fixture-${name}`, model_id: `model-${name}`, category_id: category,
  name, slug: name.toLowerCase().replace(/\s+/g, '-'), sku: `SKU-${name}`,
  status: 'active', hide_from_catalog: 0, track_inventory: 1, stock_quantity: 2,
  price_retail: 266000, images: [image(name.toLowerCase().replace(/\s+/g, '-'))],
  specs: { ram: '8GB', storage: '256GB', color: 'Preto' },
});
const x7 = product('Poco X7 Pro 5G');
const x8 = product('Poco X8 Pro 5G');
const accessory = product('Capa para Poco X7 Pro 5G', 'accessory-category');

async function run(conversation, salesSearchQuery, responses, feeRows = [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }]) {
  const source = { remoteJid: 'fixture@s.whatsapp.net', conversation,
    salesFlowAction: 'pedir_foto', salesSearchQuery, salesRequestKind: 'busca' };
  const calls = [];
  let feeCalls = 0;
  const lookup = () => ({ first: () => ({ json: source }), all: () => [{ json: source }] });
  const result = await execute({}, {}, () => ({}), lookup, {}, {
    httpRequest: async request => {
      const url = new URL(request.url);
      if (url.pathname === '/payment-fees') {
        feeCalls += 1;
        if (feeRows instanceof Error) throw feeRows;
        return feeRows;
      }
      calls.push(url);
      assert.equal(url.searchParams.get('category'), CATEGORY_ID);
      assert.equal(url.searchParams.has('category_id'), false);
      assert.equal(url.searchParams.get('limit'), '200');
      return responses(url.searchParams.get('search'));
    },
  });
  return { output: result[0].json, calls, feeCalls };
}

test('patch is confined to the existing node and idempotent', () => {
  assert.deepEqual(candidate.connections, original.connections);
  assert.equal(candidate.nodes.length, original.nodes.length);
  assert.deepEqual(patchWorkflow(candidate), candidate);
  for (const node of original.nodes) {
    const updated = candidate.nodes.find(other => other.id === node.id);
    if (node.name !== NODE_NAME && node.name !== PARSER_NAME) assert.deepEqual(updated, node);
  }
  assert.ok(code.includes(MARKER));
  assert.doesNotMatch(code, /Nao encontrei esse modelo disponivel no estoque agora/);
});

test('classifier sale request to send POCO photos does not become delivery freight', () => {
  const parse = new Function('$json', '$', parserCode);
  const parsed = raw => parse({ output: JSON.stringify(raw) }, () => ({ first: () => ({ json: {
    conversation: raw.message, remoteJid: 'fixture@s.whatsapp.net',
  } }) }))[0].json;
  const photo = parsed({ intencao: 'vendas_produtos', message: 'Poderia me enviar foto dos pocos',
    venda: { tipo: 'busca', busca: 'Poco' }, fluxo_venda: { acao: 'pedir_foto' } });
  assert.equal(photo.intencao, 'vendas_produtos');
  assert.equal(photo.salesFlowAction, 'pedir_foto');
  const shipping = parsed({ intencao: 'vendas_produtos', message: 'Pode enviar o celular por motoboy?',
    venda: { tipo: 'busca', busca: 'Poco' } });
  assert.equal(shipping.intencao, 'entrega_frete');
});

test('two named model requests are queried separately and both receive real images', async () => {
  const result = await run('Queria ver o poco X7 pro e poco X8 Pro 5G',
    'poco x7 pro e poco x8 pro 5g', query => query === 'poco x7 pro' ? [x7] : query === 'poco x8 pro 5g' ? [x8] : []);
  assert.deepEqual(result.calls.map(url => url.searchParams.get('search')), ['poco x7 pro', 'poco x8 pro 5g']);
  assert.equal(result.output.salesPostListHandled, true);
  assert.equal(result.output.messages.filter(message => message.type === 'image').length, 2);
  assert.match(JSON.stringify(result.output.messages), /Poco X7 Pro 5G/);
  assert.match(JSON.stringify(result.output.messages), /Poco X8 Pro 5G/);
  assert.equal(result.feeCalls, 1);
  assert.equal(result.output.messages.filter(message => message.type === 'text' && /Cartão: 12x de/.test(message.text)).length, 2);
  assert.match(result.output.messages[0].text, /💰 R\$ 2\.660,00 à vista no PIX\n💳 Cartão: 12x de R\$ 248,05 \(total R\$ 2\.976,54\)/);
});

test('generic POCO photos ask for a model based on actual smartphone results', async () => {
  const result = await run('Poderia me enviar foto dos pocos', 'Poco', () => [accessory, x7, x8]);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].searchParams.get('search'), 'poco');
  assert.equal(result.output.salesPostListHandled, true);
  assert.match(result.output.messages[0].text, /Poco X7 Pro 5G/);
  assert.match(result.output.messages[0].text, /Poco X8 Pro 5G/);
  assert.doesNotMatch(result.output.messages[0].text, /Capa para/);
  assert.equal(result.output.messages.filter(message => message.type === 'image').length, 0);
  assert.equal(result.feeCalls, 0);
});

test('when one named model has no verified photo, the reply still addresses both models', async () => {
  const result = await run('Queria ver o Poco X7 Pro e Poco X8 Pro 5G',
    'poco x7 pro e poco x8 pro 5g', query => query === 'poco x7 pro' ? [x7] : []);
  assert.equal(result.output.messages.filter(message => message.type === 'image').length, 1);
  assert.match(JSON.stringify(result.output.messages), /Poco X7 Pro 5G/);
  assert.match(JSON.stringify(result.output.messages), /poco x8 pro 5g/);
  assert.doesNotMatch(JSON.stringify(result.output.messages), /não (?:tem|encontrei)|fora de estoque/i);
  assert.equal(result.feeCalls, 1);
});

test('missing 12x fee never yields an incomplete PIX-only price', async () => {
  for (const feeRows of [[], new Error('fee lookup timeout')]) {
    const result = await run('Foto do Poco X7 Pro', 'poco x7 pro', () => [x7], feeRows);
    assert.equal(result.feeCalls, 1);
    assert.equal(result.output.messages.filter(message => message.type === 'image').length, 1);
    const texts = result.output.messages.filter(message => message.type === 'text').map(message => message.text).join('\n');
    assert.match(texts, /Poco X7 Pro 5G/);
    assert.doesNotMatch(texts, /R\$|PIX|Cartão: 12x/);
  }
});

test('accessories and empty results never become an unverified no-stock assertion', async () => {
  for (const rows of [[], [accessory]]) {
    const result = await run('Foto do Poco X7 Pro', 'poco x7 pro', () => rows);
    assert.equal(result.output.salesPostListHandled, true);
    assert.match(result.output.output, /Não consegui confirmar as fotos/);
    assert.doesNotMatch(result.output.output, /não (?:tem|encontrei)|estoque/i);
    assert.equal(result.output.messages, undefined);
  }
});

test('single-brand second model carries the brand without conflating two requests', async () => {
  const result = await run('Fotos Poco X7 Pro e X8 Pro 5G', 'Poco X7 Pro e X8 Pro 5G',
    query => query === 'poco x7 pro' ? [x7] : query === 'poco x8 pro 5g' ? [x8] : []);
  assert.deepEqual(result.calls.map(url => url.searchParams.get('search')), ['poco x7 pro', 'poco x8 pro 5g']);
  assert.equal(result.output.messages.filter(message => message.type === 'image').length, 2);
});
