const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// catalog-direct-response-v366';

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
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
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function nodeByName(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`${name} not found`);
  return node;
}
function replaceRequired(code, search, replacement, label) {
  if (!code.includes(search)) throw new Error(`${label} anchor not found`);
  return code.replace(search, replacement);
}

function patchPrepareSearch(nodes) {
  const node = nodeByName(nodes, 'Vendas - Preparar Busca');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:brand`)) return;
  code = replaceRequired(
    code,
    `const broadBrandOnlyRequest = Boolean(requestedDeviceBrand)\n  && !specificDeviceModelRequest\n  && tokens.length === 1\n  && tokens[0] !== 'iphone'\n  && !explicitPhoneDeviceRequest\n  && !classifiedCategoryId;`,
    `${MARKER}:brand\n// Uma marca de smartphone reconhecida e uma selecao valida da lista anterior.\n// Ela deve abrir a lista da marca imediatamente, sem pedir confirmacao.\nconst broadBrandOnlyRequest = false;`,
    'brand-only clarification',
  );
  code = replaceRequired(
    code,
    `const forceSmartphoneCategory = Boolean(\n  source.deviceClarificationConfirmed\n  || (requestedDeviceBrand && explicitPhoneDeviceRequest)`,
    `const forceSmartphoneCategory = Boolean(\n  source.deviceClarificationConfirmed\n  || Boolean(requestedDeviceBrand)\n  || (requestedDeviceBrand && explicitPhoneDeviceRequest)`,
    'brand category routing',
  );
  new Function(code);
  node.parameters.jsCode = code;
}

function patchComposer(nodes) {
  const node = nodeByName(nodes, 'Vendas - Compor Resposta IA');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:composer`)) return;
  code = replaceRequired(
    code,
    `const structuredCatalogOnlyV365 = source.structuredPhoneComparison === true && Boolean(catalogOutput);`,
    `const structuredCatalogOnlyV365 = source.structuredPhoneComparison === true && Boolean(catalogOutput);\n${MARKER}:composer\nconst catalogReadyV366 = Boolean(catalogOutput);`,
    'catalog-ready flag',
  );
  code = replaceRequired(
    code,
    `output: structuredCatalogOnlyV365 ? catalogOutput : [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]'),`,
    `output: catalogReadyV366 ? catalogOutput : aiOutput,`,
    'catalog-only output',
  );
  new Function(code);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  patchPrepareSearch(nodes);
  patchComposer(nodes);
  return nodes;
}

function summarize(nodes) {
  const prepare = nodeByName(nodes, 'Vendas - Preparar Busca').parameters.jsCode;
  const composer = nodeByName(nodes, 'Vendas - Compor Resposta IA').parameters.jsCode;
  return {
    markerPresent: prepare.includes(`${MARKER}:brand`) && composer.includes(`${MARKER}:composer`),
    brandListsDirectly: prepare.includes('const broadBrandOnlyRequest = false;'),
    brandForcesSmartphoneCategory: prepare.includes('|| Boolean(requestedDeviceBrand)'),
    catalogSuppressesAiPreface: composer.includes('output: catalogReadyV366 ? catalogOutput : aiOutput,'),
    aiFallbackPreserved: composer.includes(': aiOutput,'),
  };
}

async function serviceMap(conn) {
  const output = await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const { Client } = require('ssh2');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', \"activeVersionId\")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);
    const summary = summarize(nodes);
    if (!Object.values(summary).every(Boolean)) throw new Error(`Validation failed: ${JSON.stringify(summary)}`);
    if (!APPLY) {
      const verification = JSON.parse((await psql(conn, db, `COPY (SELECT json_build_object('entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb, 'active', we.active) FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`)).trim());
      const services = await serviceMap(conn);
      return console.log(JSON.stringify({ apply: false, ...summary, ...verification, services: { n8n: services.n8n_n8n, runner: services['n8n_n8n-runner'], evolution: services['n8n_evolution-api'] } }, null, 2));
    }

    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, \"versionId\"=\"activeVersionId\", \"updatedAt\"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, \"updatedAt\"=NOW() WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND \"versionId\"=${quote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'brandListsDirectly', we.nodes::text LIKE '%catalog-direct-response-v366:brand%',
  'catalogSuppressesAiPreface', we.nodes::text LIKE '%catalogReadyV366 ? catalogOutput : aiOutput%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;
COMMIT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({ apply: true, ...result, ...summary, services: { n8n: services.n8n_n8n, runner: services['n8n_n8n-runner'], evolution: services['n8n_evolution-api'] } }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { MARKER, patchPrepareSearch, patchComposer, patchWorkflow, summarize, main };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
