const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Contexto Produtos';
const MARKER = 'phone-card-verified-features-v418';
const OLD_GUARD = "if (!structuredPhoneComparisonV365 || !isQuoteDeviceProduct(product)) return '';";
const NEW_GUARD = `// ${MARKER}: show verified technical facts in every smartphone catalog card.\n  if (!prefersSmartphones || !isQuoteDeviceProduct(product)) return '';`;
const APPLY = process.argv.includes('--apply');

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) { if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`); return `$${tag}$${value}$${tag}$`; }
function run(conn, command) { return new Promise((resolve, reject) => conn.exec(command, (error, stream) => { if (error) return reject(error); let out = ''; let err = ''; stream.on('data', c => out += c); stream.stderr.on('data', c => err += c); stream.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || out || `remote ${code}`))); })); }
function psql(conn, db, sql) { return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => { if (error) return reject(error); let out = ''; let err = ''; stream.on('data', c => out += c); stream.stderr.on('data', c => err += c); stream.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || out || `psql ${code}`))); stream.end(sql); })); }
async function waitService(conn, service, expected, timeoutMs = 180000) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { const replicas = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim(); if (replicas === `${expected}/${expected}`) return replicas; await new Promise(resolve => setTimeout(resolve, 2500)); } throw new Error(`${service} did not reach ${expected}/${expected}`); }

function patchNodes(original) {
  const nodes = structuredClone(original);
  const node = nodes.find(item => item?.name === NODE_NAME);
  assert.ok(node, `${NODE_NAME} missing`);
  const code = String(node.parameters?.jsCode || '');
  assert.equal(code.split(OLD_GUARD).length - 1, 1, 'expected exactly one legacy guard');
  assert.ok(!code.includes(MARKER), 'already patched');
  node.parameters.jsCode = code.replace(OLD_GUARD, NEW_GUARD);
  new Function(node.parameters.jsCode);
  return nodes;
}

function selfTest(nodes) {
  const code = nodes.find(item => item?.name === NODE_NAME)?.parameters?.jsCode || '';
  const start = code.indexOf('const formatDecimalPtBrV365 =');
  const end = code.indexOf('\nconst buildQuoteMessageForProducts =', start);
  assert.ok(start >= 0 && end > start, 'feature formatter block missing');
  const snippet = code.slice(start, end);
  const render = new Function('prefersSmartphones', 'isQuoteDeviceProduct', 'product', `${snippet}\nreturn buildFeatureSummaryV365(product);`);
  const product = { verifiedSalesFacts: { displayType: 'AMOLED', screenInches: 6.67, batteryMah: 5110, mainCameraMp: 50, charging: '45W turbo (carregador 45W incluído)' } };
  const expected = '✨ Tela AMOLED de 6,67”, bateria de 5.110 mAh, câmera de 50 MP e carregamento de 45 W.';
  assert.equal(render(true, () => true, product), expected, 'Poco M7 card must contain verified features without a technical filter');
  assert.equal(render(true, () => false, product), '', 'accessories must not receive phone facts');
  assert.equal(render(false, () => true, product), '', 'non-smartphone contexts must not receive phone facts');
  assert.equal(render(true, () => true, { verifiedSalesFacts: {} }), '', 'missing verified facts must not be invented');
  assert.ok(code.includes("if (featureSummaryV365) chunkLines.push('   ' + featureSummaryV365);"), 'feature line must remain in official card');
  assert.ok(code.includes('à vista no PIX') && code.includes('Cartão: 12x de ') && code.includes('🎨 Cores: '), 'official price fields must remain');
  return { sampleFeatureLine: expected, deviceOnly: true, unknownFactsOmitted: true, officialCardPreserved: true };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database missing');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we."activeVersionId",'active',we.active,'versionAligned',we."versionId"=we."activeVersionId",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const workflow = JSON.parse(raw.trim());
    const originalNodes = JSON.parse(Buffer.from(workflow.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(workflow.connectionsHex, 'hex').toString('utf8'));
    const patchedNodes = patchNodes(originalNodes);
    const verification = selfTest(patchedNodes);
    const changedNodes = patchedNodes.filter((item, index) => JSON.stringify(item) !== JSON.stringify(originalNodes[index])).map(item => item.name);
    assert.deepEqual(changedNodes, [NODE_NAME]);
    assert.equal(workflow.active, true);
    assert.equal(workflow.versionAligned, true);
    assert.equal(workflow.entityHistoryEqual, true);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, changedNodes, ...verification }, null, 2));

    const activeExecutions = Number((await psql(conn, db, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(activeExecutions, 0, 'workflow currently has active executions');
    const backupPath = path.join(os.tmpdir(), `n8n-workflow-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: workflow.activeVersionId, nodes: originalNodes, connections }, null, 2), { flag: 'wx' });
    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    stopped = true;
    await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(patchedNodes), 'nodes')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)} AND "activeVersionId"=${quote(workflow.activeVersionId)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(patchedNodes), 'hnodes')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(workflow.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('active',we.active,'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,'markerPresent',we.nodes::text LIKE '%${MARKER}%','legacyGuardAbsent',we.nodes::text NOT LIKE '%!structuredPhoneComparisonV365 || !isQuoteDeviceProduct%')::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    assert.equal(result.entityHistoryEqual, true);
    assert.equal(result.markerPresent, true);
    assert.equal(result.legacyGuardAbsent, true);
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    stopped = false;
    const services = (await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'")).trim();
    console.log(JSON.stringify({ apply: true, changedNodes, ...verification, ...result, backupPath, services }, null, 2));
  } finally {
    if (stopped) { await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {}); await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {}); }
    conn.end();
  }
}

module.exports = { patchNodes, selfTest };
if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
