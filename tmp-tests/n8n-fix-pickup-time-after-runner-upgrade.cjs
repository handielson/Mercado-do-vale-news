const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Verificar Pos Lista';
const APPLY = process.argv.includes('--apply');
const OLD_PICKUP_PARSER = `const parsePickupTime = () => {
  const match = normalized.match(/\\b(\\d{1,2})(?:[:h](\\d{2}))?\\b/);
  if (!match) return '';
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2] || 0)));
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
};`;
const NEW_PICKUP_PARSER = `const parsePickupTime = () => {
  const match = normalized.match(/\\b(\\d{1,2})(?:(?::|h)\\s*(\\d{2}))?\\s*(?:h|horas?)?\\b/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return '';
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
};`;
const OLD_SETTINGS_HELPER = `async function getCompanySettings() {
  const fallback = {
    name: 'Mercado do Vale',
    address_street: 'ABILIO MOURATO CRUZ',
    address_number: '5',
    address_complement: 'LOJA C',
    address_neighborhood: 'COHAB MASSANGANO',
    address_city: 'PETROLINA',
    address_state: 'PE',
    pix_key: '',
    pix_beneficiary_name: 'Mercado do Vale',
    business_hours: {},
  };
  try {
    const res = await fetch('https://api.xiaomipetrolina.com.br/company-settings', {
      headers: { 'x-sync-key': $env.SYNC_SECRET || '', Accept: 'application/json' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : (data.rows?.[0] || data);
    return { ...fallback, ...(row || {}) };
  } catch (error) {
    return fallback;
  }
}`;
const NEW_SETTINGS_HELPER = `async function getCompanySettings() {
  // pickup-settings-public-fallback-v1: business hours must not depend on secret access inside a task runner.
  const fallback = {
    name: 'Mercado do Vale',
    address_street: 'ABILIO MOURATO CRUZ',
    address_number: '5',
    address_complement: 'LOJA C',
    address_neighborhood: 'COHAB MASSANGANO',
    address_city: 'PETROLINA',
    address_state: 'PE',
    pix_key: '',
    pix_beneficiary_name: 'Mercado do Vale',
    business_hours: {},
  };
  const rowOf = (data) => Array.isArray(data) ? data[0] : (data?.rows?.[0] || data || {});
  const parseObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  };
  let protectedRow = {};
  try {
    const syncKey = $env.SYNC_SECRET || '';
    if (syncKey) {
      const response = await fetch('https://api.xiaomipetrolina.com.br/company-settings', {
        headers: { 'x-sync-key': syncKey, Accept: 'application/json' },
      });
      if (response.ok) protectedRow = rowOf(await response.json());
    }
  } catch {}
  let publicRow = {};
  try {
    const response = await fetch('https://api.xiaomipetrolina.com.br/public/company-settings', {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) publicRow = rowOf(await response.json());
  } catch {}
  const settings = { ...fallback, ...publicRow, ...protectedRow };
  settings.business_hours = parseObject(protectedRow.business_hours)
    || parseObject(publicRow.business_hours)
    || {};
  return settings;
}`;

function shQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) { return `$${tag}$${value}$${tag}$`; }
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => (
      code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
    ));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(
    `docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`,
    (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.end(sql);
    },
  ));
}
async function waitService(conn, service, expected, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function patchPostListCode(code) {
  let patched = String(code || '');
  if (!patched.includes(NEW_PICKUP_PARSER)) {
    assert.ok(patched.includes(OLD_PICKUP_PARSER), 'active pickup parser does not match expected source');
    patched = patched.replace(OLD_PICKUP_PARSER, NEW_PICKUP_PARSER);
  }
  if (!patched.includes(NEW_SETTINGS_HELPER) && !patched.includes('pickup-settings-http-node-v2')) {
    assert.ok(patched.includes(OLD_SETTINGS_HELPER), 'active company settings helper does not match expected source');
    patched = patched.replace(OLD_SETTINGS_HELPER, NEW_SETTINGS_HELPER);
  }
  new Function('$json', '$getWorkflowStaticData', patched);
  return patched;
}

function patchWorkflow(nodes) {
  const node = nodes.find((item) => item.name === NODE_NAME);
  assert.ok(node, `${NODE_NAME} not found`);
  node.parameters.jsCode = patchPostListCode(node.parameters?.jsCode);
  return nodes;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });
  let servicesStopped = false;
  try {
    const db = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    assert.ok(db, 'n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const originalNodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const nodes = patchWorkflow(structuredClone(originalNodes));

    const runnerEnv = (await runRemote(
      conn,
      "docker service inspect n8n_n8n-runner --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep '^N8N_BLOCK_ENV_ACCESS_IN_NODE=' || true",
    )).trim();
    const needsRunnerEnv = runnerEnv !== 'N8N_BLOCK_ENV_ACCESS_IN_NODE=false';
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, pickupParserPatch: true, needsRunnerEnv }, null, 2));
      return;
    }
    const running = (await psql(conn, db, "SELECT count(*) FROM execution_entity WHERE status='running';")).trim();
    assert.equal(Number(running), 0, 'there must be no running n8n executions before applying');

    const backupDir = `/var/backups/mdv-system/n8n-pickup-fix-${Date.now()}`;
    await runRemote(conn, `mkdir -p ${shQuote(backupDir)}`);
    await runRemote(conn, `docker service inspect n8n_n8n n8n_n8n-runner > ${shQuote(`${backupDir}/services.json`)}`);
    const backupSql = `COPY (
      SELECT 'entity' AS source, id AS workflow_id, "versionId" AS version_id, nodes::text, connections::text
      FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
      UNION ALL
      SELECT 'history' AS source, "workflowId" AS workflow_id, "versionId" AS version_id, nodes::text, connections::text
      FROM workflow_history WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)}
    ) TO STDOUT;`;
    await runRemote(
      conn,
      `docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A > ${shQuote(`${backupDir}/workflow.tsv`)} <<'SQL'\n${backupSql}\nSQL`,
    );

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const updateSql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'history')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};`;
    await psql(conn, db, updateSql);

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    if (needsRunnerEnv) {
      await runRemote(conn, 'docker service update --env-add N8N_BLOCK_ENV_ACCESS_IN_NODE=false --detach=true n8n_n8n-runner >/dev/null');
    }
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const validation = JSON.parse((await psql(conn, db, `COPY (
      SELECT json_build_object(
        'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb,
        'naturalHourParser', (node->'parameters'->>'jsCode') LIKE '%!Number.isInteger(hour)%',
        'publicHoursFallback', (node->'parameters'->>'jsCode') LIKE '%pickup-settings-public-fallback-v1%'
      )::text
      FROM workflow_entity we
      JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId",
      LATERAL jsonb_array_elements(we.nodes::jsonb) node
      WHERE we.id=${shQuote(WORKFLOW_ID)} AND node->>'name'=${shQuote(NODE_NAME)}
    ) TO STDOUT;`)).trim());
    const appliedRunnerEnv = (await runRemote(
      conn,
      "docker service inspect n8n_n8n-runner --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep '^N8N_BLOCK_ENV_ACCESS_IN_NODE='",
    )).trim();
    const health = (await runRemote(conn, 'curl -fsS https://n8n.mercadodovale.com.br/healthz')).trim();
    assert.equal(appliedRunnerEnv, 'N8N_BLOCK_ENV_ACCESS_IN_NODE=false');
    assert.equal(validation.entityHistoryEqual, true);
    assert.equal(validation.naturalHourParser, true);
    assert.equal(validation.publicHoursFallback, true);
    console.log(JSON.stringify({ apply: true, backupDir, health, runnerEnv: appliedRunnerEnv, ...validation }, null, 2));
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

module.exports = {
  OLD_PICKUP_PARSER,
  NEW_PICKUP_PARSER,
  OLD_SETTINGS_HELPER,
  NEW_SETTINGS_HELPER,
  patchPostListCode,
  patchWorkflow,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
