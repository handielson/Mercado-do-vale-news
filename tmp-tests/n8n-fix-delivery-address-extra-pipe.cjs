const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Resolver CEP HTTP';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  return `$${tag}$${String(value).replace(new RegExp(`\\$${tag}\\$`, 'g'), '')}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${serviceName} replicas ${expected}/${expected}`);
}

function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((text) => JSON.parse(text.trim()));
}

function patchWorkflow(nodes) {
  const node = nodes.find((item) => item.name === NODE_NAME);
  if (!node) throw new Error(`${NODE_NAME} not found`);
  let code = String(node.parameters?.jsCode || '');
  code = code.replace(
    "'Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.'",
    "'Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.'",
  );
  if (code.includes("lineBreak + lineBreak + 'Agora me manda")) {
    throw new Error('Double lineBreak before address follow-up still present');
  }
  node.parameters.jsCode = code;
  new Function('$json', '$getWorkflowStaticData', code);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'versionId', "versionId",
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);

    const versionIds = Array.from(new Set([entity.versionId, entity.activeVersionId])).filter(Boolean);
    const versionList = versionIds.map(shQuote).join(',');

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "versionId" = "activeVersionId",
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" IN (${versionList});

COPY (
  SELECT json_build_object(
    'versionAligned', (SELECT "versionId" = "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}),
    'extraPipeFixed', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'=${shQuote(NODE_NAME)} AND node->'parameters'->>'jsCode' NOT LIKE '%lineBreak + lineBreak + ''Agora me manda%')
  )::text
) TO STDOUT;
`;
    const result = JSON.parse((await psql(conn, dbContainer, updateSql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
