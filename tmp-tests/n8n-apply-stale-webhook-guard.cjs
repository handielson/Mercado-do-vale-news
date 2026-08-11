const path = require('node:path');
const { Client } = require('ssh2');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'staleWebhookReplayGuardV226';
function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}
function putRemoteText(conn, remotePath, content) {
  return new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.writeFile(remotePath, Buffer.from(content, 'utf8'), (writeError) => {
      sftp.end();
      if (writeError) reject(writeError); else resolve();
    });
  }));
}
async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitReplicas(conn, service, expected, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await sleep(2500);
  }
  throw new Error(`timeout waiting ${service}=${expected}/${expected}`);
}

async function main() {
  const dbOnly = process.argv.includes('--db-only');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    const readSql = `COPY (SELECT encode(convert_to(json_build_object('nodes',we.nodes::jsonb,'connections',we.connections::jsonb,'activeVersionId',we.\"activeVersionId\")::text,'UTF8'),'hex') FROM workflow_entity we WHERE we.id='${WORKFLOW_ID}') TO STDOUT;`;
    const raw = await runRemote(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(readSql)}`);
    const workflow = JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
    const dados = workflow.nodes.find((node) => node.name === 'Dados');
    if (!dados) throw new Error('Dados node not found');
    let code = String(dados.parameters?.jsCode || '');
    if (!code.includes(MARKER)) {
      const anchor = "const fromMe = key.fromMe === true;\nconst normalizedMessageType";
      if (!code.includes(anchor)) throw new Error('Dados guard anchor not found');
      const guard = `const fromMe = key.fromMe === true;\n\n// ${MARKER}: reconnections can replay old messages in a burst.\nconst eventNameV226 = String(body.event || '').trim().toLowerCase();\nconst rawTimestampV226 = data.messageTimestamp;\nconst timestampSecondsV226 = Number(\n  typeof rawTimestampV226 === 'object' && rawTimestampV226 !== null\n    ? rawTimestampV226.low\n    : rawTimestampV226\n);\nconst eventTimestampMsV226 = Number.isFinite(timestampSecondsV226) && timestampSecondsV226 > 0\n  ? timestampSecondsV226 * 1000\n  : 0;\nconst eventAgeMsV226 = eventTimestampMsV226 > 0 ? Date.now() - eventTimestampMsV226 : 0;\nconst isStaleReplayV226 = eventNameV226 === 'messages.upsert'\n  && eventAgeMsV226 > 20 * 60 * 1000;\nif (isStaleReplayV226) return [];\n\nconst normalizedMessageType`;
      code = code.replace(anchor, guard);
      dados.parameters.jsCode = code;
    }
    new Function(code);
    const remoteNodesPath = '/tmp/mdv-n8n-nodes-v226.json';
    await putRemoteText(conn, remoteNodesPath, JSON.stringify(workflow.nodes));
    await runRemote(conn, `docker cp ${quote(remoteNodesPath)} ${quote(db)}:/tmp/mdv-n8n-nodes-v226.json`);

    if (!dbOnly) {
      await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
      await waitReplicas(conn, 'n8n_n8n-runner', 0);
      await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
      await waitReplicas(conn, 'n8n_n8n', 0);
      stopped = true;
    }

    const updateSql = `BEGIN;
      UPDATE workflow_entity SET nodes=pg_read_file('/tmp/mdv-n8n-nodes-v226.json')::json, \"updatedAt\"=CURRENT_TIMESTAMP WHERE id='${WORKFLOW_ID}';
      UPDATE workflow_history SET nodes=pg_read_file('/tmp/mdv-n8n-nodes-v226.json')::json WHERE \"workflowId\"='${WORKFLOW_ID}' AND \"versionId\"='${workflow.activeVersionId}';
      UPDATE execution_entity SET status='canceled', \"stoppedAt\"=COALESCE(\"stoppedAt\",CURRENT_TIMESTAMP)
        WHERE \"workflowId\"='${WORKFLOW_ID}'
          AND \"createdAt\">=TIMESTAMPTZ '2026-08-11 16:09:00+00'
          AND \"createdAt\"<TIMESTAMPTZ '2026-08-11 16:21:00+00'
          AND status IN ('new','running');
    COMMIT;`;
    const updateResult = await runRemote(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${quote(updateSql)}`);
    await runRemote(conn, `rm -f ${quote(remoteNodesPath)}; docker exec ${quote(db)} rm -f /tmp/mdv-n8n-nodes-v226.json`).catch(() => {});

    if (!dbOnly) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
      await waitReplicas(conn, 'n8n_n8n', 1);
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
      await waitReplicas(conn, 'n8n_n8n-runner', 1);
      stopped = false;
    }

    const verifySql = `COPY (SELECT json_build_object('entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb,'guardPresent',we.nodes::text LIKE '%${MARKER}%','remainingIncidentActive',(SELECT count(*) FROM execution_entity WHERE \"workflowId\"='${WORKFLOW_ID}' AND \"createdAt\">=TIMESTAMPTZ '2026-08-11 16:09:00+00' AND \"createdAt\"<TIMESTAMPTZ '2026-08-11 16:21:00+00' AND status IN ('new','running')))::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id='${WORKFLOW_ID}') TO STDOUT;`;
    const verifyRaw = await runRemote(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(verifySql)}`);
    console.log(JSON.stringify({ update: updateResult.trim().split(/\r?\n/), verify: JSON.parse(verifyRaw.trim()) }, null, 2));
  } finally {
    if (stopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitReplicas(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitReplicas(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
