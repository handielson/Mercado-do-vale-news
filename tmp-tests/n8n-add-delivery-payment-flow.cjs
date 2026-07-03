const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  return `$${tag}$${String(value).replace(new RegExp(`\\$${tag}\\$`, 'g'), '')}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${serviceName} replicas ${expected}/${expected}`);
}

function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((text) => JSON.parse(text.trim()));
}

const postListHelpers = `
const lineBreak = '||';
const paymentMethodLabels = { pix: 'Pix', card: 'cartao', cash: 'dinheiro' };

const onlyDigits = (value) => String(value || '').replace(/\\D/g, '');
const cepFromText = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 8 ? digits : '';
};
const formatCep = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 8 ? digits.replace(/^(\\d{5})(\\d{3})$/, '$1-$2') : digits;
};
const deliveryChoice = () => /\\b(entrega|entregar|delivery|motoboy|mandar|enviar)\\b/.test(normalized);
const pickupChoice = () => /\\b(retirada|retirar|busco|buscar|pego|pegar|loja)\\b/.test(normalized);
const separationIntent = () => /\\b(pode separar|separa|separe|vou querer|quero|pode ser|fechado|combinado)\\b/.test(normalized);
const paymentChoice = () => {
  if (/\\b(pix)\\b/.test(normalized)) return 'pix';
  if (/\\b(cartao|cartão|credito|crédito|debito|débito|parcel)\\b/.test(normalized)) return 'card';
  if (/\\b(dinheiro|especie|espécie)\\b/.test(normalized)) return 'cash';
  return '';
};
const parsePickupTime = () => {
  const match = normalized.match(/\\b(\\d{1,2})(?:[:h](\\d{2}))?\\b/);
  if (!match) return '';
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2] || 0)));
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
};
const minutesOf = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 0;
};
const weekdayKey = (date = new Date()) => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
const ptDay = (key) => ({
  sunday: 'domingo',
  monday: 'segunda-feira',
  tuesday: 'terca-feira',
  wednesday: 'quarta-feira',
  thursday: 'quinta-feira',
  friday: 'sexta-feira',
  saturday: 'sabado',
}[key] || key);

async function getCompanySettings() {
  const fallback = {
    name: 'Mercado do Vale',
    address_street: 'ABILIO MOURATO CRUZ',
    address_number: '5',
    address_complement: 'LOJA C',
    address_neighborhood: 'COHAB MASSANGANO',
    address_city: 'PETROLINA',
    address_state: 'PE',
    pix_key: '',
    pix_beneficiary_name: 'Mercado do Vale',
    business_hours: {},
  };
  try {
    const res = await fetch('https://api.xiaomipetrolina.com.br/company-settings', {
      headers: { 'x-sync-key': $env.SYNC_SECRET || '', Accept: 'application/json' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : (data.rows?.[0] || data);
    return { ...fallback, ...(row || {}) };
  } catch (error) {
    return fallback;
  }
}

async function lookupDeliveryCep(cep) {
  const encodedCep = encodeURIComponent(cep);
  const providers = [
    {
      url: 'https://brasilapi.com.br/api/cep/v2/' + encodedCep,
      map: (data) => ({
        cep,
        street: data.street || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        latitude: data.location?.coordinates?.latitude || '',
        longitude: data.location?.coordinates?.longitude || '',
      }),
    },
    {
      url: 'https://brasilapi.com.br/api/cep/v1/' + encodedCep,
      map: (data) => ({
        cep,
        street: data.street || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        latitude: '',
        longitude: '',
      }),
    },
    {
      url: 'https://viacep.com.br/ws/' + encodedCep + '/json/',
      map: (data) => data?.erro ? null : ({
        cep,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        latitude: '',
        longitude: '',
      }),
    },
  ];

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const address = provider.map(data || {});
      if (address && (address.street || address.neighborhood || address.city || address.state)) {
        return address;
      }
    } catch (error) {
      // Try the next provider.
    }
  }
  return null;
}

const storeAddressText = (settings) => [
  [settings.address_street, settings.address_number].filter(Boolean).join(', '),
  settings.address_complement || '',
  settings.address_neighborhood || '',
  [settings.address_city, settings.address_state].filter(Boolean).join('/'),
].filter(Boolean).join(' - ');

const storeMapsLink = (settings) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(storeAddressText(settings) || settings.name || 'Mercado do Vale Petrolina');

const addressText = (address) => [
  [address.street, address.number].filter(Boolean).join(', '),
  address.complement || '',
  address.neighborhood || '',
  [address.city, address.state].filter(Boolean).join('/'),
  address.cep ? 'CEP: ' + formatCep(address.cep) : '',
].filter(Boolean).join(lineBreak);

const validatePickupTime = (time, settings) => {
  const todayKey = weekdayKey(new Date());
  const hours = settings.business_hours || {};
  const schedule = hours[todayKey] || {};
  if (!schedule.isOpen) {
    const nextKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      .find((key) => hours[key]?.isOpen);
    return {
      ok: false,
      message: 'Nesse dia a loja esta fechada.' + lineBreak + (nextKey ? 'Voltamos na ' + ptDay(nextKey) + ' as ' + (hours[nextKey].openTime || '08:00') + '.' : 'Me chama em outro horario para combinarmos a retirada.'),
    };
  }
  const selected = minutesOf(time);
  const open = minutesOf(schedule.openTime || '08:00');
  const close = minutesOf(schedule.closeTime || '18:00');
  if (selected < open) return { ok: false, message: 'Nesse horario a loja ainda estara fechada.' + lineBreak + 'Hoje abrimos as ' + (schedule.openTime || '08:00') + '. Pode ser depois desse horario?' };
  if (selected >= close) return { ok: false, message: 'Nesse horario a loja ja estara fechada.' + lineBreak + 'Hoje atendemos ate ' + (schedule.closeTime || '18:00') + '. Pode retirar antes desse horario?' };
  if (schedule.hasLunchBreak && selected >= minutesOf(schedule.lunchStart || '12:00') && selected < minutesOf(schedule.lunchEnd || '14:00')) {
    return { ok: false, message: 'Nesse horario estamos em pausa para almoco.' + lineBreak + 'Hoje voltamos as ' + (schedule.lunchEnd || '14:00') + '. Pode ser depois desse horario?' };
  }
  return { ok: true, message: 'Perfeito, vou deixar separado para retirada por volta de ' + time + '.' };
};

const paymentPrompt = () => 'Agora me fala a forma de pagamento:' + lineBreak + 'Pix, cartao ou dinheiro?';
const paymentReply = (method, settings) => {
  if (method === 'pix') {
    return [
      'Perfeito, pagamento no Pix.',
      settings.pix_key ? 'Chave Pix: ' + settings.pix_key : 'Vou te enviar a chave Pix da loja.',
      settings.pix_beneficiary_name ? 'Beneficiario: ' + settings.pix_beneficiary_name : '',
      'Depois me manda o comprovante por aqui, por favor. 😊',
    ].filter(Boolean).join(lineBreak);
  }
  if (method === 'card') return 'Perfeito, pagamento no cartao.' + lineBreak + 'A equipe finaliza as condicoes e parcelas com voce.';
  if (method === 'cash') return 'Perfeito, pagamento em dinheiro.' + lineBreak + 'A equipe confirma o troco, se precisar.';
  return paymentPrompt();
};
`;

