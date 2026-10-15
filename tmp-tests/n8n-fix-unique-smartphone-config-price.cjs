'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { Client } = require('ssh2');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Contexto Produtos';
const MARKER = 'catalog-unique-smartphone-config-price-v248';
const MODEL_GROUP_MARKER = 'catalog-smartphone-model-id-memory-v2';
const CONFIGURATION_NUMBER_MARKER = 'catalog-smartphone-configuration-numbering-v3';
const APPLY = process.argv.includes('--apply');
const INSPECT = process.argv.includes('--inspect');
const INSPECT_MERGE = process.argv.includes('--inspect-merge');
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitService(conn, service, replicas) {
  for (let index = 0; index < 72; index += 1) {
    const current = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (current === `${replicas}/${replicas}`) return;
    await sleep(2500);
  }
  throw new Error(`Timeout waiting for ${service}=${replicas}`);
}

function patchConfigurationPrice(code) {
  if (code.includes(MARKER)) return code;
  const matcherOld = '  const parts = getPhysicalMemoryPartsV155(product);\n  const storageMatches = requestedStorageValuesV246.length === 0 || requestedStorageValuesV246.includes(parts.storageGb);';
  const matcherNew = `  const parsedPartsV248 = getPhysicalMemoryPartsV155(product);\n  const parts = {\n    ramGb: Number(product.ramGb || parsedPartsV248.ramGb || 0),\n    storageGb: Number(product.storageGb || parsedPartsV248.storageGb || 0),\n  };\n  const storageMatches = requestedStorageValuesV246.length === 0 || requestedStorageValuesV246.includes(parts.storageGb);`;
  assert.ok(code.includes(matcherOld), 'memory matcher anchor changed');
  let result = code.replace(matcherOld, matcherNew);

  const groupAnchor = 'const groupsByKey = new Map();\nfor (const product of candidateProducts) {';
  const groupReplacement = `// ${MARKER}\nconst canonicalProductByConfigurationV248 = new Map();\nfor (const product of candidateProducts) {\n  const configurationKeyV248 = [normalizeKey(product.name), normalizeKey(product.memory)].join('|');\n  const currentV248 = canonicalProductByConfigurationV248.get(configurationKeyV248);\n  if (!currentV248 || Number(product.priceCents || 0) > Number(currentV248.priceCents || 0)) {\n    canonicalProductByConfigurationV248.set(configurationKeyV248, product);\n  }\n}\nconst groupsByKey = new Map();\nfor (const rawProductV248 of candidateProducts) {\n  const configurationKeyV248 = [normalizeKey(rawProductV248.name), normalizeKey(rawProductV248.memory)].join('|');\n  const canonicalProductV248 = canonicalProductByConfigurationV248.get(configurationKeyV248) || rawProductV248;\n  const product = {\n    ...rawProductV248,\n    priceCents: canonicalProductV248.priceCents,\n    price: canonicalProductV248.price,\n    card: canonicalProductV248.card,\n  };`;
  assert.ok(result.includes(groupAnchor), 'catalog grouping anchor changed');
  result = result.replace(groupAnchor, groupReplacement);
  const priceKey = `  const key = [
    normalizeKey(product.name),
    normalizeKey(product.memory),
    product.priceCents,
  ].join('|');`;
  assert.ok(result.includes(priceKey), 'price grouping key changed');
  result = result.replace(priceKey, `  const key = [
    normalizeKey(product.name),
    normalizeKey(product.memory),
  ].join('|');`);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', result);
  return result;
}

function replaceOnce(code, anchor, replacement, label) {
  assert.equal(code.split(anchor).length - 1, 1, `${label} anchor changed`);
  return code.replace(anchor, replacement);
}

