const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');

for (const envRoot of [path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..', '..')]) {
  try { require('dotenv').config({ path: path.join(envRoot, '.env.vps.local') }); } catch {}
  try { require('dotenv').config({ path: path.join(envRoot, '.env.local') }); } catch {}
}

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Resolver Acao de Conversacao';
const MARKER = 'installment-maximum-routing-v1';
const APPLY = process.argv.includes('--apply');
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const dollar = (value, tag) => `$${tag}$${String(value)}$${tag}$`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote ${code}`)));
  }));
}

function psql(connection, database, sql) {
  return new Promise((resolve, reject) => connection.exec(
    `docker exec -i ${quote(database)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,
    (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql ${code}`)));
      stream.end(sql);
    },
  ));
}

async function waitService(connection, service, expected) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const replicas = (await run(connection, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function replaceOnce(text, search, replacement, label) {
  const matches = String(text).split(search).length - 1;
  assert.equal(matches, 1, `${label} anchor must occur exactly once`);
  return String(text).replace(search, replacement);
}

function patchResolver(code) {
  let next = String(code || '');
  if (next.includes(MARKER)) return next;
  const decisionAnchor = "const decision = birthdayCorrectionV372 || deterministicPayjoyV1 || contextualMediaDecisionV287 ||";
  const guard = `// ${MARKER}\nconst installmentMaximumTextV1 = normalize(text);\nconst installmentMaximumQuestionV1 = /\\b(?:ate\\s+)?quantas?\\s+(?:vezes|parcelas)\\b/.test(installmentMaximumTextV1)\n  && /\\b(?:cartao|credito|parcela|parcelamento|divide|dividem|dividir|parcelam|parcelar)\\b/.test(installmentMaximumTextV1);\nconst deterministicInstallmentMaximumV1 = installmentMaximumQuestionV1\n  ? { acao: 'responder_politica_pagamento', intencao: 'pagamento', confianca: 1, motivo: 'Pergunta deterministica sobre o limite de parcelas no cartao.' }\n  : null;\n`;
  next = replaceOnce(next, decisionAnchor, `${guard}${decisionAnchor.replace('deterministicPayjoyV1 ||', 'deterministicPayjoyV1 || deterministicInstallmentMaximumV1 ||')}`, 'resolver decision');
  new Function('$json', '$', '$getWorkflowStaticData', next);
  return next;
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = workflow.nodes.find((item) => item.name === NODE_NAME);
  assert.ok(node?.parameters?.jsCode, `${NODE_NAME} not found`);
  node.parameters.jsCode = patchResolver(node.parameters.jsCode);
  return workflow;
}

function runResolver(code, conversation) {
  const remoteJid = '558788242329@s.whatsapp.net';
  const source = {
    remoteJid,
    conversation,
    recentMessages: [
      { direction: 'outbound', text: 'Poco X8 Pró 5G - 8GB/256GB - R$ 2.660,00' },
    ],
  };
  const classifier = {
    remoteJid,
    conversation,
    output: JSON.stringify({
      acao: 'listar_catalogo',
      intencao: 'catalogo',
      produto_busca: 'smartphones',
      confianca: 0.7,
      motivo: 'Resposta incorreta reproduzida do incidente.',
    }),
    intencao: 'vendas_produtos',
    salesRequestKind: 'categoria',
    salesCategoryName: 'smartphones',
  };
  const staticData = {
    salesPostList: {
      [remoteJid]: {
        flow: 'sales_post_list',
        step: 'awaiting_product_choice',
        expiresAt: Date.now() + 60_000,
        options: [{ number: 1, name: 'Poco X8 Pró 5G', memory: '8GB/256GB', price: 'R$ 2.660,00' }],
      },
    },
  };
  return new Function('$json', '$', '$getWorkflowStaticData', code)(
    classifier,
    () => ({ first: () => ({ json: source }) }),
    () => staticData,
  )[0].json;
}

function validate(workflow) {
  const node = workflow.nodes.find((item) => item.name === NODE_NAME);
  const code = String(node?.parameters?.jsCode || '');
  const paymentCode = String(workflow.nodes.find((item) => item.name === 'Pagamento - Politica')?.parameters?.jsCode || '');
  assert.match(code, new RegExp(MARKER));
  assert.match(paymentCode, /dividimos em até 12x/i);
  assert.match(paymentCode, /tabela da maquininha/i);
  for (const question of [
    'Gostaria de saber também em até quantas vezes você divide no cartão de crédito',
    'Até quantas parcelas vocês fazem no cartão?',
    'Em quantas vezes dividem no crédito?',
  ]) {
    const result = runResolver(code, question);
    assert.equal(result.conversationAction, 'responder_politica_pagamento', question);
    assert.equal(result.conversationIntent, 'pagamento', question);
    assert.equal(result.paymentQuestion, true, question);
  }
  const product = runResolver(code, 'Quero ver os modelos Poco X8 Pro');
  assert.equal(product.conversationAction, 'listar_catalogo');
  return { maximumInstallmentsRoute: 'responder_politica_pagamento', maximumInstallments: 12, machineFeesDisclosed: true, preservesProductRequests: true };
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const database = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(database, 'n8n database not found');
    const raw = await psql(connection, database, `COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we.\"activeVersionId\",'active',we.active,'versionAligned',we.\"versionId\"=we.\"activeVersionId\",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const row = JSON.parse(raw.trim());
    const workflow = {
      nodes: JSON.parse(Buffer.from(row.nodesHex, 'hex').toString('utf8')),
      connections: JSON.parse(Buffer.from(row.connectionsHex, 'hex').toString('utf8')),
    };
    const updated = patchWorkflow(workflow);
    const validation = validate(updated);
    assert.deepEqual(patchWorkflow(updated).nodes, updated.nodes, 'patch must be idempotent');
    const changed = JSON.stringify(updated.nodes) !== JSON.stringify(workflow.nodes);
    const summary = { apply: APPLY, active: row.active, versionAligned: row.versionAligned, entityHistoryEqual: row.entityHistoryEqual, changed, validation };
    if (!APPLY) return console.log(JSON.stringify(summary, null, 2));

    assert.equal(row.active, true);
    assert.equal(row.versionAligned, true);
    assert.equal(row.entityHistoryEqual, true);
    assert.equal(changed, true, 'workflow already routes maximum-installment questions deterministically');
    const active = Number((await psql(connection, database, `COPY (SELECT count(*) FROM execution_entity WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = path.join(os.tmpdir(), `n8n-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: row.activeVersionId, ...workflow }, null, 2), { flag: 'wx' });

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    stopped = true;
    const sql = `BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(updated.nodes), 'nodesinstallmentmax')}::json,\"versionId\"=\"activeVersionId\",\"updatedAt\"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(updated.nodes), 'historyinstallmentmax')}::json,\"updatedAt\"=NOW() WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND \"versionId\"=${quote(row.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb,'installmentMaximumRouting',EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(NODE_NAME)} AND node->'parameters'->>'jsCode' LIKE '%${MARKER}%'))::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, database, sql)).trim());
    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    stopped = false;
    console.log(JSON.stringify({ ...summary, ...verification, backupPath }, null, 2));
  } finally {
    if (stopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchResolver, patchWorkflow, validate };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