const stateHandlers = `
if (activeState?.step === 'awaiting_fulfillment') {
  if (deliveryChoice()) {
    activeState.step = 'awaiting_delivery_zip';
    activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery' };
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Combinado: entrega.' + lineBreak + 'Me manda o CEP para eu localizar o endereco de entrega.') } }];
  }
  if (pickupChoice()) {
    const settings = await getCompanySettings();
    activeState.step = 'awaiting_pickup_time';
    activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'pickup', storeAddress: storeAddressText(settings), storeMapsLink: storeMapsLink(settings) };
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Combinado. Vou deixar separado para retirada na loja.' + lineBreak + 'Nossa localizacao: ' + storeMapsLink(settings) + lineBreak + 'Que horas mais ou menos voce pretende retirar?') } }];
  }
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Vai ser para entrega ou retirada na loja?') } }];
}

if (activeState?.step === 'awaiting_delivery_zip') {
  const cep = cepFromText(text);
  if (!cep) {
    activeState.step = 'awaiting_delivery_location';
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Sem problema. Me manda sua localizacao pelo WhatsApp que eu localizo o endereco.') } }];
  }
  const found = await lookupDeliveryCep(cep);
  if (!found) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Nao consegui localizar esse CEP.' + lineBreak + 'Pode conferir os 8 numeros ou me mandar sua localizacao pelo WhatsApp?') } }];
  }
  activeState.step = 'awaiting_delivery_number_complement';
  activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: found };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.') } }];
}

if (activeState?.step === 'awaiting_delivery_location') {
  activeState.step = 'awaiting_delivery_number_complement';
  activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: { rawLocation: text || 'localizacao enviada pelo WhatsApp' } };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Recebi sua localizacao.' + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.') } }];
}

if (activeState?.step === 'awaiting_delivery_number_complement') {
  activeState.step = 'awaiting_payment_method';
  activeState.orderDraft = { ...activeState.orderDraft, deliveryNumberComplement: text };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Endereco anotado. 😊' + lineBreak + paymentPrompt()) } }];
}

if (activeState?.step === 'awaiting_pickup_time') {
  const pickupTime = parsePickupTime();
  if (!pickupTime) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Me fala mais ou menos que horas voce pretende retirar? Ex: 15:30') } }];
  }
  const settings = await getCompanySettings();
  const validation = validatePickupTime(pickupTime, settings);
  if (!validation.ok) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting(validation.message) } }];
  }
  activeState.step = 'awaiting_payment_method';
  activeState.orderDraft = { ...activeState.orderDraft, pickupTime };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting(validation.message + lineBreak + paymentPrompt()) } }];
}

if (activeState?.step === 'awaiting_payment_method') {
  const method = paymentChoice();
  const settings = await getCompanySettings();
  if (!method) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting(paymentPrompt()) } }];
  }
  activeState.step = 'awaiting_payment_confirmation';
  activeState.orderDraft = { ...activeState.orderDraft, paymentMethod: method, paymentLabel: paymentMethodLabels[method] || method };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting(paymentReply(method, settings)) } }];
}
`;

