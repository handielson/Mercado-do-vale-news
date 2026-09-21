const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { readWorkflow } = require('./n8n-warranty-policy.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'blueprint-followup-sales-v1';
const q = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function patchProductContext(code) {
  if (code.includes(MARKER)) return code;
  const anchor = 'const phoneCatalogFollowupEligibleV289 = Boolean(isCompleteCategoryRequest && prefersSmartphones && products.length > 0 && !suppressRepeatedCatalogV342);';
  assert.equal(code.split(anchor).length, 2, 'follow-up eligibility anchor must occur once');
  const replacement = `// ${MARKER}: schedule a no-response sales follow-up after sending a specific model blueprint.
  const specificModelBlueprintFollowupV1 = Boolean(
    requestedDeviceModelQuery
    && products.length === 1
    && !unavailableRequestedDevice
    && Boolean(products[0]?.blueprintImageUrl || products[0]?.variants?.some((variant) => variant?.blueprintImageUrl))
  );
  const phoneCatalogFollowupEligibleV289 = Boolean(
    (isCompleteCategoryRequest && prefersSmartphones && products.length > 0 || specificModelBlueprintFollowupV1)
    && !suppressRepeatedCatalogV342
  );`;
  const next = code.replace(anchor, replacement);
  new Function('$json', '$', next);
  return next;
}

function patchWorkflow(workflow) {
  const cloned = structuredClone(workflow);
  const node = cloned.nodes.find((item) => item.name === 'Vendas - Contexto Produtos');
  assert.ok(node?.parameters?.jsCode, 'Vendas - Contexto Produtos node missing');
  node.parameters.jsCode = patchProductContext(node.parameters.jsCode);
  return cloned;
}

function remote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '', stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote exit ${code}`)));
  }));
}

async function writeRemote(conn, remotePath, content) {
  await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.writeFile(remotePath, Buffer.from(String(content), 'utf8'), (writeError) => {
      sftp.end();
      writeError ? reject(writeError) : resolve();
    });
  }));
}

async function psql(conn, container, sql) {
  return remote(conn, `docker exec -i ${q(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1 <<'SQL'\n${sql}\nSQL`);
}

async function waitService(conn, service, count, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await remote(conn, `docker service ls --filter name=${q(service)} --format '{{.Replicas}}'`)).trim().split(/\s+/)[0];
    if (replicas === `${count}/${count}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${count}/${count}`);
}

async function applyWorkflow(conn, workflow) {
  const container = (await remote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}'")).trim().split(/\s+/)[0];
  assert.ok(container, 'n8n Postgres unavailable');
  assert.equal(workflow.versionId, workflow.activeVersionId, 'active workflow version mismatch');
  const active = Number((await psql(conn, container, `SELECT count(*) FROM execution_entity WHERE \"workflowId\"=${q(WORKFLOW_ID)} AND status IN ('new','running');`)).trim());
  assert.equal(active, 0, 'workflow has in-flight executions');
  const backup = await psql(conn, container, `SELECT json_build_object('entity',row_to_json(e),'history',row_to_json(h))::text FROM workflow_entity e JOIN workflow_history h ON h.\"workflowId\"=e.id AND h.\"versionId\"=e.\"activeVersionId\" WHERE e.id=${q(WORKFLOW_ID)};`);
  assert.ok(backup.trim(), 'active workflow history missing');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${stamp}.json`;
  await remote(conn, 'mkdir -p /root/n8n-backups');
  await writeRemote(conn, backupPath, backup);
  const nodesPath = `/tmp/${WORKFLOW_ID}-${MARKER}-${stamp}.json`;
  let runnerScaled = false, mainScaled = false;
  try {
    await remote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); runnerScaled = true; await waitService(conn, 'n8n_n8n-runner', 0);
    await remote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); mainScaled = true; await waitService(conn, 'n8n_n8n', 0);
    await writeRemote(conn, nodesPath, JSON.stringify(workflow.nodes));
    await remote(conn, `docker cp ${q(nodesPath)} ${q(container)}:${q(nodesPath)}`);
    await psql(conn, container, `BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('${nodesPath}')::json, \"updatedAt\"=NOW() WHERE id=${q(WORKFLOW_ID)} AND \"activeVersionId\"=${q(workflow.activeVersionId)}; UPDATE workflow_history SET nodes=pg_read_file('${nodesPath}')::json, \"updatedAt\"=NOW() WHERE \"workflowId\"=${q(WORKFLOW_ID)} AND \"versionId\"=${q(workflow.activeVersionId)}; COMMIT;`);
  } finally {
    await remote(conn, `docker exec ${q(container)} rm -f ${q(nodesPath)}`).catch(() => {}); await remote(conn, `rm -f ${q(nodesPath)}`).catch(() => {});
    if (mainScaled) { await remote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1); }
    if (runnerScaled) { await remote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); }
  }
  const verified = JSON.parse((await psql(conn, container, `SELECT json_build_object('active',e.active,'versionAligned',e.\"versionId\"=e.\"activeVersionId\",'entityHistoryEqual',e.nodes::jsonb=h.nodes::jsonb,'marker',e.nodes::text LIKE '%${MARKER}%')::text FROM workflow_entity e JOIN workflow_history h ON h.\"workflowId\"=e.id AND h.\"versionId\"=e.\"activeVersionId\" WHERE e.id=${q(WORKFLOW_ID)};`)).trim());
  assert.deepEqual(verified, { active: true, versionAligned: true, entityHistoryEqual: true, marker: true });
  return { backupPath, verified };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const current = await readWorkflow(conn);
    const patched = patchWorkflow(current);
    const alreadyActive = current.nodes.some((node) => String(node.parameters?.jsCode || '').includes(MARKER));
    if (process.argv.includes('--apply') && !alreadyActive) console.log(JSON.stringify({ applied: true, marker: MARKER, workflowResult: await applyWorkflow(conn, patched) }, null, 2));
    else console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'already active' : 'dry run; production unchanged', workflow: current.name, marker: MARKER }, null, 2));
  } finally { conn.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { patchProductContext, patchWorkflow };