function patchContext(code) {
  let result = patchConfigurationPrice(String(code || ''));
  if (result.includes(MODEL_GROUP_MARKER)) return patchConfigurationNumbering(result);
  result = replaceOnce(result,
    '      id: product.id,\n      name: withoutColorSuffix(product.name, color),',
    `      id: product.id,
      modelId: String(product.model_id || '').trim(),
      modelName: String(product.model_name || '').replace(/\\s+/g, ' ').trim(),
      name: String(product.model_name || '').replace(/\\s+/g, ' ').trim() || withoutColorSuffix(product.name, color),`,
    'canonical model identity');
  result = replaceOnce(result,
    `// ${MARKER}\nconst canonicalProductByConfigurationV248 = new Map();`,
    `// ${MARKER}
// ${MODEL_GROUP_MARKER}: model identity owns the family; physical memory owns its configuration.
const quoteModelIdentityV2 = (product) => product.modelId
  ? 'model:' + product.modelId
  : 'name:' + normalizeKey(product.name);
const quoteConfigurationKeyV2 = (product) => [
  quoteModelIdentityV2(product),
  product.ramGb || product.storageGb
    ? [Number(product.ramGb || 0), Number(product.storageGb || 0)].join('/')
    : normalizeKey(product.memory),
].join('|');
const canonicalProductByConfigurationV248 = new Map();`,
    'configuration identity helper');
  result = replaceOnce(result,
    "const configurationKeyV248 = [normalizeKey(product.name), normalizeKey(product.memory)].join('|');",
    'const configurationKeyV248 = quoteConfigurationKeyV2(product);',
    'canonical configuration price');
  result = replaceOnce(result,
    "const configurationKeyV248 = [normalizeKey(rawProductV248.name), normalizeKey(rawProductV248.memory)].join('|');",
    'const configurationKeyV248 = quoteConfigurationKeyV2(rawProductV248);',
    'configuration color grouping');
  result = replaceOnce(result,
    "  const key = [\n    normalizeKey(product.name),\n    normalizeKey(product.memory),\n  ].join('|');",
    '  const key = quoteConfigurationKeyV2(product);',
    'configuration grouping');
  result = replaceOnce(result,
    "const quoteProductGroupKey = (product) => [\n  'product',\n  normalizeKey(product.name),\n  normalizeKey(product.memory),\n  product.priceCents,\n].join('|');",
    "const quoteProductGroupKey = (product) => isQuoteDeviceProduct(product)\n  ? quoteConfigurationKeyV2(product)\n  : ['product', normalizeKey(product.name), normalizeKey(product.memory), product.priceCents].join('|');",
    'smartphone model family grouping');
  result = replaceOnce(result,
    'groups.set(key, { ...product, memoryOptions: isQuoteDeviceProduct(product) && product.memory ? [{ ...product }] : [] });',
    'groups.set(key, { ...product, colors: [...(product.colors || [])], memoryOptions: isQuoteDeviceProduct(product) && product.memory ? [{ ...product }] : [] });',
    'independent family colors');
  new Function('$json', '$input', '$getWorkflowStaticData', '$', result);
  return patchConfigurationNumbering(result);
}

// Number each physical configuration. Keep the canonical model name and color
// consolidation, while leaving already-presented option numbers in state intact.
function patchConfigurationNumbering(code) {
  const oldKey = 'const quoteProductGroupKey = (product) => isQuoteDeviceProduct(product)\n  ? quoteModelIdentityV2(product)';
  const newKey = 'const quoteProductGroupKey = (product) => isQuoteDeviceProduct(product)\n  ? quoteConfigurationKeyV2(product)';
  assert.ok(code.includes('const quoteConfigurationKeyV2 = (product) => ['), 'configuration identity helper missing');
  let result = code;
  if (result.includes(oldKey)) result = replaceOnce(result, oldKey, newKey, 'number model and physical memory separately');
  assert.equal(result.split(newKey).length - 1, 1, 'configuration numbering key changed');
  if (!result.includes(CONFIGURATION_NUMBER_MARKER)) result = result.replace(newKey, '// ' + CONFIGURATION_NUMBER_MARKER + '\n' + newKey);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', result);
  return result;
}

