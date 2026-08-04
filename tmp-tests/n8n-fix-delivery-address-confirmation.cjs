const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// delivery-address-confirmation-v163';
const FREE_DELIVERY_MIN_CENTS = 19900;

function deliveryPolicyCoreV163(address = {}, orderTotalCents = 0) {
  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const city = normalize(address.city || address.localidade || '');
  const state = normalize(address.state || address.uf || '');
  const locationText = normalize([
    address.street, address.neighborhood, address.city, address.state, address.rawLocation,
  ].filter(Boolean).join(' '));
  const rural = ['zona rural', 'interior', 'sitio', 'fazenda', 'projeto', 'nucleo', 'assentamento', 'povoado', 'ilha']
    .some((word) => locationText.includes(word));
  const supportedUrban = !rural && (
    (city === 'petrolina' && state === 'pe')
    || (city === 'juazeiro' && state === 'ba')
  );
  const totalCents = Math.max(0, Number(orderTotalCents || 0));
  const free = supportedUrban && totalCents > 19900;
  return {
    status: free ? 'free' : 'needs_review',
    free,
    supportedUrban,
    rural,
    orderTotalCents: totalCents,
    thresholdCents: 19900,
    thresholdMet: totalCents > 19900,
    customerShareCents: free ? 0 : null,
    reason: free
      ? 'compra acima de R$ 199,00 na area urbana de Petrolina-PE ou Juazeiro-BA'
      : (supportedUrban ? 'valor da compra ainda nao atende ou nao foi confirmado' : 'localidade requer verificacao do frete'),
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
const FREE_DELIVERY_MIN_CENTS_V163 = ${FREE_DELIVERY_MIN_CENTS};
const deliveryPolicyCoreV163 = ${deliveryPolicyCoreV163.toString()};
const deliveryPolicyLineV163 = (quote) => {
  if (quote?.free) return 'Para esta compra, a entrega e gratuita. 🛵';
  if (quote?.supportedUrban && Number(quote?.orderTotalCents || 0) <= 0) {
    return 'Nessa area, a entrega e gratuita para compras acima de R$ 199,00. Assim que voce escolher o produto, eu confirmo a condicao para voce.';
  }
  return 'A taxa de entrega precisa ser confirmada depois do endereco e do valor da compra. Nao vou informar nenhum valor antes dessa verificacao.';
};`;

const cepResolverCode = `${MARKER}
const source = $('Vendas - Verificar Pos Lista').first().json || {};
const response = $json || {};
const staticData = $getWorkflowStaticData('global');
staticData.salesPostList = staticData.salesPostList || {};

const remoteJid = String(source.remoteJid || '');
const activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;
const lineBreak = '[[BR]]';
const onlyDigits = (value) => String(value || '').replace(/\\D/g, '');
const formatCep = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 8 ? digits.replace(/^(\\d{5})(\\d{3})$/, '$1-$2') : digits;
};
const addressText = (address) => [
  [address.street, address.number].filter(Boolean).join(', '),
  address.complement || '',
  address.neighborhood || '',
  [address.city, address.state].filter(Boolean).join('/'),
  address.cep ? 'CEP: ' + formatCep(address.cep) : '',
].filter(Boolean).join(lineBreak);

const found = response && !response.erro && (response.logradouro || response.bairro || response.localidade || response.uf)
  ? {
      cep: source.deliveryCep || onlyDigits(response.cep),
      street: response.logradouro || '',
      neighborhood: response.bairro || '',
      city: response.localidade || '',
      state: response.uf || '',
      latitude: '',
      longitude: '',
    }
  : null;

if (!activeState || activeState.step !== 'awaiting_delivery_zip') {
  return [{ json: { ...source, salesPostListHandled: true, output: 'Me manda novamente o CEP para eu localizar o endereco de entrega.' } }];
}
if (!found) {
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    output: 'Nao consegui localizar esse CEP.' + lineBreak + 'Pode conferir os 8 numeros e me mandar novamente?',
  } }];
}

