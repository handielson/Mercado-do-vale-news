const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Preparar Handoff Especialista';
const MARKER = 'product-specialist-admin-notification-v528';
const APPLY = process.argv.includes('--apply');
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const dollar = (value, tag) => `$${tag}$${String(value)}$${tag}$`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote ${code}`)));
  }));
}

function psql(connection, database, sql) {
  return new Promise((resolve, reject) => connection.exec(
    `docker exec -i ${quote(database)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,
    (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql ${code}`)));
      stream.end(sql);
    },
  ));
}

async function waitService(connection, service, expected) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const replicas = (await run(connection, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = workflow.nodes.find((item) => item.name === NODE_NAME);
  assert.ok(node, `${NODE_NAME} not found`);
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    assert.match(code, /specialistHandoffBy:\s*'bot-product-specialist'/, 'old silent product handoff not found');
    code = code.replace(
      /\s*specialistHandoffBy:\s*'bot-product-specialist',/,
      `\n    // ${MARKER}: use the relay identity that actually alerts active administrators.\n    specialistHandoffBy: 'bot-handoff-request',`,
    );
  }
  assert.match(code, /specialistHandoffBy:\s*'bot-handoff-request'/);
  assert.doesNotMatch(code, /specialistHandoffBy:\s*'bot-product-specialist'/);
  new Function('$', '$json', code);
  node.parameters.jsCode = code;
  return workflow;
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const database = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(database, 'n8n database not found');
    const raw = await psql(connection, database, `COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we."activeVersionId",'active',we.active,'versionAligned',we."versionId"=we."activeVersionId",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const row = JSON.parse(raw.trim());
    const workflow = {
      nodes: JSON.parse(Buffer.from(row.nodesHex, 'hex').toString('utf8')),
      connections: JSON.parse(Buffer.from(row.connectionsHex, 'hex').toString('utf8')),
    };
    const updated = patchWorkflow(workflow);
    const changed = JSON.stringify(updated.nodes) !== JSON.stringify(workflow.nodes);
    const summary = { apply: APPLY, active: row.active, versionAligned: row.versionAligned, entityHistoryEqual: row.entityHistoryEqual, changed };
    if (!APPLY) return console.log(JSON.stringify(summary, null, 2));

    assert.equal(row.active, true);
    assert.equal(row.versionAligned, true);
    assert.equal(row.entityHistoryEqual, true);
    assert.equal(changed, true, 'workflow already uses the notified product handoff');
    const active = Number((await psql(connection, database, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = path.join(os.tmpdir(), `n8n-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: row.activeVersionId, ...workflow }, null, 2), { flag: 'wx' });

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    stopped = true;
    const sql = `BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(updated.nodes), 'nodesv528')}::json,"versionId"="activeVersionId","updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(updated.nodes), 'historynodesv528')}::json,"updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(row.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb,'notifiedHandoff',EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(NODE_NAME)} AND node->'parameters'->>'jsCode' LIKE '%${MARKER}%' AND node->'parameters'->>'jsCode' LIKE '%bot-handoff-request%' AND node->'parameters'->>'jsCode' NOT LIKE '%bot-product-specialist%'))::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, database, sql)).trim());
    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    stopped = false;
    console.log(JSON.stringify({ ...summary, ...verification, backupPath }, null, 2));
  } finally {
    if (stopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchWorkflow };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
