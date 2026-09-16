const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// smartphone-location-delivery-v401';
const SMARTPHONE_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';

function contactDeliveryAssumptionV401(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = national.slice(0, 2);
  if (ddd === '87') return { ddd, city: 'Petrolina', state: 'PE', label: 'Petrolina-PE' };
  if (ddd === '74') return { ddd, city: 'Juazeiro', state: 'BA', label: 'Juazeiro-BA' };
  return { ddd, city: '', state: '', label: '' };
}

function deliveryPolicyCoreV401(address = {}, options = {}) {
  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const city = normalize(address.city || address.localidade || '');
  const state = normalize(address.state || address.uf || '');
  const assumption = contactDeliveryAssumptionV401(options.remoteJid || options.phone || options.ddd || '');
  const addressEligible = (city === 'petrolina' && state === 'pe') || (city === 'juazeiro' && state === 'ba');
  const localEligible = Boolean(assumption.label) || addressEligible;
  const smartphone = options.isSmartphone === true;
  const free = smartphone && localEligible;
  return {
    status: free ? 'free' : (smartphone ? 'needs_location_review' : 'not_applicable'),
    free,
    smartphone,
    localEligible,
    assumedByDdd: Boolean(assumption.label),
    ddd: assumption.ddd,
    assumedCity: assumption.city,
    assumedState: assumption.state,
    customerShareCents: free ? 0 : null,
    reason: free
      ? 'smartphone com entrega gratuita em Petrolina-PE ou Juazeiro-BA'
      : (smartphone ? 'localidade fora da regra automatica' : 'regra gratuita exclusiva para smartphones'),
  };
}

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  }));
}
async function waitService(conn, service, expected, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function nodeByName(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`${name} not found`);
  return node;
}

const deliveryHelpers = `${MARKER}
const SMARTPHONE_CATEGORY_ID_V401 = '${SMARTPHONE_CATEGORY_ID}';
const contactDeliveryAssumptionV401 = ${contactDeliveryAssumptionV401.toString()};
const deliveryPolicyCoreV401 = ${deliveryPolicyCoreV401.toString()};
const isSmartphoneOrderV401 = (state, draft) => {
  if (String(state?.categoryId || '') === SMARTPHONE_CATEGORY_ID_V401) return true;
  if (String(source.salesCategoryId || '') === SMARTPHONE_CATEGORY_ID_V401) return true;
  return /\\b(?:smartphone|celular|iphone|redmi|poco|xiaomi|samsung|motorola|realme|infinix)\\b/i.test([draft?.name, draft?.categoryName].filter(Boolean).join(' '));
};
const deliveryPolicyLineV401 = (quote) => {
  if (quote?.free) return 'Para este smartphone, a entrega é gratuita. 🛵';
  if (!quote?.smartphone && quote?.localEligible) return 'A entrega gratuita nessa região é exclusiva para smartphones. Para este produto, vou confirmar a condição do frete.';
  if (quote?.smartphone) return 'Vou confirmar a disponibilidade e a condição da entrega para esse endereço.';
  return 'Para smartphones, a entrega é gratuita em Petrolina-PE e Juazeiro-BA.';
};`;

