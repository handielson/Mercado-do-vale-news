const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Verificar Pos Lista';
const APPLY = process.argv.includes('--apply');
const OLD_BLOCK = `const buildContinueItem = () => [{
  json: {
    ...source,
    salesPostListHandled: false,
  },
}];`;
const NEW_BLOCK = `function buildContinueItem() {
  return [{
    json: {
      ...source,
      salesPostListHandled: false,
    },
  }];
}`;

function shQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) { return `$${tag}$${value}$${tag}$`; }
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(
    `docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`,
    (error, stream) => {
      if (error) return reject(error);
      let stdout = ''; let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    },
  ));
}
async function waitService(conn, service, expected, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function patchPostListCode(code) {
  const current = String(code || '');
  if (current.includes(NEW_BLOCK)) return current;
  if (!current.includes(OLD_BLOCK)) throw new Error('buildContinueItem block not found');
  const patched = current.replace(OLD_BLOCK, NEW_BLOCK);
  new Function(patched);
  return patched;
}

function patchWorkflow(nodes) {
  const node = nodes.find((item) => item.name === NODE_NAME);
  if (!node) throw new Error(`${NODE_NAME} not found`);
  node.parameters.jsCode = patchPostListCode(node.parameters?.jsCode);
  return nodes;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    if (APPLY) {
      await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
      await waitService(conn, 'n8n_n8n-runner', 0);
      await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
      await waitService(conn, 'n8n_n8n', 0);
      servicesStopped = true;
    }
    const raw = await psql(conn, db, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = patchWorkflow(JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8')));
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, hoistedBuildContinueItem: true }, null, 2));
      return;
    }

    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'history')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (
  SELECT json_build_object(
    'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb,
    'hoistedBuildContinueItem', (node->'parameters'->>'jsCode') LIKE '%function buildContinueItem()%'
  )::text
  FROM workflow_entity we
  JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId",
  LATERAL jsonb_array_elements(we.nodes::jsonb) node
  WHERE we.id=${shQuote(WORKFLOW_ID)} AND node->>'name'=${shQuote(NODE_NAME)}
) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(JSON.stringify({ apply: true, ...result }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { OLD_BLOCK, NEW_BLOCK, patchPostListCode, patchWorkflow };

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
