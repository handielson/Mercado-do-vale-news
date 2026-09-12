const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { readWorkflow, remote, q } = require('./n8n-warranty-policy.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const ENTRY = 'Controle Bot - Registrar Entrada';
const ADMIN_LOOKUP = 'Controle Bot - Buscar Admin Global';
const CLIENT_LOOKUP = 'Controle Bot - Buscar Controle';
const ADMIN_CLASSIFY = 'Controle Bot - Comando Admin';
const ADMIN_SWITCH = 'Controle Bot - E comando admin?';
const ADMIN_EXECUTE = 'Controle Bot - Executar Comando Admin';
const GLOBAL_PAUSE = 'Controle Bot - Pausa global?';
const CLIENT_CONTROL = 'Controle Bot - Aplicar Controle';
const RESET = 'Controle Bot - Reset pendente?';
const BLOCKED = 'Controle Bot - Bloqueado?';
const CONTACT = 'Contato - Preparar';

const targets = (connections, name, output = 0) =>
  (connections[name]?.main?.[output] || []).map((edge) => edge.node);

function validateConnections(connections) {
  const one = (name, output, target) =>
    assert.deepEqual(targets(connections, name, output), [target], `${name} output ${output}`);
  one(ENTRY, 0, ADMIN_LOOKUP);
  one(ADMIN_LOOKUP, 0, ADMIN_CLASSIFY);
  one(ADMIN_CLASSIFY, 0, ADMIN_SWITCH);
  one(ADMIN_SWITCH, 0, ADMIN_EXECUTE);
  one(ADMIN_SWITCH, 1, GLOBAL_PAUSE);
  one(GLOBAL_PAUSE, 1, CLIENT_LOOKUP);
  one(CLIENT_LOOKUP, 0, CLIENT_CONTROL);
  one(CLIENT_CONTROL, 0, RESET);
  one(RESET, 1, BLOCKED);
  assert.deepEqual(targets(connections, BLOCKED, 0), [], 'blocked client must stop');
  one(BLOCKED, 1, CONTACT);
  const predecessors = Object.entries(connections).flatMap(([name, value]) =>
    (value.main || []).flatMap((branch) => (branch || []).filter((edge) => edge.node === ADMIN_LOOKUP).map(() => name)));
  assert.deepEqual(predecessors, [ENTRY], 'admin lookup must have exactly one predecessor');
  return { adminBeforeGlobalPause: true, adminBeforeClientBlock: true, blockedCustomerStops: true };
}

function patchConnections(connections) {
  const updated = structuredClone(connections);
  const current = targets(updated, ENTRY, 0);
  if (current.length === 1 && current[0] === ADMIN_LOOKUP) {
    validateConnections(updated);
    return updated;
  }
  assert.deepEqual(current, [CLIENT_LOOKUP], 'unexpected entry route; refusing patch');
  const predecessors = Object.entries(updated).flatMap(([name, value]) =>
    (value.main || []).flatMap((branch) => (branch || []).filter((edge) => edge.node === ADMIN_LOOKUP).map(() => name)));
  assert.deepEqual(predecessors, [], 'admin lookup is already connected elsewhere');
  updated[ENTRY].main[0][0].node = ADMIN_LOOKUP;
  validateConnections(updated);
  return updated;
}

async function psql(conn, db, sql) {
  return remote(conn, `docker exec -i ${q(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1 <<'SQL'\n${sql}\nSQL`);
}

async function writeRemote(conn, path, content) {
  await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.writeFile(path, Buffer.from(content, 'utf8'), (writeError) => {
      sftp.end();
      writeError ? reject(writeError) : resolve();
    });
  }));
}

