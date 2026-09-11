const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = 'http-timeouts-v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const TIMEOUT_BY_NODE = new Map([
  ['Vendas - Buscar CEP ViaCEP', 15_000],
  ['OpenAI - Transcrever audio', 120_000],
  ['Vendas - Gerar cards da lista', 120_000],
]);
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function timeoutForNode(node) {
  return TIMEOUT_BY_NODE.get(String(node?.name || '')) || DEFAULT_TIMEOUT_MS;
}

function patchHttpTimeouts(workflow) {
  const changed = [];
  for (const node of workflow.nodes || []) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;
    const timeout = timeoutForNode(node);
    node.parameters = node.parameters || {};
    node.parameters.options = node.parameters.options || {};
    if (Number(node.parameters.options.timeout) !== timeout) {
      node.parameters.options.timeout = timeout;
      changed.push({ name: node.name, timeout });
    }
  }
  return changed;
}

function validateHttpTimeouts(workflow) {
  const httpNodes = (workflow.nodes || []).filter((node) => node.type === 'n8n-nodes-base.httpRequest');
  assert.ok(httpNodes.length > 0, 'Workflow must contain HTTP Request nodes');
  for (const node of httpNodes) {
    assert.equal(
      Number(node.parameters?.options?.timeout),
      timeoutForNode(node),
      `Unexpected timeout for ${node.name}`
    );
  }
  return {
    marker: MARKER,
    httpNodes: httpNodes.length,
    timeoutProfiles: {
      default: DEFAULT_TIMEOUT_MS,
      viaCep: TIMEOUT_BY_NODE.get('Vendas - Buscar CEP ViaCEP'),
      longRunning: TIMEOUT_BY_NODE.get('OpenAI - Transcrever audio'),
    },
  };
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

async function waitService(connection, service, expected, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
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
    const originalConnections = JSON.stringify(workflow.connections);
    const changed = patchHttpTimeouts(workflow);
    const validation = validateHttpTimeouts(workflow);
    assert.equal(JSON.stringify(workflow.connections), originalConnections, 'Timeout patch must not alter connections');

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
    const encodedNodes = Buffer.from(JSON.stringify(workflow.nodes), 'utf8');
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(remotePath, encodedNodes, (writeError) => {
        sftp.end();
        if (writeError) reject(writeError); else resolve();
      });
    }));
    await run(connection, `docker cp ${shQuote(remotePath)} ${shQuote(dbContainer)}:/tmp/${WORKFLOW_ID}-${MARKER}.json`);
    const updateSql = `BEGIN;
UPDATE workflow_entity
   SET nodes = pg_read_file('/tmp/${WORKFLOW_ID}-${MARKER}.json')::json,
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE id = ${shQuote(WORKFLOW_ID)};
UPDATE workflow_history
   SET nodes = pg_read_file('/tmp/${WORKFLOW_ID}-${MARKER}.json')::json
 WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
   AND "versionId" = ${shQuote(workflow.activeVersionId)};
COMMIT;`;
    await psql(connection, dbContainer, updateSql);
    await run(connection, `rm -f ${shQuote(remotePath)}`).catch(() => {});
    await run(connection, `docker exec ${shQuote(dbContainer)} rm -f /tmp/${WORKFLOW_ID}-${MARKER}.json`).catch(() => {});

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const verifySql = `COPY (SELECT json_build_object('active', workflow.active, 'versionAligned', workflow."versionId"=workflow."activeVersionId", 'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb, 'timeouts', (SELECT count(*) FROM jsonb_array_elements(workflow.nodes::jsonb) node WHERE node->>'type'='n8n-nodes-base.httpRequest' AND node->'parameters'->'options' ? 'timeout'))::text FROM workflow_entity workflow JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId" WHERE workflow.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, dbContainer, verifySql)).trim());
    assert.equal(verification.active, true);
    assert.equal(verification.versionAligned, true);
    assert.equal(verification.entityHistoryEqual, true);
    assert.equal(Number(verification.timeouts), validation.httpNodes);
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, backupPath, changed, validation, verification }, null, 2));
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

module.exports = { MARKER, DEFAULT_TIMEOUT_MS, TIMEOUT_BY_NODE, timeoutForNode, patchHttpTimeouts, validateHttpTimeouts };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