const reverseGeocodeHelper = `${MARKER}:reverse-geocode
async function reverseGeocodeDeliveryLocationV401(location, fallback = {}) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const sharedV401 = $getWorkflowStaticData('global');
  sharedV401.deliveryReverseGeocodeCacheV401 = sharedV401.deliveryReverseGeocodeCacheV401 || {};
  const cacheKeyV401 = latitude.toFixed(5) + ',' + longitude.toFixed(5);
  const cachedV401 = sharedV401.deliveryReverseGeocodeCacheV401[cacheKeyV401];
  if (cachedV401?.address && Number(cachedV401.expiresAt || 0) > Date.now()) return cachedV401.address;
  try {
    const waitMsV401 = Math.max(0, 1100 - (Date.now() - Number(sharedV401.deliveryReverseGeocodeLastAtV401 || 0)));
    if (waitMsV401 > 0) await new Promise((resolve) => setTimeout(resolve, waitMsV401));
    sharedV401.deliveryReverseGeocodeLastAtV401 = Date.now();
    const data = await helpers.httpRequest({
      method: 'GET',
      url: 'https://nominatim.openstreetmap.org/reverse',
      qs: { format: 'jsonv2', lat: String(latitude), lon: String(longitude), addressdetails: '1', zoom: '18', 'accept-language': 'pt-BR' },
      headers: { Accept: 'application/json', 'User-Agent': 'MercadoDoVale-N8N/1.0' },
      json: true,
      timeout: 10000,
    });
    const value = data?.address || {};
    const stateCode = String(value['ISO3166-2-lvl4'] || value.state_code || fallback.state || '').split('-').pop().toUpperCase();
    const found = {
      cep: String(value.postcode || '').replace(/\\D/g, ''),
      street: value.road || value.pedestrian || value.residential || value.footway || '',
      number: value.house_number || '',
      neighborhood: value.suburb || value.neighbourhood || value.quarter || value.city_district || fallback.neighborhood || '',
      city: value.city || value.town || value.municipality || value.village || fallback.city || '',
      state: stateCode || fallback.state || '',
      latitude: String(latitude),
      longitude: String(longitude),
      rawLocation: String(data?.display_name || location?.address || location?.name || '').trim(),
      locationSource: 'whatsapp_gps',
      geocodeAttribution: '© OpenStreetMap contributors',
    };
    if (!(found.street || found.neighborhood || found.city || found.rawLocation)) return null;
    sharedV401.deliveryReverseGeocodeCacheV401[cacheKeyV401] = { address: found, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
    const cacheEntriesV401 = Object.entries(sharedV401.deliveryReverseGeocodeCacheV401);
    if (cacheEntriesV401.length > 500) {
      for (const [key] of cacheEntriesV401.sort((a, b) => Number(a[1]?.expiresAt || 0) - Number(b[1]?.expiresAt || 0)).slice(0, cacheEntriesV401.length - 500)) delete sharedV401.deliveryReverseGeocodeCacheV401[key];
    }
    return found;
  } catch (error) {
    return null;
  }
}`;

