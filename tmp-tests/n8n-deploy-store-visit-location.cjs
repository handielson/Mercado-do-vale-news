const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { patchWorkflow, amendLocationHours, MARKER } = require('./n8n-store-visit-location-patch.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const base = path.join(__dirname, '../.local');
const amend = process.argv.includes('--amend-hours');
const originalBefore = JSON.parse(fs.readFileSync(path.join(base, 'location-workflow-before.json'), 'utf8'));
const before = amend ? JSON.parse(fs.readFileSync(path.join(base, 'location-workflow-visit-v1.json'), 'utf8')) : originalBefore;
const targetNames = amend ? ['Loja - Localizacao'] : ['Agente Inicial - Classificador', 'Parse Classificacao', 'Resolver Acao de Conversacao', 'Loja - Localizacao'];
const transform = (workflow) => amend ? amendLocationHours(workflow, originalBefore) : patchWorkflow(workflow);
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const dollar = (value, tag) => {
  if (String(value).includes(`$${tag}$`)) throw new Error('SQL dollar quote collision');
  return `$${tag}$${String(value)}$${tag}$`;
};

function remote(conn, command, input = null) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Remote exit ${code}`)));
    stream.end(input);
  }));
}

async function waitReplicas(conn, service, expected) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const result = (await remote(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (result === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service}: timeout waiting for ${expected} replicas`);
}

function decode(row) {
  return {
    id: row.id,
    versionId: row.versionId,
    activeVersionId: row.activeVersionId,
    nodes: JSON.parse(Buffer.from(row.nodesHex, 'hex').toString('utf8')),
    connections: JSON.parse(Buffer.from(row.connectionsHex, 'hex').toString('utf8')),
  };
}

function sameTargets(actual, expected) {
  return targetNames.every((name) => JSON.stringify(actual.nodes.find((node) => node.name === name)) === JSON.stringify(expected.nodes.find((node) => node.name === name)));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await remote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!/^n8n_n8n-db[.\w-]*$/.test(db)) throw new Error('n8n database container unavailable');
    const psql = (sql) => remote(conn, `docker exec -i ${db} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, sql);
    const read = async () => {
      const sql = `COPY (SELECT json_build_object('id',id,'versionId',"versionId",'activeVersionId',"activeVersionId",'nodesHex',encode(convert_to(nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(connections::text,'UTF8'),'hex')) FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
      return decode(JSON.parse((await psql(sql)).trim()));
    };
    const initial = await read();
    if (initial.activeVersionId !== before.activeVersionId || !sameTargets(initial, before) || JSON.stringify(initial.connections) !== JSON.stringify(before.connections)) {
      throw new Error('Workflow ativo mudou desde a análise; publicação cancelada');
    }
    if (process.argv.includes('--dry-run')) {
      const candidate = transform(initial);
      console.log(JSON.stringify({ dryRun: true, workflowId: WORKFLOW_ID, activeVersionId: initial.activeVersionId, nodes: targetNames, connectionsUnchanged: JSON.stringify(candidate.connections) === JSON.stringify(initial.connections) }));
      return;
    }

    await remote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    stopped = true;
    await waitReplicas(conn, 'n8n_n8n-runner', 0);
    await remote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitReplicas(conn, 'n8n_n8n', 0);
    const current = await read();
    if (current.activeVersionId !== initial.activeVersionId || !sameTargets(current, initial) || JSON.stringify(current.connections) !== JSON.stringify(initial.connections)) {
      throw new Error('Workflow mudou durante a pausa; publicação cancelada');
    }
    const historySql = `COPY (SELECT json_build_object('nodesHex',encode(convert_to(nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(connections::text,'UTF8'),'hex')) FROM workflow_history WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(current.activeVersionId)}) TO STDOUT;`;
    const history = JSON.parse((await psql(historySql)).trim());
    const activeNodes = JSON.parse(Buffer.from(history.nodesHex, 'hex').toString('utf8'));
    const activeConnections = JSON.parse(Buffer.from(history.connectionsHex, 'hex').toString('utf8'));
    if (JSON.stringify(activeNodes) !== JSON.stringify(current.nodes) || JSON.stringify(activeConnections) !== JSON.stringify(current.connections)) {
      throw new Error('Versão ativa e entidade divergentes; publicação cancelada');
    }
    const backupPath = path.join(base, `store-visit-location-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ entity: current, history: { nodes: activeNodes, connections: activeConnections } }), { mode: 0o600 });
    const candidate = transform(current);
    const nodes = JSON.stringify(candidate.nodes);
    const sql = `BEGIN;
UPDATE workflow_entity SET nodes=${dollar(nodes, 'storevisit_entity_nodes')}::json, "versionId"="activeVersionId", "updatedAt"=NOW()
WHERE id=${quote(WORKFLOW_ID)} AND "activeVersionId"=${quote(current.activeVersionId)};
UPDATE workflow_history SET nodes=${dollar(nodes, 'storevisit_history_nodes')}::json, "updatedAt"=NOW()
WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(current.activeVersionId)};
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)} AND nodes::text LIKE '%${amend ? 'Horário regular de hoje' : MARKER}%') THEN RAISE EXCEPTION 'Entity patch missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM workflow_history WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(current.activeVersionId)} AND nodes::text LIKE '%${amend ? 'Horário regular de hoje' : MARKER}%') THEN RAISE EXCEPTION 'Active history patch missing'; END IF;
END $$;
COMMIT;`;
    await psql(sql);
    const verified = await read();
    if (JSON.stringify(verified.nodes) !== JSON.stringify(candidate.nodes) || JSON.stringify(verified.connections) !== JSON.stringify(current.connections)) {
      throw new Error('Read-back do workflow divergiu após publicação');
    }
    console.log(JSON.stringify({ published: true, workflowId: WORKFLOW_ID, activeVersionId: verified.activeVersionId, backupPath, nodes: targetNames, connectionsUnchanged: true }));
  } finally {
    if (stopped) {
      await remote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
      await waitReplicas(conn, 'n8n_n8n', 1);
      await remote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
      await waitReplicas(conn, 'n8n_n8n-runner', 1);
    }
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
