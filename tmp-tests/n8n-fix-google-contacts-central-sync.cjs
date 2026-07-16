const { Client } = require('ssh2');
const path = require('node:path');
const dotenv = require('dotenv');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  dotenv.config({ path: path.join(root, '.env.vps.local'), quiet: true });
  dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');

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
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  }));
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
function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function syncHttpParameters(nameExpression) {
  return {
    method: 'POST',
    url: 'https://api.xiaomipetrolina.com.br/google-contacts/sync',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: `={{JSON.stringify({ phone: $json.phoneE164, name: ${nameExpression} })}}`,
    options: { response: { response: { neverError: true, responseFormat: 'json' } } },
  };
}

function patchWorkflow(nodes, connections) {
  const search = findNode(nodes, 'Contato - Buscar Google');
  search.credentials = undefined;
  search.continueOnFail = true;
  search.onError = 'continueRegularOutput';
  search.parameters = {
    url: 'https://api.xiaomipetrolina.com.br/google-contacts/search',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
    sendQuery: true,
    queryParameters: { parameters: [
      { name: 'q', value: '={{$json.phoneE164}}' },
      { name: 'limit', value: '10' },
    ] },
    options: { response: { response: { neverError: true, responseFormat: 'json' } } },
  };

  const resolverCode = `const base = $('Contato - Preparar').first().json;
const cachedCustomerName = String(base.cachedCustomerName || '').trim();
if (cachedCustomerName) return [{ json: { ...base, contactExists: true, clienteNome: cachedCustomerName, googleContactResourceName: '', googleContact: null, contactNameSource: 'workflowStaticCache' } }];
const response = $json || {};
const contacts = Array.isArray(response.data) ? response.data : [];
const digits = (value) => String(value || '').replace(/\\D/g, '');
const phoneKeys = (value) => {
  const raw = digits(value); if (!raw) return [];
  const normalized = raw.startsWith('55') ? raw : (raw.length >= 10 && raw.length <= 11 ? '55' + raw : raw);
  const keys = new Set([normalized]);
  if (normalized.startsWith('55') && normalized.length === 12) keys.add(normalized.slice(0, 4) + '9' + normalized.slice(4));
  if (normalized.startsWith('55') && normalized.length === 13 && normalized[4] === '9') keys.add(normalized.slice(0, 4) + normalized.slice(5));
  return [...keys];
};
const expected = phoneKeys(base.phoneDigits);
const matched = contacts.find((contact) => phoneKeys(contact.phone_digits || contact.phone).some((key) => expected.includes(key))) || null;
const googleName = String(matched?.name || '').trim();
const whatsappName = String(base.whatsappDisplayName || '').trim();
if (googleName && base.remoteJid) {
  const staticData = $getWorkflowStaticData('global');
  staticData.googleContactNameCache = staticData.googleContactNameCache || {};
  staticData.googleContactNameCache[base.remoteJid] = googleName;
}
return [{ json: { ...base, contactExists: Boolean(matched), clienteNome: googleName || whatsappName, googleContactResourceName: matched?.resource_name || '', googleContact: matched, contactNameSource: matched ? 'googleContactsApi' : (whatsappName ? 'whatsappPushName' : ''), googleContactsConfigured: response.configured !== false } }];`;
  findNode(nodes, 'Contato - Resolver').parameters.jsCode = resolverCode;

  const create = findNode(nodes, 'Contato - Criar Google');
  create.credentials = undefined;
  create.continueOnFail = true;
  create.onError = 'continueRegularOutput';
  create.parameters = syncHttpParameters('$json.possibleCustomerName');

  const savedCode = `const source = $('Contato - Preparar').first().json;
const name = String(source.possibleCustomerName || '').trim();
const remoteJid = String(source.remoteJid || '').trim();
const sync = $json || {};
if (sync.ok === true && remoteJid && name) {
  const staticData = $getWorkflowStaticData('global');
  staticData.googleContactNameCache = staticData.googleContactNameCache || {};
  staticData.googleContactNameCache[remoteJid] = name;
}
const output = sync.ok === true
  ? 'Prazer, ' + name + '! Salvei seu contato por aqui.'
  : 'Prazer, ' + name + '! Entendi seu nome, mas não consegui salvar na agenda agora. Vou continuar seu atendimento normalmente.';
return [{ json: { ...source, contactExists: sync.ok === true, clienteNome: name, contactNameSource: sync.ok === true ? 'savedThisExecution' : 'informedThisExecution', googleContactSyncOk: sync.ok === true, output, remoteJid, Instancia: source.Instancia } }];`;
  findNode(nodes, 'Contato - Resposta salvo').parameters.jsCode = savedCode;

  upsertNode(nodes, {
    id: 'contact-whatsapp-name-available-v136', name: 'Contato - Nome WhatsApp confiavel?',
    type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [-1650, 520],
    parameters: { options: {}, conditions: { options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'strict' }, combinator: 'and', conditions: [{ id: 'whatsapp-name-present-v136', leftValue: '={{$json.whatsappDisplayName}}', rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }] } },
  });
  upsertNode(nodes, {
    id: 'contact-sync-whatsapp-name-v136', name: 'Contato - Sincronizar nome WhatsApp',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [-1430, 470],
    continueOnFail: true, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 500,
    parameters: syncHttpParameters('$json.whatsappDisplayName'),
  });
  const continueCode = `const source = $('Contato - Resolver').first().json;
const sync = $json || {};
const name = String(source.whatsappDisplayName || '').trim();
if (sync.ok === true && source.remoteJid && name) {
  const staticData = $getWorkflowStaticData('global');
  staticData.googleContactNameCache = staticData.googleContactNameCache || {};
  staticData.googleContactNameCache[source.remoteJid] = name;
}
return [{ json: { ...source, contactExists: sync.ok === true, clienteNome: name || source.clienteNome, contactNameSource: sync.ok === true ? 'googleContactsSyncedFromPushName' : source.contactNameSource, googleContactSyncOk: sync.ok === true } }];`;
  upsertNode(nodes, {
    id: 'contact-continue-after-sync-v136', name: 'Contato - Continuar apos sincronizacao',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [-1210, 470], parameters: { jsCode: continueCode },
  });

  connections['Contato encontrado?'].main[1] = [{ node: 'Contato - Nome WhatsApp confiavel?', type: 'main', index: 0 }];
  connections['Contato - Nome WhatsApp confiavel?'] = { main: [
    [{ node: 'Contato - Sincronizar nome WhatsApp', type: 'main', index: 0 }],
    [{ node: 'Contato - Nome opcional informado?', type: 'main', index: 0 }],
  ] };
  connections['Contato - Sincronizar nome WhatsApp'] = { main: [[{ node: 'Contato - Continuar apos sincronizacao', type: 'main', index: 0 }]] };
  connections['Contato - Continuar apos sincronizacao'] = { main: [[{ node: 'Vendas - Preparar Contexto IA', type: 'main', index: 0 }]] };

  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function(node.parameters.jsCode);
  }
}