const directAddressFlow = `const directCepV401 = cepFromText(text);
const deliveryStateV401 = String(activeState?.step || '');
const shouldLookupCepV401 = Boolean(directCepV401) && (
  /\\bcep\\b/.test(normalized)
  || String(source.conversationAction || '') === 'buscar_cep'
  || ['awaiting_delivery_zip', 'awaiting_delivery_neighborhood', 'awaiting_delivery_location', 'awaiting_delivery_address_text'].includes(deliveryStateV401)
);
if (shouldLookupCepV401) {
  if (!activeState) {
    activeState = {
      flow: 'delivery_address_lookup',
      step: 'awaiting_delivery_zip',
      options: [],
      orderDraft: {},
      createdAt: new Date(now).toISOString(),
      expiresAt: now + 60 * 60 * 1000,
    };
    staticData.salesPostList[remoteJid] = activeState;
  } else {
    activeState.step = 'awaiting_delivery_zip';
    activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery' };
  }
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    needsDeliveryCepLookup: true,
    deliveryCep: directCepV401,
    orderDraft: activeState.orderDraft,
  } }];
}

if (activeState?.step === 'awaiting_delivery_address_confirmation') {
  const confirmsAddressV401 = /^(?:sim|isso|correto|correta|certo|certa|confere|confirmo|esta certo|esta correta|ta certo|pode ser)$/.test(normalized);
  const rejectsAddressV401 = /^(?:nao|errado|errada|nao confere|outro|outro endereco|outra localizacao|outro cep)$/.test(normalized);
  const dddAssumptionV401 = contactDeliveryAssumptionV401(remoteJid);
  if (rejectsAddressV401) {
    activeState.step = dddAssumptionV401.label ? 'awaiting_delivery_neighborhood' : 'awaiting_delivery_zip';
    activeState.orderDraft = { ...(activeState.orderDraft || {}), deliveryAddressConfirmed: false };
    delete activeState.orderDraft.deliveryAddress;
    delete activeState.orderDraft.deliveryFreight;
    activeState.updatedAt = new Date(now).toISOString();
    const retryV401 = dddAssumptionV401.label
      ? 'Sem problema. Qual é o bairro correto da entrega? Depois vou pedir uma nova localização.'
      : 'Sem problema. Me envie o CEP correto para eu localizar novamente.';
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: retryV401 } }];
  }
  if (!confirmsAddressV401) {
    const addressV401 = activeState.orderDraft?.deliveryAddress || {};
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      output: 'Preciso confirmar o endereço antes de continuar.' + lineBreak
        + addressText(addressV401) + lineBreak + 'Esse endereço está correto? Responda sim ou não.',
    } }];
  }

  const addressV401 = activeState.orderDraft?.deliveryAddress || {};
  const smartphoneV401 = isSmartphoneOrderV401(activeState, activeState.orderDraft || {});
  const freightV401 = deliveryPolicyCoreV401(addressV401, { remoteJid, isSmartphone: smartphoneV401 });
  const hasSelectedProductV401 = Boolean(activeState.orderDraft?.productId);
  activeState.orderDraft = {
    ...(activeState.orderDraft || {}),
    deliveryAddressConfirmed: true,
    deliveryAddressConfirmedAt: new Date(now).toISOString(),
    deliveryFreight: freightV401,
  };
  activeState.updatedAt = new Date(now).toISOString();
  if (hasSelectedProductV401) {
    activeState.step = 'awaiting_delivery_number_complement';
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      output: 'Endereço confirmado. 😊' + lineBreak + deliveryPolicyLineV401(freightV401) + lineBreak
        + 'Agora me mande o número da casa e o complemento, se tiver.',
    } }];
  }

  activeState.step = 'awaiting_product_choice';
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    orderDraft: activeState.orderDraft,
    output: 'Endereço confirmado. 😊' + lineBreak + 'Para smartphones, a entrega é gratuita em Petrolina-PE e Juazeiro-BA.' + lineBreak + 'Agora me diga qual produto você procura.',
  } }];
}
`;

