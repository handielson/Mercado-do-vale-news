const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Controle Bot - Comando Admin';
const APPLY = process.argv.includes('--apply');
const OLD_RELAY_GATE = `const relayMatchV373 = String(source.conversation || source.text || '').trim().match(/^(?:responder\\s+[a-z0-9]{4,8}\\s+[\\s\\S]+|liberar\\s+[a-z0-9]{4,8}|encerrar\\s+[a-z0-9]{4,8})$/i);`;
const NEW_RELAY_GATE = `const relayMatchV373 = String(source.conversation || source.text || '').trim().match(/^(?:[12][.)]?\\s+[a-z0-9]{4,8}(?:\\s+[\\s\\S]+)?|responder\\s+[a-z0-9]{4,8}\\s+[\\s\\S]+|liberar\\s+[a-z0-9]{4,8}|encerrar\\s+[a-z0-9]{4,8})$/i);`;

const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const dollar = (value, tag) => `$${tag}$${value}$${tag}$`;
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
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
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function patchCode(code) {
  const source = String(code || '');
  if (source.includes(NEW_RELAY_GATE)) return source;
  assert.ok(source.includes(OLD_RELAY_GATE), 'admin relay gate anchor not found');
  const patched = source.replace(OLD_RELAY_GATE, NEW_RELAY_GATE);
  new Function('$json', '$', '$getWorkflowStaticData', patched);
  return patched;
}
function patchNodes(nodes) {
  const node = nodes.find((item) => item.name === NODE_NAME);
  assert.ok(node, `${NODE_NAME} not found`);
  node.parameters.jsCode = patchCode(node.parameters?.jsCode);
  return nodes;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container not found');
    const raw = JSON.parse((await psql(conn, db, `COPY (
      SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text
      FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}
    ) TO STDOUT;`)).trim());
    const nodes = patchNodes(JSON.parse(Buffer.from(raw.nodesHex, 'hex').toString('utf8')));
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, numericRelayGate: true }, null, 2));
      return;
    }
    const active = Number((await psql(conn, db, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-admin-numeric-relay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backup = await psql(conn, db, `COPY (
      SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text
      FROM workflow_entity we LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
      WHERE we.id=${quote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); });
    }));
    await run(conn, `chmod 600 ${quote(backupPath)} && sha256sum ${quote(backupPath)} > ${quote(`${backupPath}.sha256`)}`);
    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    stopped = true;
    const nodesJson = JSON.stringify(nodes);
    await psql(conn, db, `BEGIN;
      UPDATE workflow_entity SET nodes=${dollar(nodesJson, 'nodes')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
      UPDATE workflow_history SET nodes=${dollar(nodesJson, 'history')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(raw.activeVersionId)};
      COMMIT;`);
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    stopped = false;
    const verify = JSON.parse((await psql(conn, db, `COPY (
      SELECT json_build_object(
        'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb,
        'numericRelayGate', (node->'parameters'->>'jsCode') LIKE '%[12][.)]?%'
      )::text FROM workflow_entity we
      JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId",
      LATERAL jsonb_array_elements(we.nodes::jsonb) node
      WHERE we.id=${quote(WORKFLOW_ID)} AND node->>'name'=${quote(NODE_NAME)}
    ) TO STDOUT;`)).trim());
    const health = (await run(conn, 'curl -fsS https://n8n.mercadodovale.com.br/healthz')).trim();
    assert.deepEqual(verify, { entityHistoryEqual: true, numericRelayGate: true });
    console.log(JSON.stringify({ apply: true, backupPath, health, ...verify }, null, 2));
  } finally {
    if (stopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { OLD_RELAY_GATE, NEW_RELAY_GATE, patchCode, patchNodes };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