function patchPostListCode(code) {
  let next = String(code || '');
  const wrappedAsync = next.includes('return (async () => {');
  if (wrappedAsync) {
    next = next
      .replace(/^return \(async \(\) => \{\n/, '')
      .replace(/\n\}\)\(\);$/, '');
  }
  if (!next.includes('const lineBreak = ')) {
    next = next.replace(
      "const withGreeting = (message) => [periodGreeting(), message].filter(Boolean).join('|||');",
      "const withGreeting = (message) => [periodGreeting(), message].filter(Boolean).join('|||');\n" + postListHelpers.trim(),
    );
  }
  if (!next.includes("activeState?.step === 'awaiting_delivery_zip'")) {
    next = next.replace(
      "if (requestedQuantity > 0) {",
      stateHandlers.trim() + "\n\nif (requestedQuantity > 0) {",
    );
  }
  next = next.replace(
    "output: withGreeting('Certo 😊 Separei ' + requestedQuantity + ' ' + unidade + '. Voce prefere retirada na loja ou entrega?'),",
    "output: withGreeting('Certo 😊 Separei ' + requestedQuantity + ' ' + unidade + '.' + lineBreak + 'Voce prefere retirada na loja ou entrega?'),",
  );
  next = next.replace(
    "{ type: 'text', text: 'Gostou desse modelo? Posso separar ele para voce? 😊' },",
    "{ type: 'text', text: 'Gostou desse modelo?' + lineBreak + 'Posso separar ele para voce? 😊' },",
  );
  next = next.replace(
    "messages.push({ type: 'text', text: 'Gostou de alguma dessas cores? Posso separar para voce? 😊', delayMs: 1200 + messages.length * 4500 });",
    "messages.push({ type: 'text', text: 'Gostou de alguma dessas cores?' + lineBreak + 'Posso separar para voce? 😊', delayMs: 1200 + messages.length * 4500 });",
  );
  next = next.replace(
    "output: withGreeting('Perfeito 😊 Separei o ' + option.name + (option.memory ? ' ' + option.memory : '') + ' na cor ' + titleCase(variant.color) + '. Quantas unidades voce deseja?'),",
    "output: withGreeting('Perfeito 😊 Separei o ' + option.name + (option.memory ? ' ' + option.memory : '') + ' na cor ' + titleCase(variant.color) + '.' + lineBreak + 'Quantas unidades voce deseja?'),",
  );
  const duplicatePhotoBranch = `if (!variant && (wantsPhoto || wantsPhotoFromAI)) {
  activeState.step = 'awaiting_quantity';
  activeState.selectedOptionNumber = option.number;
  activeState.updatedAt = new Date(now).toISOString();
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      messages: buildAllPhotoMessages(optionColorItems),
    },
  }];
}

`;
  const first = next.indexOf(duplicatePhotoBranch);
  const second = first >= 0 ? next.indexOf(duplicatePhotoBranch, first + duplicatePhotoBranch.length) : -1;
  if (second >= 0) next = next.slice(0, second) + next.slice(second + duplicatePhotoBranch.length);
  const wrapped = `return (async () => {\n${next}\n})();`;
  new Function('$json', '$getWorkflowStaticData', '$env', wrapped);
  return wrapped;
}