const deliveryStateFlow = `if (activeState?.step === 'awaiting_delivery_neighborhood') {
  if (source.inboundLocation?.latitude && source.inboundLocation?.longitude) {
    const assumptionV401 = contactDeliveryAssumptionV401(remoteJid);
    const addressV401 = await reverseGeocodeDeliveryLocationV401(source.inboundLocation, { city: assumptionV401.city, state: assumptionV401.state });
    if (!addressV401) {
      activeState.step = 'awaiting_delivery_address_text';
      activeState.updatedAt = new Date(now).toISOString();
      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Recebi sua localização, mas não consegui captar o endereço automaticamente. Me envie o endereço completo por texto, com rua, número e bairro.') } }];
    }
    activeState.step = 'awaiting_delivery_address_confirmation';
    activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery', deliveryNeighborhood: addressV401.neighborhood || '', deliveryAddress: addressV401, deliveryAddressConfirmed: false };
    delete activeState.orderDraft.deliveryFreight;
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Consegui captar este endereço pela sua localização:' + lineBreak + addressText(addressV401) + lineBreak + 'Dados de endereço: © OpenStreetMap contributors' + lineBreak + lineBreak + 'Esse endereço está correto? Responda sim ou não.') } }];
  }
  if (!text || text.length < 2) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Qual é o bairro da entrega?') } }];
  }
  activeState.step = 'awaiting_delivery_location';
  activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery', deliveryNeighborhood: text };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Obrigado. Agora me envie sua localização pelo WhatsApp usando o clipe 📎 e a opção Localização. Assim eu capto o endereço e peço sua confirmação.') } }];
}

if (activeState?.step === 'awaiting_delivery_zip') {
  const cepV401 = cepFromText(text);
  if (!cepV401) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Me envie os 8 números do CEP. Se preferir, mande sua localização pelo WhatsApp.') } }];
  }
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, needsDeliveryCepLookup: true, deliveryCep: cepV401, orderDraft: activeState.orderDraft } }];
}

if (activeState?.step === 'awaiting_delivery_location') {
  const assumptionV401 = contactDeliveryAssumptionV401(remoteJid);
  const locationV401 = source.inboundLocation || {};
  if (!locationV401.latitude || !locationV401.longitude) {
    if (/\\b(?:nao consigo|não consigo|sem localizacao|sem localização|digitar|endereco por texto|endereço por texto)\\b/.test(normalized)) {
      activeState.step = 'awaiting_delivery_address_text';
      activeState.updatedAt = new Date(now).toISOString();
      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Tudo bem. Me envie o endereço completo por texto, com rua, número e bairro.') } }];
    }
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Ainda preciso da localização enviada pelo WhatsApp. Toque no clipe 📎, escolha Localização e envie sua posição atual. Se não conseguir, escreva “não consigo”.') } }];
  }
  const addressV401 = await reverseGeocodeDeliveryLocationV401(locationV401, {
    city: assumptionV401.city,
    state: assumptionV401.state,
    neighborhood: activeState.orderDraft?.deliveryNeighborhood || '',
  });
  if (!addressV401) {
    activeState.step = 'awaiting_delivery_address_text';
    activeState.orderDraft = { ...(activeState.orderDraft || {}), deliveryLocation: locationV401 };
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Recebi sua localização, mas não consegui captar o endereço automaticamente. Me envie o endereço completo por texto, com rua, número e bairro.') } }];
  }
  activeState.step = 'awaiting_delivery_address_confirmation';
  activeState.orderDraft = {
    ...(activeState.orderDraft || {}),
    fulfillment: 'delivery',
    deliveryAddress: addressV401,
    deliveryAddressConfirmed: false,
  };
  delete activeState.orderDraft.deliveryFreight;
  activeState.updatedAt = new Date(now).toISOString();
  const informedNeighborhoodV401 = String(activeState.orderDraft?.deliveryNeighborhood || '').trim();
  const informedLineV401 = informedNeighborhoodV401 && normalize(informedNeighborhoodV401) !== normalize(addressV401.neighborhood)
    ? lineBreak + 'Bairro informado por você: ' + informedNeighborhoodV401
    : '';
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Consegui captar este endereço pela sua localização:' + lineBreak + addressText(addressV401) + informedLineV401 + lineBreak + 'Dados de endereço: © OpenStreetMap contributors' + lineBreak + lineBreak + 'Esse endereço está correto? Responda sim ou não.') } }];
}

if (activeState?.step === 'awaiting_delivery_address_text') {
  if (!text || text.length < 8) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Me envie o endereço completo por texto, com rua, número e bairro.') } }];
  }
  const assumptionV401 = contactDeliveryAssumptionV401(remoteJid);
  const addressV401 = {
    rawLocation: text,
    neighborhood: activeState.orderDraft?.deliveryNeighborhood || '',
    city: assumptionV401.city,
    state: assumptionV401.state,
    latitude: activeState.orderDraft?.deliveryLocation?.latitude || '',
    longitude: activeState.orderDraft?.deliveryLocation?.longitude || '',
    locationSource: 'customer_text',
  };
  activeState.step = 'awaiting_delivery_address_confirmation';
  activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery', deliveryAddress: addressV401, deliveryAddressConfirmed: false };
  delete activeState.orderDraft.deliveryFreight;
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Anotei este endereço:' + lineBreak + addressText(addressV401) + lineBreak + lineBreak + 'Está correto? Responda sim ou não.') } }];
}

`;

