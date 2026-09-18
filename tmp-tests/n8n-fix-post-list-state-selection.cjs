const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = 'post-list-selection-state-contract-v411';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let out = ''; let err = '';
    stream.on('data', (chunk) => { out += chunk; });
    stream.stderr.on('data', (chunk) => { err += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(err || out || `remote ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(
    `docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,
    (error, stream) => {
      if (error) return reject(error);
      let out = ''; let err = '';
      stream.on('data', (chunk) => { out += chunk; });
      stream.stderr.on('data', (chunk) => { err += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(err || out || `psql ${code}`)));
      stream.end(sql);
    },
  ));
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
  const node = nodes.find((item) => item?.name === name);
  assert.ok(node, `${name} not found`);
  return node;
}

const ACTION_ANCHOR = `const aiExplicitListNumber = ['selecionar_item_lista', 'pedir_foto'].includes(aiAction) && aiSelectedNumber > 0
  ? aiSelectedNumber
  : 0;
const aiUsesCurrentSelection = ['informar_cor', 'pedir_foto'].includes(aiAction);`;

const ACTION_PATCH = `// ${MARKER}: keep the classifier and executor action names compatible.
const itemSelectionActionsV411 = new Set(['escolher_item', 'selecionar_item_lista']);
const aiExplicitListNumber = (itemSelectionActionsV411.has(aiAction) || aiAction === 'pedir_foto') && aiSelectedNumber > 0
  ? aiSelectedNumber
  : 0;
const aiUsesCurrentSelection = ['escolher_cor', 'informar_cor', 'pedir_foto'].includes(aiAction);`;

const SUMMARY_ANCHOR = `const selectedOptionSummaryV245 = [
  option?.name || '',
  option?.memory ? '📱 ' + option.memory : '',
  optionColorItems.length ? '🎨 Cores: ' + joinPt(optionColorItems.map((item) => titleCase(item.color)).filter(Boolean)) : '',
  selectedOptionLinkV245 ? '' : null,
  selectedOptionLinkV245 ? 'Veja fotos, vídeos e mais detalhes neste link:' : '',
  selectedOptionLinkV245,
].filter((line) => line !== null && line !== undefined).join(lineBreak);`;

const SUMMARY_PATCH = `const selectedOptionSummaryV245 = [
  (option?.number ? option.number + '. ' : '') + (option?.name || ''),
  option?.memory ? '📱 ' + option.memory : '',
  option?.price ? '💰 ' + option.price + ' à vista no PIX' : '',
  option?.card?.installments && option?.card?.installment && option?.card?.total
    ? '💳 Cartão: ' + option.card.installments + 'x de ' + option.card.installment + ' (total ' + option.card.total + ')'
    : '',
  optionColorItems.length ? '🎨 Cores: ' + joinPt(optionColorItems.map((item) => titleCase(item.color)).filter(Boolean)) : '',
  selectedOptionLinkV245 ? '' : null,
  selectedOptionLinkV245 ? 'Veja fotos, vídeos e mais detalhes neste link:' : '',
  selectedOptionLinkV245,
].filter((line) => line !== null && line !== undefined && line !== '').join(lineBreak);`;

function patchWorkflow(nodes, connections) {
  const patchedNodes = structuredClone(nodes);
  const patchedConnections = structuredClone(connections);
  const postList = nodeByName(patchedNodes, 'Vendas - Verificar Pos Lista');
  let postCode = String(postList.parameters?.jsCode || '');
  if (!postCode.includes(MARKER)) {
    assert.ok(postCode.includes(ACTION_ANCHOR), 'post-list action contract anchor not found');
    assert.ok(postCode.includes(SUMMARY_ANCHOR), 'post-list official summary anchor not found');
    postCode = postCode.replace(ACTION_ANCHOR, ACTION_PATCH).replace(SUMMARY_ANCHOR, SUMMARY_PATCH);
  }
  new AsyncFunction('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', 'fetch', postCode);
  postList.parameters.jsCode = postCode;

  const prepare = nodeByName(patchedNodes, 'Estado Conversa - Preparar');
  let prepareCode = String(prepare.parameters?.jsCode || '');
  if (prepareCode.includes(".replace(/D/g, '')")) prepareCode = prepareCode.replace(".replace(/D/g, '')", ".replace(/\\D/g, '')");
  assert.match(prepareCode, /replace\(\/\\D\/g, ''\)/, 'phone normalization must remove non-digits');
  new Function('$json', '$', '$getWorkflowStaticData', prepareCode);
  prepare.parameters.jsCode = prepareCode;

  let rerouted = 0;
  for (const [sourceName, groups] of Object.entries(patchedConnections)) {
    if (sourceName === 'Estado Conversa - Restaurar') continue;
    for (const outputs of Object.values(groups || {})) {
      for (const targets of outputs || []) {
        for (const target of targets || []) {
          if (target.node === 'Dividir mensagens') {
            target.node = 'Estado Conversa - Preparar';
            rerouted += 1;
          }
        }
      }
    }
  }
  return { nodes: patchedNodes, connections: patchedConnections, rerouted };
}

function incomingTo(connections, nodeName) {
  const incoming = [];
  for (const [sourceName, groups] of Object.entries(connections)) {
    for (const outputs of Object.values(groups || {})) {
      for (const targets of outputs || []) {
        for (const target of targets || []) if (target.node === nodeName) incoming.push(sourceName);
      }
    }
  }
  return incoming;
}

