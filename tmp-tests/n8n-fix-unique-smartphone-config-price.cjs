'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('ssh2');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Contexto Produtos';
const MARKER = 'catalog-unique-smartphone-config-price-v248';
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

function patchContext(code) {
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

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container not found');
    const sqlRead = `COPY (SELECT encode(convert_to(json_build_object('nodes',nodes::jsonb,'connections',connections::jsonb,'activeVersionId',\"activeVersionId\")::text,'UTF8'),'hex') FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const raw = await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shQuote(sqlRead)}`);
    const workflow = JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
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
      structuredMemoryFallback: node.parameters.jsCode.includes('product.storageGb || parsedPartsV248.storageGb'),
      groupingWithoutPrice: !node.parameters.jsCode.includes('    product.priceCents,\n  ].join'),
    };
    if (!APPLY) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); stopped = true;
    const remotePath = '/tmp/mdv-catalog-unique-price-v248.json';
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => error ? reject(error) : sftp.writeFile(remotePath, Buffer.from(JSON.stringify(workflow.nodes), 'utf8'), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); })));
    await runRemote(conn, `docker cp ${shQuote(remotePath)} ${shQuote(db)}:${shQuote(remotePath)}`);
    const sql = `BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('${remotePath}')::json, \"versionId\"=\"activeVersionId\", \"updatedAt\"=NOW() WHERE id=${shQuote(WORKFLOW_ID)}; UPDATE workflow_history SET nodes=pg_read_file('${remotePath}')::json WHERE \"workflowId\"=${shQuote(WORKFLOW_ID)} AND \"versionId\"=${shQuote(workflow.activeVersionId)}; COMMIT;`;
    await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${shQuote(sql)}`);
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); stopped = false;
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
module.exports = { patchContext };