const policyCode = `${MARKER}:policy
const source = $json || {};
const staticData = $getWorkflowStaticData('global');
staticData.salesPostList = staticData.salesPostList || {};
const remoteJid = String(source.remoteJid || '');
const assumption = (${contactDeliveryAssumptionV401.toString()})(remoteJid);
const now = Date.now();
if (remoteJid) {
  const previous = staticData.salesPostList[remoteJid] || {};
  staticData.salesPostList[remoteJid] = {
    ...previous,
    flow: previous.flow || 'delivery_address_lookup',
    step: assumption.label ? 'awaiting_delivery_neighborhood' : 'awaiting_delivery_zip',
    options: Array.isArray(previous.options) ? previous.options : [],
    orderDraft: { ...(previous.orderDraft || {}), fulfillment: 'delivery', deliveryAssumedCity: assumption.city, deliveryAssumedState: assumption.state, deliveryDdd: assumption.ddd },
    createdAt: previous.createdAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt: now + 60 * 60 * 1000,
  };
}
const output = assumption.label
  ? ['Para smartphones, a entrega é gratuita em toda Petrolina-PE e Juazeiro-BA. 🛵', 'Pelo seu DDD ' + assumption.ddd + ', vou considerar ' + assumption.label + '.', 'Qual é o bairro da entrega?'].join('[[BR]]')
  : ['Para smartphones, a entrega é gratuita em Petrolina-PE e Juazeiro-BA. 🛵', 'Me envie os 8 números do CEP para eu localizar e confirmar o endereço.'].join('[[BR]]');
return [{ json: { ...source, output, deliveryDddAssumption: assumption } }];`;

function patchDataNode(nodes) {
  const node = nodeByName(nodes, 'Dados');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(MARKER)) return;
  const textAnchor = `const getText = () => String(
  message.conversation
  || message.extendedTextMessage?.text
  || data.text
  || data.messageText
  || ''
).trim();`;
  const locationBlock = `${textAnchor}

${MARKER}:inbound-location
const locationPayloadV401 = message.locationMessage || message.liveLocationMessage || data.locationMessage || data.location || null;
const latitudeV401 = Number(locationPayloadV401?.degreesLatitude ?? locationPayloadV401?.latitude);
const longitudeV401 = Number(locationPayloadV401?.degreesLongitude ?? locationPayloadV401?.longitude);
const hasLocationV401 = Boolean(locationPayloadV401)
  && Number.isFinite(latitudeV401) && Number.isFinite(longitudeV401)
  && Math.abs(latitudeV401) <= 90 && Math.abs(longitudeV401) <= 180;`;
  if (!code.includes(textAnchor)) throw new Error('Dados text anchor not found');
  code = code.replace(textAnchor, locationBlock);
  const typeLine = `const normalizedMessageType = rawMessageType || (getText() ? 'conversation' : 'ignored_empty');`;
  if (!code.includes(typeLine)) throw new Error('Dados message type anchor not found');
  code = code.replace(typeLine, `const normalizedMessageType = hasLocationV401 ? 'conversation' : (rawMessageType || (getText() ? 'conversation' : 'ignored_empty'));`);
  code = code.replace(`  conversation: getText(),`, `  conversation: hasLocationV401 ? '[localização compartilhada]' : getText(),
  inboundLocation: hasLocationV401 ? {
    latitude: latitudeV401,
    longitude: longitudeV401,
    name: String(locationPayloadV401?.name || ''),
    address: String(locationPayloadV401?.address || ''),
  } : null,`);
  new Function(code);
  node.parameters.jsCode = code;
}