async function waitService(conn, service, count) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const replicas = (await remote(conn, `docker service ls --filter name=${q(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${count}/${count}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${count}/${count}`);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const workflow = await readWorkflow(conn);
    assert.equal(workflow.active, true, 'workflow inactive');
    assert.equal(workflow.versionId, workflow.activeVersionId, 'active version mismatch');
    const patched = patchConnections(workflow.connections);
    const validation = validateConnections(patched);
    const alreadyActive = targets(workflow.connections, ENTRY, 0)[0] === ADMIN_LOOKUP;
    if (!process.argv.includes('--apply') || alreadyActive) {
      console.log(JSON.stringify({ apply: false, alreadyActive, validation }));
      return;
    }
    const db = (await remote(conn, "docker ps --filter name=n8n_n8n-db --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container unavailable');
    const inFlight = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${q(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`;
    assert.equal(Number((await psql(conn, db, inFlight)).trim()), 0, 'workflow has in-flight executions');
    const backupSql = `COPY (SELECT json_build_object('entity',row_to_json(e),'history',row_to_json(h))::text
      FROM workflow_entity e JOIN workflow_history h ON h."workflowId"=e.id AND h."versionId"=e."activeVersionId"
      WHERE e.id=${q(WORKFLOW_ID)}) TO STDOUT;`;
    const backup = await psql(conn, db, backupSql);
    assert.ok(backup.trim(), 'active history missing');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-admin-command-route-${stamp}.json`;
    const path = `/tmp/${WORKFLOW_ID}-admin-command-route-${stamp}.json`;
    await remote(conn, 'mkdir -p /root/n8n-backups');
    await writeRemote(conn, backupPath, backup);
    await remote(conn, `chmod 600 ${q(backupPath)}`);
    let runnerScaleAttempted = false;
    let mainScaleAttempted = false;
    try {
      runnerScaleAttempted = true;
      await remote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
      await waitService(conn, 'n8n_n8n-runner', 0);
      mainScaleAttempted = true;
      await remote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
      await waitService(conn, 'n8n_n8n', 0);
      assert.equal(Number((await psql(conn, db, inFlight)).trim()), 0, 'new execution started');
      await writeRemote(conn, path, JSON.stringify(patched));
      await remote(conn, `docker cp ${q(path)} ${q(db)}:${q(path)}`);
      await psql(conn, db, `BEGIN;
        UPDATE workflow_entity SET connections=pg_read_file('${path}')::json, "updatedAt"=NOW()
          WHERE id=${q(WORKFLOW_ID)} AND "activeVersionId"=${q(workflow.activeVersionId)};
        UPDATE workflow_history SET connections=pg_read_file('${path}')::json, "updatedAt"=NOW()
          WHERE "workflowId"=${q(WORKFLOW_ID)} AND "versionId"=${q(workflow.activeVersionId)};
        COMMIT;`);
    } finally {
      await remote(conn, `docker exec ${q(db)} rm -f ${q(path)}`).catch(() => {});
      await remote(conn, `rm -f ${q(path)}`).catch(() => {});
      if (mainScaleAttempted) {
        await remote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
        await waitService(conn, 'n8n_n8n', 1);
      }
      if (runnerScaleAttempted) {
        await remote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
        await waitService(conn, 'n8n_n8n-runner', 1);
      }
    }
    const live = await readWorkflow(conn);
    const verified = validateConnections(live.connections);
    assert.equal(live.versionId, live.activeVersionId, 'version diverged');
    const historySql = `COPY (SELECT e.connections::jsonb=h.connections::jsonb FROM workflow_entity e
      JOIN workflow_history h ON h."workflowId"=e.id AND h."versionId"=e."activeVersionId"
      WHERE e.id=${q(WORKFLOW_ID)}) TO STDOUT;`;
    assert.equal((await psql(conn, db, historySql)).trim(), 't', 'history differs');
    const health = await fetch('https://n8n.mercadodovale.com.br/healthz');
    assert.equal(health.status, 200, 'n8n health failed');
    console.log(JSON.stringify({ applied: true, backupPath, validation: verified, health: health.status }));
  } finally { conn.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { patchConnections, validateConnections };