const quoteChunkCode = `
const chunkSize = 5;
const buildQuoteMessageForProducts = (chunk, offset, includeHeader, includeQuestion) => {
  const chunkLines = [];
  if (includeHeader) {
    chunkLines.push('📱 Orçamento');
    chunkLines.push('📅 Data: ' + today);
    chunkLines.push('━━━━━━━━━━━━━━━━━━━━━━');
  }
  chunk.forEach((product, index) => {
    if (index > 0 || !includeHeader) chunkLines.push('━━━━━━━━━━━━━━━━━━━━━━');
    chunkLines.push((offset + index + 1) + '. ' + product.name);
    if (product.memory) chunkLines.push('   📱 ' + product.memory);
    chunkLines.push('   💰 ' + product.price + ' à vista no PIX');
    if (product.card) chunkLines.push('   💳 Cartão: 12x de ' + product.card.installment + ' (total ' + product.card.total + ')');
    if (product.colors?.length) chunkLines.push('   🎨 Cores: ' + product.colors.join(', '));
    if (product.url) chunkLines.push('   🔗 ' + product.url);
  });
  if (includeQuestion) {
    chunkLines.push('━━━━━━━━━━━━━━━━━━━━━━');
    chunkLines.push('Qual numero chamou mais sua atencao?');
  }
  return chunkLines.join('||');
};
const quoteMessages = products.length > 0
  ? Array.from({ length: Math.ceil(products.length / chunkSize) }, (_, chunkIndex) => {
      const offset = chunkIndex * chunkSize;
      const chunk = products.slice(offset, offset + chunkSize);
      const last = offset + chunk.length >= products.length;
      return buildQuoteMessageForProducts(chunk, offset, chunkIndex === 0, last);
    })
  : [quoteLines.join('||')];
`;

function patchProductContextCode(code) {
  let next = String(code || '');
  if (!next.includes('const chunkSize = 5;')) {
    next = next.replace(
      "try {\n  const staticData = $getWorkflowStaticData('global');",
      quoteChunkCode.trim() + "\n\ntry {\n  const staticData = $getWorkflowStaticData('global');",
    );
  }
  next = next.replace(
    "output: [greetingLine, quoteLines.join('||')].filter(Boolean).join('|||'),",
    "output: [greetingLine, ...quoteMessages].filter(Boolean).join('|||'),",
  );
  new Function('$json', '$input', '$getWorkflowStaticData', next);
  return next;
}

function patchWorkflow(nodes) {
  const postList = nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
  const productContext = nodes.find((node) => node.name === 'Vendas - Contexto Produtos');
  if (!postList || !productContext) throw new Error('Required sales nodes not found');
  postList.parameters.jsCode = patchPostListCode(postList.parameters.jsCode);
  productContext.parameters.jsCode = patchProductContextCode(productContext.parameters.jsCode);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" = ${shQuote(entity.activeVersionId)};

COPY (
  SELECT json_build_object(
    'deliveryZip', (SELECT (node->'parameters'->>'jsCode') LIKE '%awaiting_delivery_zip%' FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Verificar Pos Lista'),
    'payment', (SELECT (node->'parameters'->>'jsCode') LIKE '%awaiting_payment_method%' FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Verificar Pos Lista'),
    'chunkSize', (SELECT (node->'parameters'->>'jsCode') LIKE '%chunkSize = 5%' FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Contexto Produtos')
  )::text
) TO STDOUT;
`;
    const result = JSON.parse((await psql(conn, dbContainer, updateSql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