function patchPostList(nodes) {
  const node = nodeByName(nodes, 'Vendas - Verificar Pos Lista');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:reverse-geocode`) && !code.includes('// delivery-address-confirmation-v163')) {
    for (const required of ['awaiting_delivery_neighborhood', 'awaiting_delivery_location', 'awaiting_delivery_address_text', 'deliveryPolicyCoreV401']) {
      if (!code.includes(required)) throw new Error(`Existing v401 runtime is incomplete: ${required}`);
    }
    new Function(code);
    return;
  }
  code = code.replace(/\/\/ delivery-address-confirmation-v163[\s\S]*?const paymentMethodLabels =/, `${deliveryHelpers}\nconst paymentMethodLabels =`);
  if (!code.includes(MARKER)) throw new Error('Delivery helper replacement failed');
  if (!code.includes(`${MARKER}:reverse-geocode`)) {
    const anchor = 'const addressText = (address) => [';
    if (!code.includes(anchor)) throw new Error('addressText anchor not found');
    code = code.replace(anchor, `${reverseGeocodeHelper}\n\n${anchor}`);
  }
  code = code.replace(`  [address.street, address.number].filter(Boolean).join(', '),`, `  [address.street || address.rawLocation, address.number].filter(Boolean).join(', '),`);
  const directStart = code.indexOf('const directCepV163 = cepFromText(text);');
  const directEnd = code.indexOf('if (promotionQuestion()) {', directStart);
  if (directStart < 0 || directEnd < 0) throw new Error('Old direct address flow not found');
  code = code.slice(0, directStart) + directAddressFlow + '\n' + code.slice(directEnd);

  const oldDeliveryChoice = `  if (deliveryChoice()) {
    activeState.step = 'awaiting_delivery_zip';
    activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery' };
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Combinado: entrega.' + lineBreak + 'Primeiro vou localizar o CEP e confirmar o endereco com voce.' + lineBreak + 'Na area urbana de Petrolina-PE e Juazeiro-BA, a entrega e gratuita para compras acima de R$ 199,00. Me manda o CEP, por favor.') } }];
  }`;
  const newDeliveryChoice = `  if (deliveryChoice()) {
    const assumptionV401 = contactDeliveryAssumptionV401(remoteJid);
    const smartphoneV401 = isSmartphoneOrderV401(activeState, activeState.orderDraft || {});
    activeState.step = assumptionV401.label ? 'awaiting_delivery_neighborhood' : 'awaiting_delivery_zip';
    activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAssumedCity: assumptionV401.city, deliveryAssumedState: assumptionV401.state, deliveryDdd: assumptionV401.ddd };
    activeState.updatedAt = new Date(now).toISOString();
    const benefitV401 = smartphoneV401 ? 'Para este smartphone, a entrega é gratuita em ' + (assumptionV401.label || 'Petrolina-PE e Juazeiro-BA') + '.' + lineBreak : '';
    const questionV401 = assumptionV401.label ? 'Qual é o bairro da entrega?' : 'Me envie os 8 números do CEP para eu localizar e confirmar o endereço.';
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Combinado: entrega. 🛵' + lineBreak + benefitV401 + (assumptionV401.label ? 'Pelo seu DDD ' + assumptionV401.ddd + ', vou considerar ' + assumptionV401.label + '.' + lineBreak : '') + questionV401) } }];
  }`;
  if (!code.includes(oldDeliveryChoice)) throw new Error('Old delivery choice block not found');
  code = code.replace(oldDeliveryChoice, newDeliveryChoice);

  const stateStart = code.indexOf("if (activeState?.step === 'awaiting_delivery_zip') {");
  const stateEnd = code.indexOf("if (activeState?.step === 'awaiting_delivery_number_complement') {", stateStart);
  if (stateStart < 0 || stateEnd < 0) throw new Error('Old delivery state block not found');
  code = code.slice(0, stateStart) + deliveryStateFlow + code.slice(stateEnd);
  for (const removed of ['FREE_DELIVERY_MIN_CENTS_V163', 'deliveryPolicyCoreV163', 'deliveryPolicyLineV163', 'totalCents > 19900', 'acima de R$ 199,00', 'area urbana de Petrolina']) {
    if (code.includes(removed)) throw new Error(`Old delivery rule remains: ${removed}`);
  }
  for (const required of [MARKER, 'awaiting_delivery_neighborhood', 'awaiting_delivery_location', 'awaiting_delivery_address_text', 'reverseGeocodeDeliveryLocationV401', 'deliveryPolicyCoreV401']) {
    if (!code.includes(required)) throw new Error(`New delivery runtime missing: ${required}`);
  }
  new Function(code);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  patchDataNode(nodes);
  patchPostList(nodes);
  nodeByName(nodes, 'Entrega - Politica').parameters.jsCode = policyCode;
  new Function(policyCode);
  return nodes;
}

function summarize(nodes) {
  const all = nodes.map((node) => String(node.parameters?.jsCode || '')).join('\n');
  const data = nodeByName(nodes, 'Dados').parameters.jsCode;
  const post = nodeByName(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const policy = nodeByName(nodes, 'Entrega - Politica').parameters.jsCode;
  return {
    markerPresent: [data, post, policy].every((code) => code.includes(MARKER)),
    inboundCoordinatesPreserved: /locationMessage[\s\S]*inboundLocation/.test(data),
    dddCitiesPresent: post.includes("ddd === '87'") && post.includes("ddd === '74'"),
    neighborhoodThenLocation: post.includes('awaiting_delivery_neighborhood') && post.includes('awaiting_delivery_location'),
    reverseGeocodingPresent: post.includes('nominatim.openstreetmap.org/reverse'),
    confirmationPresent: post.includes('awaiting_delivery_address_confirmation'),
    typedFallbackPresent: post.includes('awaiting_delivery_address_text'),
    oldThresholdRemoved: !/19900|acima de R\$ 199,00|FREE_DELIVERY_MIN_CENTS/.test(all),
    smartphoneOnlyFree: post.includes("const free = smartphone && localEligible"),
  };
}

async function serviceMap(conn) {
  const output = await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  await (async () => {
    try {
      const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
      if (!db) throw new Error('n8n Postgres container not found');
      const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
      const entity = JSON.parse(raw.trim());
      const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
      const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
      patchWorkflow(nodes);
      const summary = summarize(nodes);
      if (!Object.values(summary).every(Boolean)) throw new Error(`Validation failed: ${JSON.stringify(summary)}`);
      if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

      await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
      await waitService(conn, 'n8n_n8n-runner', 0);
      await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
      await waitService(conn, 'n8n_n8n', 0);
      servicesStopped = true;

      const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'markerPresent', we.nodes::text LIKE '%smartphone-location-delivery-v401%',
  'oldThresholdRemoved', we.nodes::text NOT LIKE '%19900%' AND we.nodes::text NOT LIKE '%acima de R$ 199,00%' AND we.nodes::text NOT LIKE '%FREE_DELIVERY_MIN_CENTS%',
  'locationCapturePresent', we.nodes::text LIKE '%inboundLocation%' AND we.nodes::text LIKE '%degreesLatitude%',
  'reverseGeocodePresent', we.nodes::text LIKE '%nominatim.openstreetmap.org/reverse%',
  'neighborhoodStatePresent', we.nodes::text LIKE '%awaiting_delivery_neighborhood%',
  'typedFallbackPresent', we.nodes::text LIKE '%awaiting_delivery_address_text%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
      const result = JSON.parse((await psql(conn, db, sql)).trim());
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
      await waitService(conn, 'n8n_n8n', 1);
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
      await waitService(conn, 'n8n_n8n-runner', 1);
      servicesStopped = false;
      const services = await serviceMap(conn);
      console.log(JSON.stringify({ apply: true, ...result, ...summary, services: { n8n: services.n8n_n8n, runner: services['n8n_n8n-runner'], evolution: services['n8n_evolution-api'] } }, null, 2));
    } finally {
      if (servicesStopped) {
        await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
        await waitService(conn, 'n8n_n8n', 1).catch(() => {});
        await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
        await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
      }
      conn.end();
    }
  })();
}

module.exports = { contactDeliveryAssumptionV401, deliveryPolicyCoreV401, patchWorkflow, summarize, main };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
