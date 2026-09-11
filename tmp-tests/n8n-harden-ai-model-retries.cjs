const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = 'ai-model-retries-v1';
const RETRY_NAMES = new Set(['OpenAI Chat Model', 'OpenAI Classificador', 'OpenAI Vendas']);
const CUSTOMER_SEND_NAMES = new Set(['Enviar WhatsApp', 'Enviar WhatsApp - Imagem', 'Controle Bot - Responder Admin']);
const MAX_TRIES = 3;
const WAIT_BETWEEN_TRIES_MS = 5000;
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function patchAiModelRetries(workflow) {
  const changed = [];
  for (const node of workflow.nodes || []) {
    if (!RETRY_NAMES.has(node.name)) continue;
    assert.equal(node.type, '@n8n/n8n-nodes-langchain.lmChatOpenAi', `${node.name} must remain an OpenAI chat model`);
    if (node.retryOnFail !== true || node.maxTries !== MAX_TRIES || node.waitBetweenTries !== WAIT_BETWEEN_TRIES_MS) {
      node.retryOnFail = true;
      node.maxTries = MAX_TRIES;
      node.waitBetweenTries = WAIT_BETWEEN_TRIES_MS;
      changed.push(node.name);
    }
  }
  return changed;
}

function validateAiModelRetries(workflow) {
  const retryNodes = (workflow.nodes || []).filter((node) => RETRY_NAMES.has(node.name));
  assert.equal(retryNodes.length, RETRY_NAMES.size, 'All expected OpenAI model nodes must exist');
  for (const node of retryNodes) {
    assert.equal(node.type, '@n8n/n8n-nodes-langchain.lmChatOpenAi');
    assert.equal(node.retryOnFail, true, `${node.name} retry must be enabled`);
    assert.equal(node.maxTries, MAX_TRIES, `${node.name} maxTries must be ${MAX_TRIES}`);
    assert.equal(node.waitBetweenTries, WAIT_BETWEEN_TRIES_MS, `${node.name} waitBetweenTries must be ${WAIT_BETWEEN_TRIES_MS}`);
  }
  const customerSends = (workflow.nodes || []).filter((node) => CUSTOMER_SEND_NAMES.has(node.name));
  assert.equal(customerSends.length, CUSTOMER_SEND_NAMES.size, 'All customer/admin send nodes must exist');
  for (const node of customerSends) assert.notEqual(node.retryOnFail, true, `${node.name} must not retry ambiguous sends`);
  return { marker: MARKER, aiModels: retryNodes.length, maxTries: MAX_TRIES, waitBetweenTriesMs: WAIT_BETWEEN_TRIES_MS };
}

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

async function readWorkflow(connection, dbContainer) {
  const sql = `COPY (SELECT encode(convert_to(json_build_object('nodes', nodes::jsonb, 'connections', connections::jsonb, 'activeVersionId', "activeVersionId", 'versionId', "versionId", 'active', active)::text, 'UTF8'), 'hex') FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
  const hex = (await psql(connection, dbContainer, sql)).trim();
  return JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const dbContainer = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(dbContainer, 'n8n Postgres container not found');
    const workflow = await readWorkflow(connection, dbContainer);
    assert.equal(workflow.active, true);
    assert.equal(workflow.versionId, workflow.activeVersionId);
    const originalConnections = JSON.stringify(workflow.connections);
    const changed = patchAiModelRetries(workflow);
    const validation = validateAiModelRetries(workflow);
    assert.equal(JSON.stringify(workflow.connections), originalConnections, 'Retry patch must not alter connections');

    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, alreadyActive: changed.length === 0, changed, validation }, null, 2));
      return;
    }

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
        if (writeError) reject(writeError); else resolve();
      });
    }));

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;

    const remotePath = `/tmp/${WORKFLOW_ID}-${MARKER}-${timestamp}.json`;
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(remotePath, Buffer.from(JSON.stringify(workflow.nodes), 'utf8'), (writeError) => {
        sftp.end();
        if (writeError) reject(writeError); else resolve();
      });
    }));
    await run(connection, `docker cp ${shQuote(remotePath)} ${shQuote(dbContainer)}:/tmp/${WORKFLOW_ID}-${MARKER}.json`);
    const updateSql = `BEGIN;
UPDATE workflow_entity SET nodes=pg_read_file('/tmp/${WORKFLOW_ID}-${MARKER}.json')::json, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=pg_read_file('/tmp/${WORKFLOW_ID}-${MARKER}.json')::json WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)};
COMMIT;`;
    await psql(connection, dbContainer, updateSql);
    await run(connection, `rm -f ${shQuote(remotePath)}`).catch(() => {});
    await run(connection, `docker exec ${shQuote(dbContainer)} rm -f /tmp/${WORKFLOW_ID}-${MARKER}.json`).catch(() => {});

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const applied = await readWorkflow(connection, dbContainer);
    const validationAfterApply = validateAiModelRetries(applied);
    assert.equal(JSON.stringify(applied.connections), originalConnections, 'Connections changed after apply');
    const verificationSql = `COPY (SELECT json_build_object('active', workflow.active, 'versionAligned', workflow."versionId"=workflow."activeVersionId", 'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb AND workflow.connections::jsonb=history.connections::jsonb)::text FROM workflow_entity workflow JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId" WHERE workflow.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, dbContainer, verificationSql)).trim());
    assert.equal(verification.active, true);
    assert.equal(verification.versionAligned, true);
    assert.equal(verification.entityHistoryEqual, true);
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, backupPath, changed, validation: validationAfterApply, verification }, null, 2));
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

module.exports = { MARKER, RETRY_NAMES, CUSTOMER_SEND_NAMES, MAX_TRIES, WAIT_BETWEEN_TRIES_MS, patchAiModelRetries, validateAiModelRetries };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