activeState.step = 'awaiting_delivery_address_confirmation';
activeState.orderDraft = {
  ...(activeState.orderDraft || {}),
  fulfillment: 'delivery',
  deliveryAddress: found,
  deliveryAddressConfirmed: false,
};
delete activeState.orderDraft.deliveryFreight;
activeState.updatedAt = new Date().toISOString();

return [{ json: {
  ...source,
  needsDeliveryCepLookup: false,
  salesPostListHandled: true,
  salesPostListStep: activeState.step,
  orderDraft: activeState.orderDraft,
  output: 'Localizei este endereco:' + lineBreak + addressText(found) + lineBreak + lineBreak
    + 'Esse endereco confere? Se estiver certo, responda sim. Se nao estiver, me envie o CEP correto.',
} }];`;

const deliveryPolicyCode = `${MARKER}
const source = $json || {};
const output = [
  'Para entregas, primeiro localizo o CEP e confirmo o endereco com voce. 🛵',
  'Na area urbana de Petrolina-PE e Juazeiro-BA, a entrega e gratuita para compras acima de R$ 199,00.',
  'Depois da confirmacao do endereco e do produto, verificamos a condicao do frete. Nenhum valor e informado antes disso.',
].join('[[BR]]');
return [{ json: { ...source, output } }];`;

const standaloneCepAndConfirmationBlock = `
const directCepV163 = cepFromText(text);
const deliveryStateV163 = String(activeState?.step || '');
const shouldLookupCepV163 = Boolean(directCepV163) && (
  /\\bcep\\b/.test(normalized)
  || String(source.conversationAction || '') === 'buscar_cep'
  || ['awaiting_delivery_zip', 'awaiting_delivery_location'].includes(deliveryStateV163)
);
if (shouldLookupCepV163) {
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
    if (!['awaiting_delivery_zip', 'awaiting_delivery_address_confirmation'].includes(deliveryStateV163)) {
      activeState.deliveryPreviousStep = deliveryStateV163;
    }
    activeState.step = 'awaiting_delivery_zip';
    activeState.orderDraft = { ...(activeState.orderDraft || {}), fulfillment: 'delivery' };
  }
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    needsDeliveryCepLookup: true,
    deliveryCep: directCepV163,
    orderDraft: activeState.orderDraft,
  } }];
}

