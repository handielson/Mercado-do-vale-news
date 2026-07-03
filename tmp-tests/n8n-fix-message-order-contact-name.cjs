const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const ORDERED_DELAY_EXPRESSION = "={{Number($json.delayMs || 0) > 0 ? Number($json.delayMs || 0) : (900 + (($json.messageIndex || 1) - 1) * 4500 + Math.min(2500, String($json.message || $json.caption || '').length * 12))}}";

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote tag collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote command failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitServiceReplicas(conn, serviceName, expectedReplicas, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  const expected = `${expectedReplicas}/${expectedReplicas}`;
  let last = '';
  while (Date.now() < deadline) {
    last = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`
    )).trim();
    if (last === expected) return last;
    await sleep(3000);
  }
  throw new Error(`Service ${serviceName} did not reach ${expected}; last replicas: ${last || 'unknown'}`);
}

async function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `psql failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

async function readJson(conn, dbContainer, sql) {
  const out = await psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`);
  return JSON.parse(out.trim());
}

function upsertBodyParam(node, name, value) {
  node.parameters = node.parameters || {};
  node.parameters.bodyParameters = node.parameters.bodyParameters || {};
  node.parameters.bodyParameters.parameters = node.parameters.bodyParameters.parameters || [];
  const params = node.parameters.bodyParameters.parameters;
  const existing = params.find((param) => param.name === name);
  if (existing) existing.value = value;
  else params.push({ name, value });
}

function patchDelay(nodes, nodeName) {
  const node = nodes.find((item) => item.name === nodeName);
  if (!node) throw new Error(`${nodeName} node not found`);
  upsertBodyParam(node, 'delay', ORDERED_DELAY_EXPRESSION);
}

function patchLogger(nodes, nodeName, expression) {
  const node = nodes.find((item) => item.name === nodeName);
  if (!node) throw new Error(`${nodeName} node not found`);
  upsertBodyParam(node, 'contactName', expression);
}

function patchWorkflow(nodes) {
  patchDelay(nodes, 'Enviar WhatsApp');
  patchDelay(nodes, 'Enviar WhatsApp - Imagem');
  patchLogger(nodes, 'Controle Bot - Registrar Entrada', '={{$json.clienteNome || $json.pushName || ""}}');
  patchLogger(nodes, 'Controle Bot - Registrar Saida', '={{$json.clienteNome || $("Contato - Resolver").first().json.clienteNome || $("switc Mensagens").first().json.pushName || ""}}');
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" = ${shQuote(entity.activeVersionId)};

COPY (
  SELECT json_build_object(
    'textDelay', (
      SELECT param->>'value'
      FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node,
           jsonb_array_elements(node->'parameters'->'bodyParameters'->'parameters') param
      WHERE id = ${shQuote(WORKFLOW_ID)}
        AND node->>'name' = 'Enviar WhatsApp'
        AND param->>'name' = 'delay'
      LIMIT 1
    ),
    'imageDelay', (
      SELECT param->>'value'
      FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node,
           jsonb_array_elements(node->'parameters'->'bodyParameters'->'parameters') param
      WHERE id = ${shQuote(WORKFLOW_ID)}
        AND node->>'name' = 'Enviar WhatsApp - Imagem'
        AND param->>'name' = 'delay'
      LIMIT 1
    ),
    'inboundContactName', (
      SELECT count(*)
      FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node,
           jsonb_array_elements(node->'parameters'->'bodyParameters'->'parameters') param
      WHERE id = ${shQuote(WORKFLOW_ID)}
        AND node->>'name' = 'Controle Bot - Registrar Entrada'
        AND param->>'name' = 'contactName'
    ),
    'outboundContactName', (
      SELECT count(*)
      FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node,
           jsonb_array_elements(node->'parameters'->'bodyParameters'->'parameters') param
      WHERE id = ${shQuote(WORKFLOW_ID)}
        AND node->>'name' = 'Controle Bot - Registrar Saida'
        AND param->>'name' = 'contactName'
    )
  )::text
  FROM workflow_entity
  WHERE id = ${shQuote(WORKFLOW_ID)}
) TO STDOUT;
`;
    const result = await psql(conn, dbContainer, updateSql);

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);

    console.log(result.trim().split(/\r?\n/).filter(Boolean).pop());
  } catch (error) {
    try {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    } catch (_) {}
    throw error;
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
