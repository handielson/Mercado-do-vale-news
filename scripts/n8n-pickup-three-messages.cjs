'use strict';

// pickup-three-messages-v1 (14/11/2026): ao escolher RETIRADA NA LOJA, o robô manda 3 mensagens separadas:
//  1) "Combinado. Vou deixar separado para retirada na loja." + "Que horas mais ou menos você pretende retirar?"
//  2) Endereço da loja em texto legível (company_settings).
//  3) Pino de localização nativo do WhatsApp (Evolution /message/sendLocation) quando company_settings tem
//     address_lat/address_lng; sem coordenadas (ou no canal Meta), o link do Google Maps sozinho.
// Estado/orderDraft (storeAddress, storeMapsLink, awaiting_pickup_time) não muda. Grafo do workflow não muda.

const MARK = 'pickup-three-messages-v1';
const NODE_POST = 'Vendas - Verificar Pos Lista';
const NODE_SPLIT = 'Dividir mensagens';
const NODE_SEND = 'Enviar WhatsApp';
const NODES = [NODE_SPLIT, NODE_SEND, NODE_POST];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

const PICKUP_OLD = "output: withGreeting('Combinado. Vou deixar separado para retirada na loja.' + lineBreak + 'Nossa localizacao: ' + storeMapsLink(settings) + lineBreak + 'Que horas mais ou menos voce pretende retirar?') } }];";
const PICKUP_NEW = "messages: pickupMessagesV1(settings) } }]; // " + MARK;

const HELPERS = `// ${MARK}: retirada na loja em 3 mensagens (combinado + horário, endereço, localização).
const prettyStoreAddressV1 = (settings) => {
  const word = (value) => titleCase(String(value || '').replace(/\\s+/g, ' ').trim());
  return [
    [word(settings.address_street), String(settings.address_number || '').trim()].filter(Boolean).join(', '),
    word(settings.address_complement),
    word(settings.address_neighborhood),
    [word(settings.address_city), String(settings.address_state || '').trim().toUpperCase()].filter(Boolean).join('/'),
    settings.address_zip_code ? 'CEP ' + String(settings.address_zip_code).trim() : '',
  ].filter(Boolean).join(' - ');
};
const storeCoordinatesV1 = (settings) => {
  const latitude = Number(settings?.address_lat);
  const longitude = Number(settings?.address_lng);
  const valid = settings?.address_lat !== null && settings?.address_lat !== undefined && String(settings.address_lat).trim() !== ''
    && settings?.address_lng !== null && settings?.address_lng !== undefined && String(settings.address_lng).trim() !== ''
    && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    && !(latitude === 0 && longitude === 0);
  return valid ? { latitude, longitude } : null;
};
function pickupMessagesV1(settings) {
  const address = prettyStoreAddressV1(settings);
  const mapsLink = storeMapsLink(settings);
  const coordinates = storeCoordinatesV1(settings);
  const messages = [];
  const greeting = periodGreeting();
  if (greeting) messages.push({ type: 'text', text: greeting, delayMs: 800 });
  messages.push({ type: 'text', text: 'Combinado. Vou deixar separado para retirada na loja.\\nQue horas mais ou menos você pretende retirar?', delayMs: 1200 });
  messages.push({ type: 'text', text: '📍 Nosso endereço: ' + address, delayMs: 1500 });
  messages.push(coordinates
    ? { type: 'location', text: '📍 Localização da loja: ' + mapsLink, latitude: coordinates.latitude, longitude: coordinates.longitude,
      locationName: String(settings.name || settings.company_name || 'Mercado do Vale'), locationAddress: address, delayMs: 1500 }
    : { type: 'text', text: '📍 Localização da loja: ' + mapsLink, delayMs: 1500 });
  return messages;
}
`;

function patchPost(code) {
  if (code.includes(MARK)) return code;
  code = once(code, PICKUP_OLD, PICKUP_NEW, 'retirada');
  code = once(code, '// smartphone-location-delivery-v401:reverse-geocode\n', HELPERS + '// smartphone-location-delivery-v401:reverse-geocode\n', 'helpers');
  return code;
}

function patchSplit(code) {
  if (code.includes(MARK)) return code;
  code = once(code,
    "  const quoteThisTextV2 = index === 0 && message?.type !== 'image'",
    "  // " + MARK + ": localização nativa só no WhatsApp; no canal Meta vira texto com o link.\n"
    + "  const locationV1 = message?.type === 'location' && !source.metaAttendance && Number.isFinite(Number(message.latitude)) && Number.isFinite(Number(message.longitude));\n"
    + "  const quoteThisTextV2 = index === 0 && message?.type !== 'image' && !locationV1",
    'citação');
  code = once(code,
    "messageType: message.type === 'image' ? 'image' : 'text', mediaUrl:",
    "messageType: message.type === 'image' ? 'image' : (locationV1 ? 'location' : 'text'),\n"
    + "      latitude: locationV1 ? Number(message.latitude) : null, longitude: locationV1 ? Number(message.longitude) : null,\n"
    + "      locationName: locationV1 ? String(message.locationName || 'Mercado do Vale') : '', locationAddress: locationV1 ? String(message.locationAddress || '') : '',\n"
    + "      mediaUrl:",
    'tipo da mensagem');
  return code;
}

const LOCATION = "$json.messageType === 'location'";
function patchSend(parameters) {
  const next = JSON.parse(JSON.stringify(parameters));
  if (String(next.url).includes('sendLocation')) return next;
  if (next.url !== "={{$env.EVOLUTION_SERVER_URL + '/message/sendText/botmercadodovale'}}") throw new Error('Enviar WhatsApp: URL inesperada');
  next.url = `={{$env.EVOLUTION_SERVER_URL + (${LOCATION} ? '/message/sendLocation/botmercadodovale' : '/message/sendText/botmercadodovale')}}`;
  const params = next.bodyParameters.parameters;
  const text = params.find((param) => param.name === 'text');
  if (!text || text.value !== '={{$json.message}}') throw new Error('Enviar WhatsApp: parâmetro text inesperado');
  text.value = `={{${LOCATION} ? undefined : $json.message}}`;
  const quoted = params.find((param) => param.name === 'quoted');
  if (!quoted) throw new Error('Enviar WhatsApp: parâmetro quoted ausente');
  quoted.value = quoted.value.replace('={{$json.replyToWaMessageId ?', `={{!(${LOCATION}) && $json.replyToWaMessageId ?`);
  params.push(
    { name: 'name', value: `={{${LOCATION} ? ($json.locationName || 'Mercado do Vale') : undefined}}` },
    { name: 'address', value: `={{${LOCATION} ? ($json.locationAddress || '') : undefined}}` },
    { name: 'latitude', value: `={{${LOCATION} ? Number($json.latitude) : undefined}}` },
    { name: 'longitude', value: `={{${LOCATION} ? Number($json.longitude) : undefined}}` },
  );
  return next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => { const node = next.nodes.find((item) => item.name === name); if (!node?.parameters) throw new Error(`Nó ausente: ${name}`); return node; };
  const post = find(NODE_POST); post.parameters.jsCode = patchPost(post.parameters.jsCode);
  const split = find(NODE_SPLIT); split.parameters.jsCode = patchSplit(split.parameters.jsCode);
  const send = find(NODE_SEND); send.parameters = patchSend(send.parameters);
  return next;
}

module.exports = { MARK, NODES, NODE_POST, NODE_SPLIT, NODE_SEND, patchWorkflow, patchPost, patchSplit, patchSend };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
