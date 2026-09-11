const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const API_URL = 'https://api.xiaomipetrolina.com.br';
const MARKER = 'persistent-conversation-state-v1';
const ORDER_MARKER = 'persistent-conversation-event-order-v2';
const APPLY = process.argv.includes('--apply');
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}

function psql(connection, container, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${shQuote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
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

async function waitService(connection, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `Node not found: ${name}`);
  return node;
}

function patchEventSource(workflow) {
  const node = findNode(workflow.nodes, 'Dados');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${ORDER_MARKER}:source`)) return;
  assert.match(code, /const eventTimestampMsV226\s*=/, 'Inbound event timestamp anchor not found');
  const anchor = 'const base = {';
  assert.ok(code.includes(anchor), 'Inbound base payload anchor not found');
  code = code.replace(anchor, `${anchor}
  // ${ORDER_MARKER}:source
  conversationEventVersion: (Math.max(eventTimestampMsV226, Date.now()) * 1000)
    + (Number(String(typeof $execution !== 'undefined' ? $execution.id : '').replace(/\\D/g, '')) % 1000 || 0),`);
  new Function(code);
  node.parameters.jsCode = code;
}

function patchHydration(node) {
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(`${MARKER}:hydrate`)) {
    const anchor = 'baseOutput.n8nBotBlocked = Boolean(control.blocked || baseOutput.humanHandoffPaused);';
    assert.ok(code.includes(anchor), 'Client-control hydration anchor not found');
    const hydration = `// ${MARKER}:hydrate
const persistedConversationState = control.conversation_state && typeof control.conversation_state === 'object'
  ? control.conversation_state : {};
const persistedConversationRevision = Number(control.conversation_state_revision || 0);
baseOutput.conversationStateRevision = persistedConversationRevision;
for (const key of ['salesPostList', 'pendingDeviceClarification']) {
  staticData[key] = staticData[key] || {};
  const persistedEntry = persistedConversationState[key];
  const persistedActive = persistedEntry && typeof persistedEntry === 'object'
    && (!Number(persistedEntry.expiresAt || 0) || Number(persistedEntry.expiresAt) > Date.now());
  if (persistedConversationRevision > 0) {
    if (persistedActive) staticData[key][remoteJid] = persistedEntry;
    else delete staticData[key][remoteJid];
  }
}

${anchor}`;
    code = code.replace(anchor, hydration);
  }
  if (!code.includes(`${ORDER_MARKER}:event`)) {
    const eventAnchor = 'baseOutput.conversationStateRevision = persistedConversationRevision;';
    assert.ok(code.includes(eventAnchor), 'Conversation-state event ordering anchor not found');
    code = code.replace(eventAnchor, `${eventAnchor}
// ${ORDER_MARKER}:event
const directConversationEventVersion = Number(source.conversationEventVersion || 0);
const rawConversationEventTimestamp = source.messageTimestamp
  ?? source.message_timestamp
  ?? source.message?.messageTimestamp
  ?? source.timestamp
  ?? null;
const numericConversationEventTimestamp = Number(rawConversationEventTimestamp);
const parsedConversationEventTimestampMs = Number.isFinite(numericConversationEventTimestamp) && numericConversationEventTimestamp > 0
  ? (numericConversationEventTimestamp < 1000000000000 ? numericConversationEventTimestamp * 1000 : numericConversationEventTimestamp)
  : Date.parse(String(rawConversationEventTimestamp || ''));
const conversationExecutionOrder = Number(String(typeof $execution !== 'undefined' ? $execution.id : '').replace(/\D/g, '')) % 1000 || 0;
baseOutput.conversationStateEventVersion = Number.isSafeInteger(directConversationEventVersion) && directConversationEventVersion > 0
  ? directConversationEventVersion
  : ((Number.isFinite(parsedConversationEventTimestampMs) && parsedConversationEventTimestampMs > 0
    ? Math.trunc(parsedConversationEventTimestampMs) : Date.now()) * 1000) + conversationExecutionOrder;`);
  }
  new Function('$json', '$', '$getWorkflowStaticData', code);
  node.parameters.jsCode = code;
}

const preparePersistenceCode = `const source = $json || {};
let controlSource = {};
try { controlSource = $('Controle Bot - Aplicar Controle').first().json || {}; } catch (error) {}
const remoteJid = String(source.remoteJid || controlSource.remoteJid || '').trim();
const phone = String(source.phone || controlSource.phone || remoteJid.replace(/@.*$/, '')).replace(/\D/g, '');
const staticData = $getWorkflowStaticData('global');
const now = Date.now();
const conversationState = {};
for (const key of ['salesPostList', 'pendingDeviceClarification']) {
  const entry = remoteJid ? staticData[key]?.[remoteJid] : null;
  if (entry && typeof entry === 'object' && (!Number(entry.expiresAt || 0) || Number(entry.expiresAt) > now)) {
    conversationState[key] = entry;
  } else if (remoteJid && staticData[key]) {
    delete staticData[key][remoteJid];
  }
}
return [{ json: {
  ...source,
  conversationStatePersistRequest: {
    remoteJid,
    phone,
    expectedRevision: Number(source.conversationStateRevision ?? controlSource.conversationStateRevision ?? controlSource.n8nBotControl?.conversation_state_revision ?? 0),
    eventVersion: Number(source.conversationStateEventVersion ?? controlSource.conversationStateEventVersion ?? Date.now()),
    conversationState,
  },
} }]; // ${MARKER}:prepare // ${ORDER_MARKER}:prepare`;

const restorePersistenceCode = `const persisted = $json || {};
const prepared = $('Estado Conversa - Preparar').first().json || {};
const control = persisted.control && typeof persisted.control === 'object' ? persisted.control : null;
return [{ json: {
  ...prepared,
  conversationStateRevision: Number(control?.conversation_state_revision ?? prepared.conversationStateRevision ?? 0),
  n8nBotControl: control ? { ...(prepared.n8nBotControl || {}), ...control } : prepared.n8nBotControl,
} }]; // ${MARKER}:restore`;

function buildPersistenceNodes(nodes) {
  const divider = findNode(nodes, 'Dividir mensagens');
  const basePosition = Array.isArray(divider.position) ? divider.position : [1600, 0];
  const codeTemplate = findNode(nodes, 'Controle Bot - Aplicar Controle');
  const httpTemplate = findNode(nodes, 'Controle Bot - Consumir Reset');
  return [
    {
      ...structuredClone(codeTemplate),
      id: 'n8n-conversation-state-prepare-001',
      name: 'Estado Conversa - Preparar',
      position: [basePosition[0] - 432, basePosition[1]],
      parameters: { jsCode: preparePersistenceCode },
    },
    {
      ...structuredClone(httpTemplate),
      id: 'n8n-conversation-state-save-001',
      name: 'Estado Conversa - Persistir',
      position: [basePosition[0] - 288, basePosition[1]],
      onError: 'continueRegularOutput',
      continueOnFail: true,
      retryOnFail: false,
      parameters: {
        method: 'POST',
        url: `${API_URL}/n8n-bot/client-control/conversation-state`,
        options: {},
        sendHeaders: true,
        headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
        sendBody: true,
        bodyParameters: { parameters: [
          { name: 'remoteJid', value: '={{$json.conversationStatePersistRequest.remoteJid}}' },
          { name: 'phone', value: '={{$json.conversationStatePersistRequest.phone}}' },
          { name: 'expectedRevision', value: '={{$json.conversationStatePersistRequest.expectedRevision}}' },
          { name: 'eventVersion', value: '={{$json.conversationStatePersistRequest.eventVersion}}' },
          { name: 'conversationState', value: '={{JSON.stringify($json.conversationStatePersistRequest.conversationState)}}' },
        ] },
      },
    },
    {
      ...structuredClone(codeTemplate),
      id: 'n8n-conversation-state-restore-001',
      name: 'Estado Conversa - Restaurar',
      position: [basePosition[0] - 144, basePosition[1]],
      parameters: { jsCode: restorePersistenceCode },
    },
  ];
}

function patchWorkflow(workflow) {
  patchEventSource(workflow);
  patchHydration(findNode(workflow.nodes, 'Controle Bot - Aplicar Controle'));
  const names = new Set(workflow.nodes.map((node) => node.name));
  const stateNodes = buildPersistenceNodes(workflow.nodes);
  for (const node of stateNodes) {
    if (!names.has(node.name)) {
      workflow.nodes.push(node);
      names.add(node.name);
    } else {
      const existing = findNode(workflow.nodes, node.name);
      const currentPosition = existing.position;
      Object.assign(existing, node);
      if (currentPosition) existing.position = currentPosition;
    }
  }

  for (const [sourceName, connectionGroups] of Object.entries(workflow.connections)) {
    if (stateNodes.some((node) => node.name === sourceName)) continue;
    for (const outputs of Object.values(connectionGroups || {})) {
      for (const targets of outputs || []) {
        for (const target of targets || []) {
          if (target.node === 'Dividir mensagens') target.node = 'Estado Conversa - Preparar';
        }
      }
    }
  }
  workflow.connections['Estado Conversa - Preparar'] = { main: [[{ node: 'Estado Conversa - Persistir', type: 'main', index: 0 }]] };
  workflow.connections['Estado Conversa - Persistir'] = { main: [[{ node: 'Estado Conversa - Restaurar', type: 'main', index: 0 }]] };
  workflow.connections['Estado Conversa - Restaurar'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
  return workflow;
}

function validate(workflow) {
  const applyCode = findNode(workflow.nodes, 'Controle Bot - Aplicar Controle').parameters.jsCode;
  const inboundCode = findNode(workflow.nodes, 'Dados').parameters.jsCode;
  assert.match(inboundCode, /persistent-conversation-event-order-v2:source/);
  assert.match(inboundCode, /conversationEventVersion/);
  assert.match(applyCode, /persistent-conversation-state-v1:hydrate/);
  assert.match(applyCode, /persistent-conversation-event-order-v2:event/);
  assert.match(applyCode, /messageTimestamp/);
  assert.match(applyCode, /persistedConversationRevision > 0/);
  const prepare = findNode(workflow.nodes, 'Estado Conversa - Preparar');
  const persist = findNode(workflow.nodes, 'Estado Conversa - Persistir');
  const restore = findNode(workflow.nodes, 'Estado Conversa - Restaurar');
  new Function('$json', '$', '$getWorkflowStaticData', prepare.parameters.jsCode);
  new Function('$json', '$', restore.parameters.jsCode);
  assert.equal(persist.parameters.url, `${API_URL}/n8n-bot/client-control/conversation-state`);
  assert.ok(persist.parameters.bodyParameters.parameters.some((parameter) => parameter.name === 'eventVersion'));
  assert.equal(persist.onError, 'continueRegularOutput');
  assert.equal(persist.retryOnFail, false, '409 conflicts must not retry the same stale revision');
  assert.deepEqual(workflow.connections['Estado Conversa - Preparar'].main[0][0], { node: 'Estado Conversa - Persistir', type: 'main', index: 0 });
  assert.deepEqual(workflow.connections['Estado Conversa - Restaurar'].main[0][0], { node: 'Dividir mensagens', type: 'main', index: 0 });
  const incomingDivider = Object.entries(workflow.connections).filter(([, groups]) =>
    Object.values(groups || {}).some((outputs) => outputs.some((targets) => targets.some((target) => target.node === 'Dividir mensagens')))
  ).map(([name]) => name);
  assert.deepEqual(incomingDivider, ['Estado Conversa - Restaurar']);
  return { hydratedKeys: ['salesPostList', 'pendingDeviceClarification'], persistenceInsertedBefore: 'Dividir mensagens' };
}

async function verifyApiReady() {
  const syncKey = process.env.SYNC_SECRET || process.env.VPS_SYNC_SECRET;
  assert.ok(syncKey, 'SYNC_SECRET is required to verify API readiness');
  const response = await fetch(`${API_URL}/n8n-bot/client-control?remoteJid=5500000000000%40s.whatsapp.net`, {
    headers: { 'x-sync-key': syncKey },
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.ok, true, `conversation-state API readiness failed: ${response.status}`);
  const body = await response.json();
  assert.ok(Object.prototype.hasOwnProperty.call(body.control || {}, 'conversation_state_revision'), 'conversation-state API is not deployed');
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const dbContainer = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(dbContainer, 'n8n Postgres container not found');
    const readSql = `COPY (SELECT encode(convert_to(json_build_object('nodes', nodes::jsonb, 'connections', connections::jsonb, 'activeVersionId', "activeVersionId", 'versionId', "versionId", 'active', active)::text, 'UTF8'), 'hex') FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const hex = (await psql(connection, dbContainer, readSql)).trim();
    const workflow = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    assert.equal(workflow.active, true);
    assert.equal(workflow.versionId, workflow.activeVersionId);
    const alreadyActive = JSON.stringify(workflow.nodes).includes(ORDER_MARKER);
    patchWorkflow(workflow);
    const validation = validate(workflow);
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, marker: MARKER, alreadyActive, validation }, null, 2));
      return;
    }

    await verifyApiReady();
    const activeSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`;
    assert.equal(Number((await psql(connection, dbContainer, activeSql)).trim()), 0, 'workflow has active executions');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${timestamp}.json`;
    await run(connection, 'mkdir -p /root/n8n-backups');
    const backupSql = `COPY (SELECT json_build_object('workflow', row_to_json(workflow), 'activeHistory', row_to_json(history))::text FROM workflow_entity workflow LEFT JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId" WHERE workflow.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const backup = await psql(connection, dbContainer, backupSql);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup, 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;
    assert.equal(Number((await psql(connection, dbContainer, activeSql)).trim()), 0);

    const workflowPath = `/tmp/${WORKFLOW_ID}-${MARKER}-${timestamp}.json`;
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(workflowPath, Buffer.from(JSON.stringify({ nodes: workflow.nodes, connections: workflow.connections }), 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));
    await run(connection, `docker cp ${shQuote(workflowPath)} ${shQuote(dbContainer)}:${shQuote(workflowPath)}`);
    try {
      await psql(connection, dbContainer, `BEGIN;
        UPDATE workflow_entity SET nodes=(pg_read_file('${workflowPath}')::json->'nodes'), connections=(pg_read_file('${workflowPath}')::json->'connections'), "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
        UPDATE workflow_history SET nodes=(pg_read_file('${workflowPath}')::json->'nodes'), connections=(pg_read_file('${workflowPath}')::json->'connections'), "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)};
        COMMIT;`);
    } finally {
      await run(connection, `rm -f ${shQuote(workflowPath)}`).catch(() => {});
      await run(connection, `docker exec ${shQuote(dbContainer)} rm -f ${shQuote(workflowPath)}`).catch(() => {});
    }

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const verifySql = `COPY (SELECT json_build_object('active', workflow.active, 'versionAligned', workflow."versionId"=workflow."activeVersionId", 'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb AND workflow.connections::jsonb=history.connections::jsonb, 'marker', workflow.nodes::text LIKE '%${MARKER}%', 'eventOrderMarker', workflow.nodes::text LIKE '%${ORDER_MARKER}%')::text FROM workflow_entity workflow JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId" WHERE workflow.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, dbContainer, verifySql)).trim());
    assert.deepEqual(verification, { active: true, versionAligned: true, entityHistoryEqual: true, marker: true, eventOrderMarker: true });
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, marker: MARKER, backupPath, validation, verification }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, ORDER_MARKER, patchEventSource, patchHydration, patchWorkflow, validate, preparePersistenceCode, restorePersistenceCode };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