async function runSelfTests(nodes, connections) {
  const code = nodeByName(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const execute = async (source, state) => {
    const staticData = { salesPostList: { [source.remoteJid]: structuredClone(state) } };
    const result = await new AsyncFunction('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', 'fetch', code)(
      {}, { all: () => [] }, () => staticData,
      (name) => ({ first: () => ({ json: name === 'Parse Classificacao' ? source : {} }), all: () => [] }),
      {}, { httpRequest: async () => { throw new Error('unexpected HTTP request'); } },
      async () => { throw new Error('unexpected fetch'); },
    );
    return { output: result[0].json, state: staticData.salesPostList[source.remoteJid] };
  };
  const remoteJid = '557499857292@s.whatsapp.net';
  const state = {
    flow: 'sales_post_list', step: 'awaiting_product_choice', categoryId: '8b7c4852-c195-4527-8fd7-c3cc2debda42',
    createdAt: new Date().toISOString(), expiresAt: Date.now() + 60_000,
    options: [{
      number: 7, name: 'Redmi Note 14S', memory: '12GB/512GB', price: 'R$ 1.639,00',
      card: { installments: 12, installment: 'R$ 152,84', total: 'R$ 1.834,04' },
      url: 'https://mercadodovale.com.br/produto/redmi-note-14s',
      colors: [{ color: 'Preto', productId: 'product-7', sku: 'RN14S512P', stock: 2, url: 'https://mercadodovale.com.br/produto/redmi-note-14s', images: [] }],
    }],
  };
  const selected = await execute({
    remoteJid, phoneDigits: '557499857292', conversation: '7', incomingText: '7',
    salesFlowAction: 'escolher_item', salesFlowItemNumber: 7, salesFlowItemNumbers: [7], salesFlowColor: '', salesFlowQuantity: 0,
  }, state);
  assert.equal(selected.output.salesPostListHandled, true);
  assert.equal(selected.output.salesPostListStep, 'awaiting_fulfillment');
  assert.match(selected.output.output, /7\. Redmi Note 14S/);
  assert.match(selected.output.output, /R\$ 1\.639,00 à vista no PIX/);
  assert.match(selected.output.output, /Cartão: 12x de R\$ 152,84 \(total R\$ 1\.834,04\)/);
  assert.match(selected.output.output, /Cores: Preto/);
  assert.equal(selected.output.orderDraft.productId, 'product-7');

  const staleNumber = await execute({
    remoteJid, phoneDigits: '557499857292', conversation: 'Sim', incomingText: 'Sim',
    salesFlowAction: 'indefinido', salesFlowItemNumber: 7, salesFlowItemNumbers: [7], salesFlowColor: '', salesFlowQuantity: 0,
  }, state);
  assert.equal(staleNumber.output.salesPostListHandled, false);
  assert.equal(staleNumber.output.output, undefined);

  assert.deepEqual(incomingTo(connections, 'Dividir mensagens'), ['Estado Conversa - Restaurar']);
  assert.ok(incomingTo(connections, 'Estado Conversa - Preparar').includes('Vendas - Precisa Handoff?'));
  return { numericSelectionUsesClassifierContract: true, officialCardPreserved: true, staleNumberIgnored: true, statePersistenceCoversEveryReply: true };
}

async function serviceMap(conn) {
  const output = await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we."activeVersionId",'active',we.active,'versionAligned',we."versionId"=we."activeVersionId",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const workflow = JSON.parse(raw.trim());
    const originalNodes = JSON.parse(Buffer.from(workflow.nodesHex, 'hex').toString('utf8'));
    const originalConnections = JSON.parse(Buffer.from(workflow.connectionsHex, 'hex').toString('utf8'));
    const patched = patchWorkflow(originalNodes, originalConnections);
    const changed = JSON.stringify(originalNodes) !== JSON.stringify(patched.nodes) || JSON.stringify(originalConnections) !== JSON.stringify(patched.connections);
    const selfTest = await runSelfTests(patched.nodes, patched.connections);
    if (!APPLY) {
      const services = await serviceMap(conn);
      console.log(JSON.stringify({ apply: false, active: workflow.active, versionAligned: workflow.versionAligned, entityHistoryEqual: workflow.entityHistoryEqual, changed, rerouted: patched.rerouted, selfTest, services }, null, 2));
      return;
    }
    assert.equal(workflow.active, true);
    assert.equal(workflow.versionAligned, true);
    assert.equal(workflow.entityHistoryEqual, true);
    assert.equal(changed, true, 'workflow already patched');
    const activeExecutions = Number((await psql(conn, db, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(activeExecutions, 0, 'workflow has active executions');
    const backupPath = path.join(os.tmpdir(), `n8n-workflow-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: workflow.activeVersionId, nodes: originalNodes, connections: originalConnections }, null, 2), { flag: 'wx' });
    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); stopped = true;
    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(patched.nodes),'nodes')}::json,connections=${dollar(JSON.stringify(patched.connections),'connections')}::json,"versionId"="activeVersionId","updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(patched.nodes),'hnodes')}::json,connections=${dollar(JSON.stringify(patched.connections),'hconnections')}::json,"updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(workflow.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('active',we.active,'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,'markerPresent',we.nodes::text LIKE '%${MARKER}%')::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); stopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({ apply: true, ...verification, rerouted: patched.rerouted, selfTest, backupPath, services }, null, 2));
  } finally {
    if (stopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { MARKER, patchWorkflow, runSelfTests };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