function assertDeployableSnapshot(workflow) {
  assert.equal(workflow.active, true, 'workflow must be active');
  assert.ok(workflow.activeVersionId, 'active version missing');
  assert.equal(workflow.versionId, workflow.activeVersionId, 'draft and active version differ');
  assert.deepEqual(workflow.historyNodes, workflow.nodes, 'active history nodes differ from entity');
  assert.deepEqual(workflow.historyConnections, workflow.connections, 'active history connections differ from entity');
  assert.equal(Number(workflow.activeExecutions), 0, 'new/running executions must finish before applying');
  assert.equal(workflow.nodes.filter((node) => node.name === NODE_NAME).length, 1, 'target node must be unique');
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container not found');
    const sqlRead = `COPY (SELECT encode(convert_to(json_build_object('nodes',w.nodes::jsonb,'connections',w.connections::jsonb,'activeVersionId',w."activeVersionId",'versionId',w."versionId",'active',w.active,'updatedAt',w."updatedAt",'historyNodes',h.nodes::jsonb,'historyConnections',h.connections::jsonb,'activeExecutions',(SELECT COUNT(*) FROM execution_entity e WHERE e."workflowId"=w.id AND e.status IN ('new','running')))::text,'UTF8'),'hex') FROM workflow_entity w LEFT JOIN workflow_history h ON h."workflowId"=w.id AND h."versionId"=w."activeVersionId" WHERE w.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const readSnapshot = async () => {
      const raw = await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1 -c ${shQuote(sqlRead)}`);
      return JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
    };
    const snapshot = await readSnapshot();
    const workflow = structuredClone(snapshot);
    const node = workflow.nodes.find((item) => item.name === NODE_NAME);
    assert.ok(node, `${NODE_NAME} not found`);
    const before = String(node.parameters?.jsCode || '');
    if (INSPECT) {
      const start = before.indexOf('const groupsByKey = new Map();');
      console.log(before.slice(start, start + 1800));
      return;
    }
    if (INSPECT_MERGE) {
      const start = before.indexOf('const mergeQuoteProducts');
      console.log(before.slice(start, start + 4200));
      return;
    }
    node.parameters.jsCode = patchContext(before);
    const summary = {
      apply: APPLY,
      changed: node.parameters.jsCode !== before,
      marker: node.parameters.jsCode.includes(MARKER),
      modelIdentityGrouping: node.parameters.jsCode.includes(MODEL_GROUP_MARKER),
      structuredMemoryFallback: node.parameters.jsCode.includes('product.storageGb || parsedPartsV248.storageGb'),
      groupingWithoutPrice: !node.parameters.jsCode.includes('    product.priceCents,\n  ].join'),
    };
    if (!APPLY) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    assertDeployableSnapshot(snapshot);
    if (!summary.changed) {
      assert.equal(patchContext(before), before, 'already-applied patch must be idempotent');
      console.log(JSON.stringify({ ...summary, verified: true }, null, 2));
      return;
    }
    // Gate the exact node and connection graph that will be written. A dry run
    // over the current workflow would validate the old behavior instead.
    const candidatePath = path.join(os.tmpdir(), `mdv-phone-numbering-candidate-${Date.now()}.json`);
    fs.writeFileSync(candidatePath, JSON.stringify({ nodes: workflow.nodes, connections: workflow.connections }), { flag: 'wx' });
    try {
      summary.regressionGate = require('../scripts/n8n-sales-regression-gate.cjs').runGate(candidatePath);
    } finally {
      fs.unlinkSync(candidatePath);
    }
    const backupPath = path.join(os.tmpdir(), `mdv-phone-grouping-before-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), { flag: 'wx' });
    summary.backupPath = backupPath;
    stopped = true; // Restore both services even if stopping the runner succeeds but a later step fails.
    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0);
    const stoppedSnapshot = await readSnapshot();
    assertDeployableSnapshot(stoppedSnapshot);
    assert.deepEqual(stoppedSnapshot, snapshot, 'workflow changed while services were stopping; abort without writing');
    const remotePath = `/tmp/mdv-phone-grouping-${Date.now()}.json`;
    const nodeIndex = workflow.nodes.findIndex((item) => item.name === NODE_NAME);
    const payload = { snapshot, jsCode: node.parameters.jsCode, expectedNodes: workflow.nodes };
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => error ? reject(error) : sftp.writeFile(remotePath, Buffer.from(JSON.stringify(payload), 'utf8'), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); })));
    await runRemote(conn, `docker cp ${shQuote(remotePath)} ${shQuote(db)}:${shQuote(remotePath)}`);
    const sql = `BEGIN;
DO $phone_grouping$
DECLARE payload jsonb := pg_read_file('${remotePath}')::jsonb; entity workflow_entity%ROWTYPE; history workflow_history%ROWTYPE;
BEGIN
  SELECT * INTO STRICT entity FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)} FOR UPDATE;
  SELECT * INTO STRICT history FROM workflow_history WHERE "workflowId"=entity.id AND "versionId"=entity."activeVersionId" FOR UPDATE;
  IF entity.active IS DISTINCT FROM TRUE
    OR entity."versionId" IS DISTINCT FROM entity."activeVersionId"
    OR entity."activeVersionId"::text IS DISTINCT FROM payload->'snapshot'->>'activeVersionId'
    OR entity.nodes::jsonb IS DISTINCT FROM payload->'snapshot'->'nodes'
    OR entity.connections::jsonb IS DISTINCT FROM payload->'snapshot'->'connections'
    OR history.nodes::jsonb IS DISTINCT FROM entity.nodes::jsonb
    OR history.connections::jsonb IS DISTINCT FROM entity.connections::jsonb
    OR EXISTS (SELECT 1 FROM execution_entity WHERE "workflowId"=entity.id AND status IN ('new','running'))
  THEN RAISE EXCEPTION 'workflow drift or active execution; abort'; END IF;
  UPDATE workflow_entity SET nodes=jsonb_set(nodes::jsonb,'{${nodeIndex},parameters,jsCode}',payload->'jsCode',false)::json,"updatedAt"=NOW() WHERE id=entity.id;
  UPDATE workflow_history SET nodes=jsonb_set(nodes::jsonb,'{${nodeIndex},parameters,jsCode}',payload->'jsCode',false)::json WHERE "workflowId"=entity.id AND "versionId"=entity."activeVersionId";
  IF NOT EXISTS (SELECT 1 FROM workflow_entity w JOIN workflow_history h ON h."workflowId"=w.id AND h."versionId"=w."activeVersionId"
    WHERE w.id=entity.id AND w.nodes::jsonb=payload->'expectedNodes' AND h.nodes::jsonb=w.nodes::jsonb
      AND w.connections::jsonb=payload->'snapshot'->'connections' AND h.connections::jsonb=w.connections::jsonb)
  THEN RAISE EXCEPTION 'post-write verification failed'; END IF;
