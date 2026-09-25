const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { transformWorkflow } = require('./n8n-payjoy-workflow-patch.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const dollar = (value, tag) => `$${tag}$${String(value)}$${tag}$`;

function remote(conn, command, input = null) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Command failed (${code}): ${command}`)));
      stream.end(input);
    });
  });
}

async function replicas(conn, service, count) {
  for (let i = 0; i < 48; i++) {
    const value = (await remote(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}'`)).trim();
    if (value === `${count}/${count}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${count} replicas`);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const container = (await remote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!/^n8n_n8n-db[.\w-]*$/.test(container)) throw new Error('n8n database container unavailable');
    await remote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    stopped = true;
    await replicas(conn, 'n8n_n8n-runner', 0);
    await remote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await replicas(conn, 'n8n_n8n', 0);

    const psql = (sql) => remote(conn, `docker exec -i ${container} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, sql);
    const raw = await psql(`COPY (SELECT json_build_object('id',id,'nodes',nodes,'connections',connections,'versionId',"versionId",'activeVersionId',"activeVersionId") FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const current = JSON.parse(raw.trim());
    if (current.id !== WORKFLOW_ID || !current.activeVersionId) throw new Error('Active workflow could not be verified');
    const backupPath = path.join(os.tmpdir(), `mdv-payjoy-workflow-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(current));
    const updated = transformWorkflow(current);
    const versions = [...new Set([current.versionId, current.activeVersionId])].filter(Boolean);
    const sql = `BEGIN;
UPDATE workflow_entity
SET nodes=${dollar(JSON.stringify(updated.nodes), 'payjoy_nodes')}::json,
    connections=${dollar(JSON.stringify(updated.connections), 'payjoy_connections')}::json,
    "versionId"="activeVersionId", "updatedAt"=NOW()
WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history
SET nodes=${dollar(JSON.stringify(updated.nodes), 'payjoy_history_nodes')}::json,
    connections=${dollar(JSON.stringify(updated.connections), 'payjoy_history_connections')}::json,
    "updatedAt"=NOW()
WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId" IN (${versions.map(quote).join(',')});
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM workflow_entity w, jsonb_array_elements(w.nodes::jsonb) n WHERE w.id=${quote(WORKFLOW_ID)} AND n->>'name'='PayJoy - Buscar Configuracao') THEN
    RAISE EXCEPTION 'PayJoy workflow update missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM workflow_history WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(current.activeVersionId)} AND nodes::text LIKE '%payjoy-config-v1%') THEN
    RAISE EXCEPTION 'Active workflow history update missing';
  END IF;
END $$;
COMMIT;
COPY (SELECT json_build_object('versionAligned',"versionId"="activeVersionId",'payjoyNode',nodes::text LIKE '%payjoy-config-v1%','activeHistory',(SELECT nodes::text LIKE '%payjoy-config-v1%' FROM workflow_history WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(current.activeVersionId)} LIMIT 1)) FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(sql)).trim());
    if (!result.versionAligned || !result.payjoyNode || !result.activeHistory) throw new Error('PayJoy workflow verification failed');
    console.log(JSON.stringify({ backupPath, ...result }));
  } finally {
    try {
      if (stopped) {
        await remote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
        await replicas(conn, 'n8n_n8n', 1);
        await remote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
        await replicas(conn, 'n8n_n8n-runner', 1);
      }
    } finally {
      conn.end();
    }
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
