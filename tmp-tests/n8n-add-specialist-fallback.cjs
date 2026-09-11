const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = 'specialist-fallback-v1';
const SWITCH_NAME = 'Switch Especialistas';
const FALLBACK_TARGET = 'Agente Geral - Atendimento';
const RULE_COUNT = 13;
const FALLBACK_LABEL = 'Atendimento geral (fallback)';
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function patchSpecialistFallback(workflow) {
  const specialistSwitch = (workflow.nodes || []).find((node) => node.name === SWITCH_NAME);
  assert.ok(specialistSwitch, `${SWITCH_NAME} must exist`);
  assert.equal(specialistSwitch.type, 'n8n-nodes-base.switch');
  assert.ok(Number(specialistSwitch.typeVersion) >= 3, `${SWITCH_NAME} must use Switch v3+`);
  assert.equal(specialistSwitch.parameters?.mode || 'rules', 'rules');
  assert.equal(specialistSwitch.parameters?.rules?.values?.length, RULE_COUNT);

  const generalAgent = (workflow.nodes || []).find((node) => node.name === FALLBACK_TARGET);
  assert.ok(generalAgent, `${FALLBACK_TARGET} must exist`);

  const originalOptions = specialistSwitch.parameters.options || {};
  const alreadyConfigured = originalOptions.fallbackOutput === 'extra'
    && originalOptions.renameFallbackOutput === FALLBACK_LABEL;
  specialistSwitch.parameters.options = {
    ...originalOptions,
    fallbackOutput: 'extra',
    renameFallbackOutput: FALLBACK_LABEL,
  };

  workflow.connections ||= {};
  workflow.connections[SWITCH_NAME] ||= {};
  const currentMain = workflow.connections[SWITCH_NAME].main || [];
  assert.ok(currentMain.length === RULE_COUNT || currentMain.length === RULE_COUNT + 1,
    `${SWITCH_NAME} must have ${RULE_COUNT} rule outputs, optionally plus fallback`);
  const fallbackConnection = [{ node: FALLBACK_TARGET, type: 'main', index: 0 }];
  const connectionAlreadyConfigured = JSON.stringify(currentMain[RULE_COUNT] || []) === JSON.stringify(fallbackConnection);
  const main = currentMain.slice(0, RULE_COUNT);
  main.push(fallbackConnection);
  workflow.connections[SWITCH_NAME].main = main;

  return { alreadyConfigured: alreadyConfigured && connectionAlreadyConfigured };
}

function validateSpecialistFallback(workflow) {
  const specialistSwitch = (workflow.nodes || []).find((node) => node.name === SWITCH_NAME);
  assert.ok(specialistSwitch);
  assert.equal(specialistSwitch.parameters?.options?.fallbackOutput, 'extra');
  assert.equal(specialistSwitch.parameters?.options?.renameFallbackOutput, FALLBACK_LABEL);
  assert.equal(specialistSwitch.parameters?.rules?.values?.length, RULE_COUNT);
  const outputs = workflow.connections?.[SWITCH_NAME]?.main;
  assert.equal(outputs?.length, RULE_COUNT + 1);
  assert.deepEqual(outputs[RULE_COUNT], [{ node: FALLBACK_TARGET, type: 'main', index: 0 }]);
  return {
    marker: MARKER,
    switch: SWITCH_NAME,
    existingRoutes: RULE_COUNT,
    fallbackIndex: RULE_COUNT,
    fallbackTarget: FALLBACK_TARGET,
  };
}

function assertChangeScope(changedNodes, alreadyConfigured) {
  assert.deepEqual(changedNodes, alreadyConfigured ? [] : [SWITCH_NAME],
    'Only the specialist Switch node may change, unless the fallback is already configured');
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
  assert.ok(hex, `Workflow ${WORKFLOW_ID} not found`);
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
    const originalNodes = clone(workflow.nodes);
    const originalRuleOutputs = clone(workflow.connections?.[SWITCH_NAME]?.main?.slice(0, RULE_COUNT));
    const patchResult = patchSpecialistFallback(workflow);
    const validation = validateSpecialistFallback(workflow);
    assert.deepEqual(workflow.connections[SWITCH_NAME].main.slice(0, RULE_COUNT), originalRuleOutputs,
      'Existing specialist routes must remain unchanged');
    const changedNodes = workflow.nodes.filter((node, index) => JSON.stringify(node) !== JSON.stringify(originalNodes[index])).map((node) => node.name);
    assertChangeScope(changedNodes, patchResult.alreadyConfigured);

    if (!APPLY || patchResult.alreadyConfigured) {
      console.log(JSON.stringify({ apply: APPLY && patchResult.alreadyConfigured ? 'noop' : false, workflowId: WORKFLOW_ID, ...patchResult, changedNodes, validation }, null, 2));
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
    const payload = JSON.stringify({ nodes: workflow.nodes, connections: workflow.connections });
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(remotePath, Buffer.from(payload, 'utf8'), (writeError) => {
        sftp.end();
        if (writeError) reject(writeError); else resolve();
      });
    }));
    const containerPath = `/tmp/${WORKFLOW_ID}-${MARKER}.json`;
    await run(connection, `docker cp ${shQuote(remotePath)} ${shQuote(dbContainer)}:${containerPath}`);
    const updateSql = `BEGIN;
UPDATE workflow_entity SET nodes=(pg_read_file('${containerPath}')::json->'nodes'), connections=(pg_read_file('${containerPath}')::json->'connections'), "updatedAt"=CURRENT_TIMESTAMP WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=(pg_read_file('${containerPath}')::json->'nodes'), connections=(pg_read_file('${containerPath}')::json->'connections'), "updatedAt"=CURRENT_TIMESTAMP WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)};
COMMIT;`;
    await psql(connection, dbContainer, updateSql);
    await run(connection, `rm -f ${shQuote(remotePath)}`).catch(() => {});
    await run(connection, `docker exec ${shQuote(dbContainer)} rm -f ${shQuote(containerPath)}`).catch(() => {});

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const applied = await readWorkflow(connection, dbContainer);
    const validationAfterApply = validateSpecialistFallback(applied);
    assert.deepEqual(applied.connections[SWITCH_NAME].main.slice(0, RULE_COUNT), originalRuleOutputs,
      'Existing specialist routes changed after apply');
    const verificationSql = `COPY (SELECT json_build_object('active', workflow.active, 'versionAligned', workflow."versionId"=workflow."activeVersionId", 'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb AND workflow.connections::jsonb=history.connections::jsonb)::text FROM workflow_entity workflow JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId" WHERE workflow.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, dbContainer, verificationSql)).trim());
    assert.equal(verification.active, true);
    assert.equal(verification.versionAligned, true);
    assert.equal(verification.entityHistoryEqual, true);
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, backupPath, changedNodes, validation: validationAfterApply, verification }, null, 2));
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

module.exports = {
  MARKER,
  SWITCH_NAME,
  FALLBACK_TARGET,
  RULE_COUNT,
  FALLBACK_LABEL,
  patchSpecialistFallback,
  validateSpecialistFallback,
  assertChangeScope,
};

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
