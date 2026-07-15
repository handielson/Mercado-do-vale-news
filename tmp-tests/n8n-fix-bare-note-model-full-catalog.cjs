const vm = require('node:vm');
const { Client } = require('ssh2');
require('dotenv').config({
  path: 'C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.env.vps.local',
  quiet: true,
});
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const PREPARE_NODE = 'Vendas - Preparar Busca';
const CONTACT_RESPONSE_NODE = 'Contato - Resposta salvo';
const DRY_RUN = process.argv.includes('--dry-run');

function shQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = ''; let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}
async function waitService(conn, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`${name} not found`);
  return node;
}

function patchPrepareCode(code) {
  let next = String(code || '');
  if (!next.includes('implicitPhoneModelRequestV134')) {
    const oldLine = `const specificDeviceModelRequest = Boolean(requestedDeviceBrand && !accessoryRequest && modelTokens.length > 0);`;
    const newLines = `const implicitPhoneModelCandidateV134 = normalize([normalized, classifiedSearchQuery].filter(Boolean).join(' '));
const implicitPhoneModelRequestV134 = !accessoryRequest && /\\b(?:note\\s*\\d{1,3}(?:\\s*(?:pro|plus|max|ultra|lite|neo|5g|4g|\\+))*)\\b/.test(implicitPhoneModelCandidateV134);
const specificDeviceModelRequest = Boolean(
  (requestedDeviceBrand && !accessoryRequest && modelTokens.length > 0)
  || implicitPhoneModelRequestV134
);`;
    if (!next.includes(oldLine)) throw new Error('Specific-device marker not found');
    next = next.replace(oldLine, newLines);
  }
  new Function(next);
  return next;
}

function patchContactResponseCode(code) {
  let next = String(code || '');
  next = next.replace(
    `output: 'Prazer, ' + name + '! Salvei seu contato por aqui.|||Como posso ajudar você hoje na Mercado do Vale?',`,
    `output: 'Prazer, ' + name + '! Salvei seu contato por aqui.',`,
  );
  if (next.includes('Como posso ajudar você hoje na Mercado do Vale?')) {
    throw new Error('Old post-name restart message remains');
  }
  new Function(next);
  return next;
}

function patchContextCode(code) {
  let next = String(code || '');
  if (!next.includes('requestedModelRequiresPlusV134')) {
    const oldBlock = `const productMatchesRequestedModel = (product) => {
  if (!requestedDeviceModelQuery) return false;
  const requested = compactModelText(requestedDeviceModelQuery);
  const productText = compactModelText([product.name, product.originalName, product.brand].filter(Boolean).join(' '));
  return Boolean(requested && productText.includes(requested));
};`;
    const newBlock = `const productMatchesRequestedModel = (product) => {
  if (!requestedDeviceModelQuery) return false;
  const requested = compactModelText(requestedDeviceModelQuery);
  const rawProductModelTextV134 = [product.name, product.originalName, product.brand].filter(Boolean).join(' ');
  const productText = compactModelText(rawProductModelTextV134);
  const requestedModelRequiresPlusV134 = /\\+|\\bplus\\b/i.test(requestedDeviceModelQuery);
  const productModelHasPlusV134 = /\\+|\\bplus\\b/i.test(rawProductModelTextV134);
  if (requestedModelRequiresPlusV134 && !productModelHasPlusV134) return false;
  return Boolean(requested && productText.includes(requested));
};`;
    if (!next.includes(oldBlock)) throw new Error('Requested-model matcher marker not found');
    next = next.replace(oldBlock, newBlock);
  }
  new Function(next);
  return next;
}

function patchWorkflow(nodes) {
  const prepare = findNode(nodes, PREPARE_NODE);
  const context = findNode(nodes, 'Vendas - Contexto Produtos');
  const contactResponse = findNode(nodes, CONTACT_RESPONSE_NODE);
  prepare.parameters.jsCode = patchPrepareCode(prepare.parameters.jsCode);
  context.parameters.jsCode = patchContextCode(context.parameters.jsCode);
  contactResponse.parameters.jsCode = patchContactResponseCode(contactResponse.parameters.jsCode);
  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function(node.parameters.jsCode);
  }
}

