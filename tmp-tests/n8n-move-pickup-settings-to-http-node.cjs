const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { NEW_SETTINGS_HELPER } = require('./n8n-fix-pickup-time-after-runner-upgrade.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const POST_LIST = 'Vendas - Verificar Pos Lista';
const SETTINGS_NODE = 'Vendas - Buscar Configuracoes Loja';
const MARKER = 'pickup-settings-http-node-v2';
const APPLY = process.argv.includes('--apply');
const OLD_SOURCE = `return (async () => {\nconst source = $json;`;
const NEW_SOURCE = `return (async () => {\n// ${MARKER}\nconst companySettingsPayloadV375 = $json || {};\nconst source = $('Parse Classificacao').first().json || {};`;
const HTTP_SETTINGS_HELPER = `async function getCompanySettings() {
  // ${MARKER}: the HTTP Request node owns network and secret access.
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
  const row = Array.isArray(companySettingsPayloadV375)
    ? (companySettingsPayloadV375[0] || {})
    : (companySettingsPayloadV375?.rows?.[0] || companySettingsPayloadV375 || {});
  const parseObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  };
  const settings = { ...fallback, ...row };
  settings.business_hours = parseObject(row.business_hours) || {};
  return settings;
}`;

const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
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
function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert.notEqual(first, -1, `missing ${label}`);
  assert.equal(source.indexOf(search, first + search.length), -1, `duplicate ${label}`);
  return source.replace(search, replacement);
}
function makeSettingsNode() {
  return {
    id: 'sales-store-settings-http-v375',
    name: SETTINGS_NODE,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1632, 352],
    onError: 'continueRegularOutput',
    continueOnFail: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1200,
    parameters: {
      url: 'https://api.xiaomipetrolina.com.br/company-settings',
      options: { timeout: 15000 },
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
    },
  };
}
function patchPostList(code) {
  let patched = String(code || '');
  if (!patched.includes(MARKER)) patched = replaceOnce(patched, OLD_SOURCE, NEW_SOURCE, 'post-list source anchor');
  if (!patched.includes(`${MARKER}: the HTTP Request node`)) {
    patched = replaceOnce(patched, NEW_SETTINGS_HELPER, HTTP_SETTINGS_HELPER, 'company settings helper');
  }
  patched = patched.replace(
    'const todayKey = weekdayKey(new Date());',
    "const todayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', weekday: 'long' }).format(new Date()).toLowerCase();",
  );
  patched = patched.replace(
    `  const schedule = hours[todayKey] || {};\n  if (!schedule.isOpen) {`,
    `  const schedule = hours[todayKey];\n  if (!schedule || typeof schedule.isOpen !== 'boolean') {\n    return { ok: false, message: 'Nao consegui confirmar o horario cadastrado da loja agora.' + lineBreak + 'Vou pedir para um atendente confirmar para voce.' };\n  }\n  if (!schedule.isOpen) {`,
  );
  assert.ok(patched.includes('America/Recife'));
  assert.ok(patched.includes('Nao consegui confirmar o horario cadastrado'));
  assert.doesNotMatch(patched, /await fetch\('https:\/\/api\.xiaomipetrolina\.com\.br\/company-settings'/);
  new Function('$json', '$', '$getWorkflowStaticData', patched);
  return patched;
}
function patchWorkflow(workflow) {
  const post = workflow.nodes.find((node) => node.name === POST_LIST);
  assert.ok(post, `${POST_LIST} not found`);
  post.parameters.jsCode = patchPostList(post.parameters.jsCode);
  const existing = workflow.nodes.findIndex((node) => node.name === SETTINGS_NODE);
  if (existing >= 0) workflow.nodes[existing] = makeSettingsNode(); else workflow.nodes.push(makeSettingsNode());
  let rewired = 0;
  for (const outputs of Object.values(workflow.connections)) {
    for (const branches of Object.values(outputs || {})) {
      for (const branch of branches || []) {
        for (const edge of branch || []) {
          if (edge.node === POST_LIST) { edge.node = SETTINGS_NODE; rewired += 1; }
        }
      }
    }
  }
  assert.ok(rewired > 0 || workflow.connections[SETTINGS_NODE], 'no incoming post-list edges were rewired');
  workflow.connections[SETTINGS_NODE] = { main: [[{ node: POST_LIST, type: 'main', index: 0 }]] };
  return workflow;
}
async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container not found');
    const raw = JSON.parse((await psql(conn, db, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}
    ) TO STDOUT;`)).trim());
    const workflow = patchWorkflow({
      nodes: JSON.parse(Buffer.from(raw.nodesHex, 'hex').toString('utf8')),
      connections: JSON.parse(Buffer.from(raw.connectionsHex, 'hex').toString('utf8')),
    });
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, marker: MARKER, settingsNode: true, incomingEdgesRewired: true }, null, 2));
      return;
    }
    const active = Number((await psql(conn, db, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
    const nodesPath = `/tmp/${WORKFLOW_ID}-${MARKER}-nodes.json`;
    const connectionsPath = `/tmp/${WORKFLOW_ID}-${MARKER}-connections.json`;
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(nodesPath, Buffer.from(JSON.stringify(workflow.nodes)), (nodesError) => {
        if (nodesError) { sftp.end(); return reject(nodesError); }
        sftp.writeFile(connectionsPath, Buffer.from(JSON.stringify(workflow.connections)), (connectionsError) => {
          sftp.end(); connectionsError ? reject(connectionsError) : resolve();
        });
      });
    }));
    await run(conn, `docker cp ${quote(nodesPath)} ${quote(db)}:${quote(nodesPath)} && docker cp ${quote(connectionsPath)} ${quote(db)}:${quote(connectionsPath)}`);
    try {
      await psql(conn, db, `BEGIN;
        UPDATE workflow_entity SET nodes=pg_read_file('${nodesPath}')::json, connections=pg_read_file('${connectionsPath}')::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
        UPDATE workflow_history SET nodes=pg_read_file('${nodesPath}')::json, connections=pg_read_file('${connectionsPath}')::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(raw.activeVersionId)};
        COMMIT;`);
    } finally {
      await run(conn, `rm -f ${quote(nodesPath)} ${quote(connectionsPath)}`).catch(() => {});
      await run(conn, `docker exec ${quote(db)} rm -f ${quote(nodesPath)} ${quote(connectionsPath)}`).catch(() => {});
    }
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    stopped = false;
    const verify = JSON.parse((await psql(conn, db, `COPY (
      SELECT json_build_object(
        'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
        'settingsNode', EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(SETTINGS_NODE)}),
        'marker', we.nodes::text LIKE '%${MARKER}%',
        'httpConnection', we.connections::jsonb ? ${quote(SETTINGS_NODE)}
      )::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
      WHERE we.id=${quote(WORKFLOW_ID)}
    ) TO STDOUT;`)).trim());
    assert.deepEqual(verify, { entityHistoryEqual: true, settingsNode: true, marker: true, httpConnection: true });
    console.log(JSON.stringify({ apply: true, backupPath, ...verify }, null, 2));
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

module.exports = { MARKER, HTTP_SETTINGS_HELPER, patchPostList, patchWorkflow, makeSettingsNode };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
