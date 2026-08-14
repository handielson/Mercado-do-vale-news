const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('ssh2');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const CONTEXT_NODE = 'Vendas - Contexto Produtos';
const SPLIT_NODE = 'Dividir mensagens';
const VERIFY_NODE = 'Controle Bot - Verificar mensagem atual';
const BOT_SENT_NODE = 'Handoff - Registrar bot enviado';
const LOOP_NODE = 'Loop - Enviar mensagens em ordem';
const MODEL_MARKER = 'catalog-model-memory-match-v246';
const ORDER_MARKER = 'catalog-sequential-send-v246';
const APPLY = process.argv.includes('--apply');

const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error); let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitService(conn, service, replicas) {
  for (let i = 0; i < 72; i += 1) {
    const current = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (current === `${replicas}/${replicas}`) return;
    await sleep(2500);
  }
  throw new Error(`Timeout waiting for ${service}=${replicas}`);
}
function nodeByName(nodes, name) { const node = nodes.find((item) => item.name === name); assert.ok(node, `${name} not found`); return node; }
function patchContext(code) {
  if (code.includes(MODEL_MARKER)) return code;
  const old = `const compactModelText = (value) => normalize(value).replace(/\\s+/g, '');
const productMatchesRequestedModel = (product) => {
  if (!requestedDeviceModelQuery) return false;
  const requested = compactModelText(requestedDeviceModelQuery);
  const rawProductModelTextV134 = [product.name, product.originalName, product.brand].filter(Boolean).join(' ');
  const productText = compactModelText(rawProductModelTextV134);
  const requestedModelRequiresPlusV134 = /\\+|\\bplus\\b/i.test(requestedDeviceModelQuery);
  const productModelHasPlusV134 = /\\+|\\bplus\\b/i.test(rawProductModelTextV134);
  if (requestedModelRequiresPlusV134 && !productModelHasPlusV134) return false;
  return Boolean(requested && productText.includes(requested));
};`;
  const replacement = `// ${MODEL_MARKER}
const compactModelText = (value) => normalize(value).replace(/\\s+/g, '');
const requestedMemoryValuesV246 = [...String(requestedDeviceModelQuery || '').matchAll(/\\b(\\d+(?:[.,]\\d+)?)\\s*(tb|gb|g|t)\\b/gi)]
  .map((match) => memoryCapacityToGbV155(match[1] + match[2])).filter((value) => value > 0);
const requestedStorageValuesV246 = Array.isArray(base.requestedStorageGb) && base.requestedStorageGb.length
  ? base.requestedStorageGb.map(Number).filter((value) => value > 0)
  : requestedMemoryValuesV246.filter((value) => value >= 64);
const requestedRamValuesV246 = Array.isArray(base.requestedRamGb) && base.requestedRamGb.length
  ? base.requestedRamGb.map(Number).filter((value) => value > 0)
  : (requestedMemoryValuesV246.length > 1 ? requestedMemoryValuesV246.filter((value) => value < 64) : []);
const requestedModelTextV246 = String(requestedDeviceModelQuery || '').replace(/\\b\\d+(?:[.,]\\d+)?\\s*(?:tb|gb|g|t)\\b/gi, ' ');
const productMatchesRequestedModel = (product) => {
  if (!requestedDeviceModelQuery) return false;
  const requested = compactModelText(requestedModelTextV246);
  const rawProductModelTextV134 = [product.name, product.originalName, product.brand].filter(Boolean).join(' ');
  const productText = compactModelText(rawProductModelTextV134);
  const requestedModelRequiresPlusV134 = /\\+|\\bplus\\b/i.test(requestedDeviceModelQuery);
  const productModelHasPlusV134 = /\\+|\\bplus\\b/i.test(rawProductModelTextV134);
  if (requestedModelRequiresPlusV134 && !productModelHasPlusV134) return false;
  if (!requested || !productText.includes(requested)) return false;
  const parts = getPhysicalMemoryPartsV155(product);
  const storageMatches = requestedStorageValuesV246.length === 0 || requestedStorageValuesV246.includes(parts.storageGb);
  const ramMatches = requestedRamValuesV246.length === 0 || requestedRamValuesV246.includes(parts.ramGb);
  return storageMatches && ramMatches;
};`;
  assert.ok(code.includes(old), 'requested model matcher changed unexpectedly');
  let result = code.replace(old, replacement);
  const sortAnchor = `const products = mergeQuoteProducts(rawProducts).sort((a, b) => {`;
  assert.ok(result.includes(sortAnchor), 'quote sort anchor missing');
  const guard = `const availableBrandLabelsV246 = new Set(products.map((product) => quoteBrandGroupV227(product).label));
`;
  result = result.replace(sortAnchor, `${guard}${sortAnchor}`);
  const headerOld = `if (prefersSmartphones && (!previousBrandV227 || previousBrandV227.label !== currentBrandV227.label)) {`;
  const headerNew = `if (prefersSmartphones && availableBrandLabelsV246.has(currentBrandV227.label) && (!previousBrandV227 || previousBrandV227.label !== currentBrandV227.label)) {`;
  assert.ok(result.includes(headerOld), 'brand header anchor missing');
  result = result.replace(headerOld, headerNew);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', result);
  return result;
}
function patchGraph(nodes, connections) {
  if (nodes.some((node) => node.name === LOOP_NODE)) return;
  const split = nodeByName(nodes, SPLIT_NODE);
  nodes.push({
    id: 'catalog-sequential-send-v246', name: LOOP_NODE,
    type: 'n8n-nodes-base.splitInBatches', typeVersion: 3,
    position: [Number(split.position?.[0] || 800) + 220, Number(split.position?.[1] || 0)],
    parameters: { batchSize: 1, options: {} },
  });
  connections[SPLIT_NODE] = { main: [[{ node: LOOP_NODE, type: 'main', index: 0 }]] };
  connections[LOOP_NODE] = { main: [[{ node: VERIFY_NODE, type: 'main', index: 0 }], []] };
  connections[BOT_SENT_NODE] = { main: [[{ node: LOOP_NODE, type: 'main', index: 0 }]] };
}
function summarize(nodes, connections) {
  const context = nodeByName(nodes, CONTEXT_NODE).parameters.jsCode;
  return {
    modelMemoryMatcher: context.includes(MODEL_MARKER),
    appleHeaderGuard: context.includes('availableBrandLabelsV246.has(currentBrandV227.label)'),
    sequentialLoop: nodes.some((node) => node.name === LOOP_NODE && node.parameters?.batchSize === 1),
    splitFeedsLoop: connections[SPLIT_NODE]?.main?.[0]?.[0]?.node === LOOP_NODE,
    loopFeedsVerifier: connections[LOOP_NODE]?.main?.[0]?.[0]?.node === VERIFY_NODE,
    sentFeedsLoop: connections[BOT_SENT_NODE]?.main?.[0]?.[0]?.node === LOOP_NODE,
  };
}
async function main() {
  const conn = new Client(); await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim(); assert.ok(db);
    const sqlRead = `COPY (SELECT encode(convert_to(json_build_object('nodes',nodes::jsonb,'connections',connections::jsonb,'activeVersionId',"activeVersionId")::text,'UTF8'),'hex') FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const raw = await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shQuote(sqlRead)}`);
    const workflow = JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
    const context = nodeByName(workflow.nodes, CONTEXT_NODE); context.parameters.jsCode = patchContext(String(context.parameters?.jsCode || ''));
    patchGraph(workflow.nodes, workflow.connections);
    const summary = summarize(workflow.nodes, workflow.connections);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));
    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); stopped = true;
    const remotePath = '/tmp/mdv-catalog-order-model-v246.json';
    await new Promise((resolve, reject) => conn.sftp((e, s) => e ? reject(e) : s.writeFile(remotePath, Buffer.from(JSON.stringify(workflow.nodes), 'utf8'), (x) => { s.end(); x ? reject(x) : resolve(); })));
    await runRemote(conn, `docker cp ${shQuote(remotePath)} ${shQuote(db)}:${shQuote(remotePath)}`);
    const sql = `BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('${remotePath}')::json, connections=${shQuote(JSON.stringify(workflow.connections))}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)}; UPDATE workflow_history SET nodes=pg_read_file('${remotePath}')::json, connections=${shQuote(JSON.stringify(workflow.connections))}::json WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)}; COMMIT;`;
    await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${shQuote(sql)}`);
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); stopped = false;
    console.log(JSON.stringify({ apply: true, ...summary }, null, 2));
  } finally { if (stopped) { await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {}); await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); } conn.end(); }
}
if (require.main === module) main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
module.exports = { patchContext, patchGraph, summarize };