function validateScenarios(nodes) {
  const code = findNode(nodes, PREPARE_NODE).parameters.jsCode;
  const base = {
    conversation: 'Vcs tem o note 15 pro+?',
    classificacaoMensagem: 'Vcs tem o note 15 pro+?',
    intencao: 'vendas_produtos',
    salesRequestKind: 'busca',
    salesSearchQuery: 'note 15 pro+',
    salesCategoryName: '', salesCategoryId: '',
    remoteJid: '559999999999@s.whatsapp.net', Instancia: 'botmercadodovale',
  };
  const run = (source) => vm.runInNewContext(`(function(){${code}})()`, { $json: source })[0].json;
  const note = run(base);
  const priceFollowup = run({ ...base, conversation: 'Qual valor?', classificacaoMensagem: 'Qual valor?' });
  const accessory = run({
    ...base,
    conversation: 'Capa para Note 15 Pro+', classificacaoMensagem: 'Capa para Note 15 Pro+',
    salesSearchQuery: 'Capa para Note 15 Pro+',
  });
  return {
    noteCategory: note.productCategoryId,
    noteModel: note.requestedDeviceModelQuery,
    priceFollowupCategory: priceFollowup.productCategoryId,
    priceFollowupModel: priceFollowup.requestedDeviceModelQuery,
    accessoryCategory: accessory.productCategoryId,
    accessoryRequest: accessory.accessoryRequest,
    accessoryModel: accessory.requestedDeviceModelQuery,
  };
}

async function validateCatalogResponse(nodes) {
  const prepareCode = findNode(nodes, PREPARE_NODE).parameters.jsCode;
  const contextCode = findNode(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const source = {
    conversation: 'Qual valor?', classificacaoMensagem: 'Qual valor?',
    intencao: 'vendas_produtos', salesRequestKind: 'busca', salesSearchQuery: 'note 15 pro+',
    salesCategoryName: '', salesCategoryId: '', clienteNome: 'Esdras',
    remoteJid: '559999999999@s.whatsapp.net', Instancia: 'botmercadodovale',
  };
  const prepare = vm.runInNewContext(`(function(){${prepareCode}})()`, { $json: source })[0].json;
  const [productsResponse, feesResponse] = await Promise.all([
    fetch(`https://api.xiaomipetrolina.com.br/products?category=${SMARTPHONES_CATEGORY_ID}&status=active&compact=true&limit=500&sort_by=stock_quantity&sort_direction=desc`),
    fetch('https://api.xiaomipetrolina.com.br/payment-fees'),
  ]);
  if (!productsResponse.ok || !feesResponse.ok) throw new Error('Catalog or payment-fees API request failed');
  const products = await productsResponse.json();
  const fees = await feesResponse.json();
  const staticData = {};
  const selectors = {
    'Vendas - Preparar Busca': { first: () => ({ json: prepare }) },
    'Vendas - Buscar Produtos': { all: () => products.map((json) => ({ json })) },
    'switc Mensagens': { first: () => ({ json: source }) },
  };
  const result = vm.runInNewContext(`(function(){${contextCode}})()`, {
    $input: { all: () => fees.map((json) => ({ json })) },
    $getWorkflowStaticData: () => staticData,
    $: (name) => selectors[name],
    Date, Intl,
  })[0].json;
  const messages = String(result.output || '').split('[[MSG]]').filter(Boolean);
  return {
    catalogApiRows: products.length,
    catalogProductsShown: result.productLookupCount,
    savedSelectableOptions: staticData.salesPostList?.[source.remoteJid]?.options?.length || 0,
    firstMessage: messages[0] || '',
    messageCount: messages.length,
    listHeaderPresent: messages.some((message) => /Celulares dispon/i.test(message)),
    finalQuestionPresent: messages.at(-1)?.includes('Qual numero chamou mais sua atencao?') || false,
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);
    const scenarios = validateScenarios(nodes);
    const catalog = await validateCatalogResponse(nodes);
    if (DRY_RUN) {
      console.log(JSON.stringify({ dryRun: true, scenarios, catalog, codeCompiles: true }, null, 2));
      return;
    }

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET
  nodes=${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
  connections=${dollar(JSON.stringify(connections), 'connectionsjson')}::json,
  "versionId"="activeVersionId", "updatedAt"=NOW()
WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET
  nodes=${dollar(JSON.stringify(nodes), 'historynodesjson')}::json,
  connections=${dollar(JSON.stringify(connections), 'historyconnectionsjson')}::json,
  "updatedAt"=NOW()
WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (
  SELECT json_build_object(
    'versionAligned', we."versionId"=we."activeVersionId",
    'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
    'bareNoteRecognition', we.nodes::text LIKE '%implicitPhoneModelRequestV134%',
    'plusModelDistinction', we.nodes::text LIKE '%requestedModelRequiresPlusV134%',
    'postNameRestartRemoved', we.nodes::text NOT LIKE '%Como posso ajudar você hoje na Mercado do Vale?%'
  )::text
  FROM workflow_entity we
  JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
  WHERE we.id=${shQuote(WORKFLOW_ID)}
) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(JSON.stringify({ ...result, scenarios, catalog }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { patchPrepareCode, patchContextCode, patchContactResponseCode, patchWorkflow, validateScenarios, validateCatalogResponse };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
