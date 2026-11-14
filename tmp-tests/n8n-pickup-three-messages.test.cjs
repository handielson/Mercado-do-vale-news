// pickup-three-messages-v1: retirada na loja = 3 mensagens (combinado + horário, endereço, localização/pino).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE_POST, NODE_SPLIT, NODE_SEND } = require('../scripts/n8n-pickup-three-messages.cjs');
const { priceCatalogFixture } = require('./n8n-sales-price-catalog-fixture.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;

const settings = (extra = {}) => ({ name: 'Mercado do Vale', address_street: 'ABILIO MOURATO CRUZ', address_number: '5', address_complement: 'LOJA c',
  address_neighborhood: 'COHAB MASSANGANO', address_city: 'PETROLINA', address_state: 'PE', address_zip_code: '56310-150',
  address_lat: null, address_lng: null, business_hours: {}, ...extra });

async function choosePickup(code, companySettings) {
  const jid = '5587900000000@s.whatsapp.net';
  const option = { number: 1, name: 'Fixture', memory: '8GB/256GB', price: 'R$ 1.224,00', colors: [{ productId: 'fixture', color: 'Roxo', memory: '8GB/256GB', price: 'R$ 1.224,00', priceCents: 122400 }] };
  const draft = { productId: 'fixture', name: 'Fixture', memory: '8GB/256GB', color: 'Roxo', price: 'R$ 1.224,00', unitPriceCents: 122400, quantity: 1 };
  const state = { salesPostList: { [jid]: { flow: 'sales_post_list', step: 'awaiting_fulfillment', expiresAt: Date.now() + 60000, options: [option], orderDraft: draft } } };
  const source = { remoteJid: jid, conversation: 'Vou retirar na loja', collectionReply: { decision: 'field_value', confidence: 0.99 } };
  const blocked = async () => { throw new Error('External request blocked by offline fixture'); };
  const result = await new Function('$json', '$', '$getWorkflowStaticData', 'fetch', 'helpers', code)(companySettings,
    () => ({ first: () => ({ json: source }) }), () => state, blocked, priceCatalogFixture(state));
  return { json: result[0].json, state: state.salesPostList[jid] };
}

function split(code, json, meta = false) {
  const switchJson = { remoteJid: '5587999990000@s.whatsapp.net', Instancia: 'botmercadodovale', ...(meta ? { metaAttendance: { eventKey: 'e', conversationKey: 'c' } } : {}) };
  const $ = (name) => ({ first: () => ({ json: name === 'switc Mensagens' ? switchJson : {} }), all: () => [] });
  return new Function('$json', '$', code)(json, $).map((item) => item.json);
}

function evaluate(expression, json) {
  const body = String(expression).replace(/^=\{\{/, '').replace(/\}\}$/, '');
  return new Function('$json', '$env', 'return (' + body + ');')(json, { EVOLUTION_SERVER_URL: 'https://evo' });
}

test('retirada: 3 mensagens na ordem, pino só com coordenadas', { skip: !snapshot && 'sem snapshot do n8n' }, async () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const patched = patchWorkflow(workflow);
  assert.deepEqual(patchWorkflow(patched), patched, 'idempotente');
  assert.deepEqual(patched.connections, workflow.connections, 'grafo intacto');
  const node = (name) => patched.nodes.find((item) => item.name === name);
  const post = node(NODE_POST).parameters.jsCode;
  const splitCode = node(NODE_SPLIT).parameters.jsCode;

  // Sem coordenadas: 3ª mensagem é o link do Maps.
  const { json, state } = await choosePickup(post, settings());
  assert.equal(json.salesPostListStep, 'awaiting_pickup_time');
  assert.equal(state.step, 'awaiting_pickup_time');
  assert.equal(state.orderDraft.fulfillment, 'pickup');
  assert.match(state.orderDraft.storeMapsLink, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=ABILIO/);
  const body = json.messages.filter((message) => !/^(?:Bom dia|Boa tarde|Boa noite)$/.test(message.text));
  assert.equal(body.length, 3);
  assert.equal(body[0].text, 'Combinado. Vou deixar separado para retirada na loja.\nQue horas mais ou menos você pretende retirar?');
  assert.doesNotMatch(body[0].text, /https?:|maps/i, 'sem link na 1ª mensagem');
  assert.equal(body[1].text, '📍 Nosso endereço: Abilio Mourato Cruz, 5 - Loja C - Cohab Massangano - Petrolina/PE - CEP 56310-150');
  assert.equal(body[2].type, 'text');
  assert.equal(body[2].text, '📍 Localização da loja: ' + state.orderDraft.storeMapsLink);

  // Com coordenadas: pino nativo.
  const pin = (await choosePickup(post, settings({ address_lat: '-9.3891', address_lng: '-40.5030' }))).json.messages.at(-1);
  assert.deepEqual({ type: pin.type, latitude: pin.latitude, longitude: pin.longitude, locationName: pin.locationName },
    { type: 'location', latitude: -9.3891, longitude: -40.503, locationName: 'Mercado do Vale' });

  // Dividir mensagens: WhatsApp leva o pino; Meta vira texto com o link.
  const items = split(splitCode, { messages: (await choosePickup(post, settings({ address_lat: -9.3891, address_lng: -40.503 }))).json.messages });
  const last = items.at(-1);
  assert.equal(last.messageType, 'location');
  assert.equal(last.latitude, -9.3891);
  assert.equal(last.locationAddress, 'Abilio Mourato Cruz, 5 - Loja C - Cohab Massangano - Petrolina/PE - CEP 56310-150');
  assert.deepEqual(items.map((item) => item.messageIndex), items.map((_, index) => index + 1));
  const metaLast = split(splitCode, { messages: [{ type: 'location', text: '📍 Localização da loja: https://maps', latitude: 1, longitude: 2 }] }, true).at(-1);
  assert.equal(metaLast.messageType, 'text');
  assert.equal(metaLast.message, '📍 Localização da loja: https://maps');

  // Enviar WhatsApp: texto continua igual; localização vai para sendLocation com números.
  const send = node(NODE_SEND).parameters;
  const params = Object.fromEntries(send.bodyParameters.parameters.map((param) => [param.name, param.value]));
  const textItem = { messageType: 'text', message: 'oi', remoteJid: 'x', delayMs: 0, replyToWaMessageId: 'abc', replyToText: 'q' };
  assert.equal(evaluate(send.url, textItem), 'https://evo/message/sendText/botmercadodovale');
  assert.equal(evaluate(params.text, textItem), 'oi');
  assert.equal(evaluate(params.latitude, textItem), undefined);
  assert.equal(evaluate(params.quoted, textItem).key.id, 'abc');
  assert.equal(evaluate(send.url, last), 'https://evo/message/sendLocation/botmercadodovale');
  assert.equal(evaluate(params.text, last), undefined);
  assert.equal(evaluate(params.latitude, last), -9.3891);
  assert.equal(typeof evaluate(params.longitude, last), 'number');
  assert.equal(evaluate(params.name, last), 'Mercado do Vale');
  assert.equal(evaluate(params.quoted, { ...last, replyToWaMessageId: 'abc' }), undefined);

  // Fluxo publicado sem a correção mandava tudo numa mensagem só.
  const live = workflow.nodes.find((item) => item.name === NODE_POST).parameters.jsCode;
  if (!live.includes(MARK)) assert.match(String((await choosePickup(live, settings())).json.output), /Nossa localizacao: https:/);
  assert.ok(post.includes(MARK) && splitCode.includes(MARK));
});
