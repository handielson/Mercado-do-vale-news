const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

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

function patchParseClassifier(code) {
  let next = String(code || '');
  next = next.replace(
    "const venda = parsed && typeof parsed.venda === 'object' && !Array.isArray(parsed.venda) ? parsed.venda : {};",
    "const venda = parsed.venda && typeof parsed.venda === 'object' && !Array.isArray(parsed.venda) ? parsed.venda : {};",
  );
  next = next.replace(
    "const fluxoVenda = parsed && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};",
    "const fluxoVenda = parsed.fluxo_venda && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};",
  );
  new Function('$json', next);
  return next;
}

function patchPostListCep(code) {
  let next = String(code || '');
  next = next.replace(
    "return digits.length >= 8 ? digits.slice(0, 8) : '';",
    "return digits.length === 8 ? digits : '';",
  );
  new Function('$json', '$getWorkflowStaticData', '$env', next);
  return next;
}

function patchWorkflow(nodes) {
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  const postList = nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
  if (!parse || !postList) throw new Error('Required nodes not found');
  parse.parameters.jsCode = patchParseClassifier(parse.parameters.jsCode);
  postList.parameters.jsCode = patchPostListCep(postList.parameters.jsCode);
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
    'nullSafeVenda', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%parsed.venda && typeof parsed.venda%'),
    'exactCepDigits', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Verificar Pos Lista' AND node->'parameters'->>'jsCode' LIKE '%digits.length === 8%')
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