function summarize(nodes, connections) {
  const search = findNode(nodes, 'Contato - Buscar Google');
  const create = findNode(nodes, 'Contato - Criar Google');
  return {
    searchUsesCentralApi: search.parameters?.url === 'https://api.xiaomipetrolina.com.br/google-contacts/search',
    createUsesCentralApi: create.parameters?.url === 'https://api.xiaomipetrolina.com.br/google-contacts/sync',
    searchHasGoogleCredential: Boolean(search.credentials),
    createHasGoogleCredential: Boolean(create.credentials),
    autoSyncRoute: connections['Contato encontrado?']?.main?.[1]?.[0]?.node,
    autoSyncContinuesConversation: connections['Contato - Continuar apos sincronizacao']?.main?.[0]?.[0]?.node,
    savedReplyChecksSuccess: /sync\.ok === true/.test(findNode(nodes, 'Contato - Resposta salvo').parameters.jsCode),
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', \"activeVersionId\")::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);
    const summary = summarize(nodes, connections);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); servicesStopped = true;
    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, \"versionId\"=\"activeVersionId\", \"updatedAt\"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, \"updatedAt\"=NOW() WHERE \"workflowId\"=${shQuote(WORKFLOW_ID)} AND \"versionId\"=${shQuote(entity.activeVersionId)};
COPY (SELECT json_build_object('entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb, 'centralSearch', we.nodes::text LIKE '%api.xiaomipetrolina.com.br/google-contacts/search%', 'centralSync', we.nodes::text LIKE '%api.xiaomipetrolina.com.br/google-contacts/sync%', 'autoSyncRoute', we.connections::text LIKE '%Contato - Sincronizar nome WhatsApp%')::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); servicesStopped = false;
    console.log(JSON.stringify({ apply: true, ...result, ...summary }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { patchWorkflow, summarize };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