if (activeState?.step === 'awaiting_delivery_address_confirmation') {
  const confirmsAddressV163 = /^(?:sim|isso|correto|correta|certo|certa|confere|confirmo|esta certo|esta correta|ta certo|pode ser)$/.test(normalized);
  const rejectsAddressV163 = /^(?:nao|errado|errada|nao confere|outro|outro cep)$/.test(normalized);
  if (rejectsAddressV163) {
    activeState.step = 'awaiting_delivery_zip';
    activeState.orderDraft = { ...(activeState.orderDraft || {}), deliveryAddressConfirmed: false };
    delete activeState.orderDraft.deliveryAddress;
    delete activeState.orderDraft.deliveryFreight;
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      output: 'Sem problema. Me envie o CEP correto para eu localizar novamente.',
    } }];
  }
  if (!confirmsAddressV163) {
    const address = activeState.orderDraft?.deliveryAddress || {};
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      output: 'Preciso confirmar o endereco antes de verificar o frete.' + lineBreak
        + addressText(address) + lineBreak + 'Esse endereco confere? Responda sim ou me envie o CEP correto.',
    } }];
  }

  const addressV163 = activeState.orderDraft?.deliveryAddress || {};
  const orderTotalV163 = getOrderTotalCents(activeState.orderDraft || {});
  const freightV163 = deliveryPolicyCoreV163(addressV163, orderTotalV163);
  const hasSelectedProductV163 = Boolean(activeState.orderDraft?.productId);
  activeState.orderDraft = {
    ...(activeState.orderDraft || {}),
    deliveryAddressConfirmed: true,
    deliveryAddressConfirmedAt: new Date(now).toISOString(),
    deliveryFreight: freightV163,
  };
  activeState.updatedAt = new Date(now).toISOString();
  if (hasSelectedProductV163) {
    activeState.step = 'awaiting_delivery_number_complement';
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      output: 'Endereco confirmado. 😊' + lineBreak + deliveryPolicyLineV163(freightV163) + lineBreak
        + 'Agora me manda o numero da casa e o complemento, se tiver.',
    } }];
  }

  activeState.step = String(activeState.deliveryPreviousStep || 'awaiting_product_choice');
  delete activeState.deliveryPreviousStep;
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    orderDraft: activeState.orderDraft,
    output: 'Endereco confirmado. 😊' + lineBreak + deliveryPolicyLineV163(freightV163),
  } }];
}
`;

function patchPostList(nodes) {
  const node = nodeByName(nodes, 'Vendas - Verificar Pos Lista');
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    const freightStart = code.indexOf('const DELIVERY_FREIGHT_TABLE = {');
    const freightEndMarker = 'const paymentMethodLabels =';
    const freightEnd = code.indexOf(freightEndMarker, freightStart);
    if (freightStart < 0 || freightEnd < 0) throw new Error('Old freight helper block not found');
    code = code.slice(0, freightStart) + deliveryHelpers + '\n' + code.slice(freightEnd);

    const oldActive = "const activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;";
    const newActive = "let activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;";
    if (!code.includes(oldActive)) throw new Error('Active state declaration not found');
    code = code.replace(oldActive, newActive);

    const insertionPoint = 'const normalized = normalize(text);';
    if (!code.includes(insertionPoint)) throw new Error('Delivery state insertion point not found');
    code = code.replace(insertionPoint, `${insertionPoint}${standaloneCepAndConfirmationBlock}`);

    const oldDeliveryPrompt = "output: withGreeting('Combinado: entrega.' + lineBreak + 'Entrega gratuita para area urbana de Petrolina-PE e Juazeiro-BA.' + lineBreak + 'Para outras localidades, eu confirmo o frete pelo endereco. Me manda o CEP para eu localizar a entrega.')";
    const newDeliveryPrompt = "output: withGreeting('Combinado: entrega.' + lineBreak + 'Primeiro vou localizar o CEP e confirmar o endereco com voce.' + lineBreak + 'Na area urbana de Petrolina-PE e Juazeiro-BA, a entrega e gratuita para compras acima de R$ 199,00. Me manda o CEP, por favor.')";
    if (!code.includes(oldDeliveryPrompt)) throw new Error('Old delivery prompt not found');
    code = code.replace(oldDeliveryPrompt, newDeliveryPrompt);

    const oldRawLocation = `if (activeState?.step === 'awaiting_delivery_location') {
  activeState.step = 'awaiting_delivery_number_complement';
  const rawFreight = deliveryFreightQuote({ rawLocation: text || 'localizacao enviada pelo WhatsApp' });
  activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: { rawLocation: text || 'localizacao enviada pelo WhatsApp' }, deliveryFreight: rawFreight };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Recebi sua localizacao.' + lineBreak + deliveryFreightLine(rawFreight) + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.') } }];
}`;
    const newRawLocation = `if (activeState?.step === 'awaiting_delivery_location') {
  activeState.step = 'awaiting_delivery_address_confirmation';
  activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: { rawLocation: text || 'localizacao enviada pelo WhatsApp' }, deliveryAddressConfirmed: false };
  delete activeState.orderDraft.deliveryFreight;
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Recebi sua localizacao.' + lineBreak + 'Esse endereco confere? Responda sim para eu continuar ou me envie o CEP correto.') } }];
}`;
    if (!code.includes(oldRawLocation)) throw new Error('Old raw-location freight block not found');
    code = code.replace(oldRawLocation, newRawLocation);

    const oldSummaryFreight = "if (draft.deliveryFreight) parts.push('Frete: ' + (draft.deliveryFreight.free ? 'gratis' : formatMoney(draft.deliveryFreight.customerShareCents)));";
    const newSummaryFreight = `if (draft.deliveryFreight) {
      if (draft.deliveryFreight.free) parts.push('Frete: gratis');
      else if (Number(draft.deliveryFreight.customerShareCents || 0) > 0) parts.push('Frete: ' + formatMoney(draft.deliveryFreight.customerShareCents));
      else parts.push('Frete: a confirmar');
    }`;
    if (!code.includes(oldSummaryFreight)) throw new Error('Old order-summary freight line not found');
    code = code.replace(oldSummaryFreight, newSummaryFreight);
  }
  for (const removed of ['DELIVERY_FREIGHT_TABLE', 'deliveryFreightQuote(', 'deliveryFreightLine(', 'defaultMotoboyFeeCents']) {
    if (code.includes(removed)) throw new Error(`Old freight runtime remains: ${removed}`);
  }
  if (!code.includes("activeState?.step === 'awaiting_delivery_address_confirmation'")) throw new Error('Address confirmation state missing');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  patchPostList(nodes);
  nodeByName(nodes, 'Vendas - Resolver CEP HTTP').parameters.jsCode = cepResolverCode;
  nodeByName(nodes, 'Entrega - Politica').parameters.jsCode = deliveryPolicyCode;
  new Function(cepResolverCode);
  new Function(deliveryPolicyCode);
  return nodes;
}

function summarize(nodes) {
  const post = nodeByName(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const resolver = nodeByName(nodes, 'Vendas - Resolver CEP HTTP').parameters.jsCode;
  const policy = nodeByName(nodes, 'Entrega - Politica').parameters.jsCode;
  return {
    postMarker: post.includes(MARKER),
    resolverMarker: resolver.includes(MARKER),
    policyMarker: policy.includes(MARKER),
    confirmationBeforeFreight: resolver.includes("awaiting_delivery_address_confirmation") && !resolver.includes('deliveryPolicyCoreV163') && !resolver.includes('customerShareCents'),
    thresholdRule: post.includes('totalCents > 19900'),
    correctCities: post.includes("city === 'petrolina'") && post.includes("city === 'juazeiro'"),
    standaloneCepHandled: post.includes('shouldLookupCepV163'),
    genericPolicySafe: policy.includes('Nenhum valor e informado antes disso.'),
    oldFeeTableRemoved: ![post, resolver, policy].some((code) => /DELIVERY_FREIGHT_TABLE|defaultMotoboyFeeCents|storeShareCents/.test(code)),
    oldImmediateFeeRemoved: !resolver.includes('deliveryFreightLine') && !resolver.includes('Frete estimado'),
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
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);
    const summary = summarize(nodes);
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
  'markerCount', (length(we.nodes::text)-length(replace(we.nodes::text, 'delivery-address-confirmation-v163', '')))/length('delivery-address-confirmation-v163'),
  'oldFeeTableRemoved', we.nodes::text NOT LIKE '%DELIVERY_FREIGHT_TABLE%' AND we.nodes::text NOT LIKE '%defaultMotoboyFeeCents%',
  'confirmationStatePresent', we.nodes::text LIKE '%awaiting_delivery_address_confirmation%',
  'thresholdPresent', we.nodes::text LIKE '%totalCents > 19900%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({ apply: true, ...result, ...summary, services: {
      n8n: services.n8n_n8n,
      runner: services['n8n_n8n-runner'],
      evolution: services['n8n_evolution-api'],
    } }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { deliveryPolicyCoreV163, cepResolverCode, deliveryPolicyCode, patchWorkflow, summarize };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
