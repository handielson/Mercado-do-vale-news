const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const API_URL = 'https://api.xiaomipetrolina.com.br';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}

function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}

async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timeout waiting for ${serviceName}=${expected}/${expected}`);
}

function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((value) => JSON.parse(value.trim()));
}

const applyClientControlCode = `const source = $('Controle Bot - Verificar Cliente').first().json || {};
const payload = $json || {};
const remoteJid = String(source.remoteJid || '');
const staticData = $getWorkflowStaticData('global');
const control = payload.control || {};
const baseOutput = {
  ...source,
  n8nBotBlocked: false,
  n8nBotResetApplied: false,
  n8nBotControl: control,
  memorySessionKey: payload.memorySessionKey || remoteJid,
  conversationHistory: String(payload.conversationHistory || ''),
  recentMessages: Array.isArray(payload.recentMessages) ? payload.recentMessages : [],
  humanHandoffPaused: Boolean(payload.humanHandoffPaused || control.human_handoff_active),
};

baseOutput.n8nBotBlocked = Boolean(control.blocked || baseOutput.humanHandoffPaused);

if (payload.resetPending) {
  staticData.salesPostList = staticData.salesPostList || {};
  delete staticData.salesPostList[remoteJid];
  baseOutput.n8nBotResetApplied = true;
}

return [{ json: baseOutput }];`;

const registerManualCode = `const source = $json || {};
let webhookData = {};
try { webhookData = $('Webhook').first().json?.body?.data || {}; } catch (error) {}
const remoteJid = String(source.remoteJid || webhookData.key?.remoteJid || '').trim();
const messageId = String(source.messageId || source.id || source.key?.id || webhookData.key?.id || '').trim();
const messageSource = String(webhookData.source || source.source || '').trim().toLowerCase();
const staticData = $getWorkflowStaticData('global');
staticData.botSentMessageIds = staticData.botSentMessageIds || {};
const now = Date.now();

for (const [id, expiresAt] of Object.entries(staticData.botSentMessageIds)) {
  if (Number(expiresAt || 0) <= now) delete staticData.botSentMessageIds[id];
}

if (!remoteJid || !messageId) return [];
if (staticData.botSentMessageIds[messageId]) {
  delete staticData.botSentMessageIds[messageId];
  return [];
}
if (/^(api|bot|automation|n8n)$/.test(messageSource)) return [];

const message = String(
  source.conversation
  || source.text
  || webhookData.message?.conversation
  || webhookData.message?.extendedTextMessage?.text
  || ''
).trim();

return [{ json: {
  remoteJid,
  messageId,
  message,
  messageType: source.messageType || webhookData.messageType || 'text',
  handoffBy: messageSource ? 'whatsapp-' + messageSource : 'whatsapp-manual',
} }];`;

function wrapPromptWithHistory(text) {
  const raw = String(text || '');
  if (!raw.startsWith('={{') || !raw.endsWith('}}') || raw.includes('Historico recente da conversa')) return raw;
  const expression = raw.slice(3, -2);
  return `={{($json.conversationHistory ? 'Historico recente da conversa (use apenas como contexto; priorize a mensagem atual):\\n' + $json.conversationHistory + '\\n\\n' : '') + (${expression})}}`;
}

function patchWorkflow(nodes, connections) {
  const byName = (name) => nodes.find((node) => node.name === name);
  const applyControl = byName('Controle Bot - Aplicar Controle');
  const registerManual = byName('Handoff - Registrar manual');
  const splitter = byName('Dividir mensagens');
  if (!applyControl || !registerManual || !splitter) throw new Error('Required workflow nodes not found');

  applyControl.parameters = { jsCode: applyClientControlCode };
  registerManual.parameters = { jsCode: registerManualCode };

  const persistNode = {
    id: 'handoff-persist-api-001',
    name: 'Handoff - Persistir manual',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [384, -432],
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 1500,
    parameters: {
      method: 'POST',
      url: `${API_URL}/n8n-bot/client-control/handoff`,
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
      sendBody: true,
      bodyParameters: { parameters: [
        { name: 'remoteJid', value: '={{$json.remoteJid}}' },
        { name: 'messageId', value: '={{$json.messageId}}' },
        { name: 'message', value: '={{$json.message}}' },
        { name: 'messageType', value: '={{$json.messageType}}' },
        { name: 'handoffBy', value: '={{$json.handoffBy}}' },
        { name: 'durationSeconds', value: 7200 },
      ] },
      options: {},
    },
  };
  const persistIndex = nodes.findIndex((node) => node.name === persistNode.name);
  if (persistIndex >= 0) nodes[persistIndex] = { ...nodes[persistIndex], ...persistNode };
  else nodes.push(persistNode);

  for (const name of ['Handoff - Verificar pausa', 'Handoff ativo?']) {
    const index = nodes.findIndex((node) => node.name === name);
    if (index >= 0) nodes.splice(index, 1);
    delete connections[name];
  }
  connections['Handoff - Registrar manual'] = {
    main: [[{ node: 'Handoff - Persistir manual', type: 'main', index: 0 }]],
  };
  connections['Handoff - Persistir manual'] = { main: [[]] };
  connections['Controle Bot - Bloqueado?'] = {
    main: [[], [{ node: 'Contato - Preparar', type: 'main', index: 0 }]],
  };

  for (const name of ['Agente Inicial - Classificador', 'Agente Geral - Atendimento', 'Especialista - Vendas']) {
    const node = byName(name);
    if (node?.parameters?.text) node.parameters.text = wrapPromptWithHistory(node.parameters.text);
  }

  let splitCode = String(splitter.parameters?.jsCode || '');
  if (!splitCode.includes('alreadyInvitedInHistory')) {
    splitCode = splitCode.replace(
      'const shouldInviteName = Boolean(remoteJid)',
      "const recentHistory = String($json.conversationHistory || source.conversationHistory || contact.conversationHistory || '');\nconst alreadyInvitedInHistory = /como (voce|você) prefere ser chamado/i.test(recentHistory);\nconst shouldInviteName = !alreadyInvitedInHistory && Boolean(remoteJid)",
    );
  }
  if (!splitCode.includes('alreadyInvitedInHistory')) throw new Error('Could not patch repeated name invitation');
  splitter.parameters.jsCode = splitCode;

  new Function('$json', '$getWorkflowStaticData', registerManualCode);
  new Function('$json', '$getWorkflowStaticData', applyClientControlCode);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
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
      FROM workflow_entity WHERE id = ${shQuote(WORKFLOW_ID)}
    `);
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);

    const sql = `
\\set ON_ERROR_STOP on
UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodes')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connections')}::json,
    "versionId" = "activeVersionId",
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'historynodes')}::json,
    connections = ${dollar(JSON.stringify(connections), 'historyconnections')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" = ${shQuote(entity.activeVersionId)};

COPY (
  SELECT json_build_object(
    'versionAligned', we."versionId" = we."activeVersionId",
    'persistentNode', we.nodes::jsonb @> '[{"name":"Handoff - Persistir manual"}]'::jsonb,
    'oldStaticPauseRemoved', NOT (we.nodes::jsonb @> '[{"name":"Handoff - Verificar pausa"}]'::jsonb),
    'historyInjected', we.nodes::text LIKE '%Historico recente da conversa%',
    'nameInvitationGuard', we.nodes::text LIKE '%alreadyInvitedInHistory%'
  )::text
  FROM workflow_entity we WHERE we.id = ${shQuote(WORKFLOW_ID)}
) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, dbContainer, sql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitServiceReplicas(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitServiceReplicas(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { patchWorkflow, wrapPromptWithHistory };