END $phone_grouping$;
COMMIT;`;
    await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${shQuote(sql)}`);
    const verified = await readSnapshot();
    assertDeployableSnapshot(verified);
    assert.deepEqual(verified.nodes, workflow.nodes, 'only intended target code may change');
    assert.deepEqual(verified.connections, snapshot.connections, 'connections must remain unchanged');
    assert.equal(verified.activeVersionId, snapshot.activeVersionId);
    assert.equal(require('../scripts/n8n-sales-regression-gate.cjs').fingerprint(verified), summary.regressionGate.sha256,
      'readback must be the exact tested candidate');
    assert.equal(patchContext(verified.nodes[nodeIndex].parameters.jsCode), verified.nodes[nodeIndex].parameters.jsCode, 'post-write patch idempotence');
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); stopped = false;
    const restarted = await readSnapshot();
    assert.equal(restarted.active, true);
    assert.equal(restarted.activeVersionId, snapshot.activeVersionId);
    assert.equal(restarted.versionId, restarted.activeVersionId);
    assert.deepEqual(restarted.nodes, verified.nodes, 'entity changed after restart');
    assert.deepEqual(restarted.historyNodes, restarted.nodes, 'active history differs after restart');
    assert.deepEqual(restarted.connections, snapshot.connections);
    assert.deepEqual(restarted.historyConnections, restarted.connections);
    summary.verified = true;
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (stopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { patchContext, patchConfigurationNumbering, MODEL_GROUP_MARKER, CONFIGURATION_NUMBER_MARKER, assertDeployableSnapshot };
