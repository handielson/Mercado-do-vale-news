const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = 'generic-purchase-handoff-guard-v1';
const PURCHASE_NODE = 'Vendas - Esclarecer Tipo Compra';
const AFFECTED_JID = '557488488409@s.whatsapp.net';

const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote failed: ${code}`)));
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
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}
function patchClassifierPrompt(prompt) {
  let next = String(prompt || '');
  if (!next.includes(MARKER)) {
    next += `\n${MARKER}: Nunca classifique como pedido_humano apenas porque o cliente quer comprar, fazer uma compra, saber opcoes ou iniciar atendimento. pedido_humano exige pedido explicito para falar com atendente, vendedor, humano ou pessoa. Quando a compra for generica e sem produto/categoria, use compra_generica.`;
  }
  return next;
}
function patchParseCode(code) {
  let next = String(code || '');
  if (next.includes(MARKER)) return next;
  const intentStart = next.indexOf('const intencao =');
  const vendaStart = next.indexOf('\nconst venda =', intentStart);
  assert.ok(intentStart >= 0 && vendaStart > intentStart, 'Parse Classificacao anchors not found');
  next = `${next.slice(0, intentStart)}let intencao =${next.slice(intentStart + 'const intencao ='.length)}`;
  const guard = `
// ${MARKER}: LLM output cannot create a human handoff without explicit customer intent.
const normalizedGenericPurchaseV1 = String(source.conversation || '')
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
const explicitHumanRequestV1 = /\\b(atendente|atendimento humano|vendedor|vendedora|humano|pessoa real|falar com (alguem|uma pessoa|atendente|vendedor)|quero falar com)\\b/.test(normalizedGenericPurchaseV1);
const genericPurchaseV1 = /\\b(gostaria|quero|preciso|vim|venho|pretendo)?\\s*(?:de\\s+)?(?:fazer\\s+)?(?:uma\\s+)?compra\\b|\\bquero comprar\\b/.test(normalizedGenericPurchaseV1);
const specificProductV1 = /\\b(celular|smartphone|iphone|samsung|xiaomi|redmi|poco|realme|motorola|tablet|notebook|fone|capinha|capa|carregador|produto)\\b/.test(normalizedGenericPurchaseV1);
const genericPurchaseInquiryV1 = genericPurchaseV1 && !specificProductV1 && !explicitHumanRequestV1;
if (intencao === 'pedido_humano' && !explicitHumanRequestV1) intencao = genericPurchaseInquiryV1 ? 'compra_generica' : 'fallback';
if (genericPurchaseInquiryV1) intencao = 'compra_generica';
`;
  const guardInsert = next.indexOf('\nconst venda =', intentStart);
  next = `${next.slice(0, guardInsert)}${guard}${next.slice(guardInsert)}`;
  const returnMatch = next.match(/(\s*)intencao,\r?\n/);
  assert.ok(returnMatch, `Parse Classificacao return anchor not found near: ${next.slice(-1000)}`);
  next = next.replace(returnMatch[0], `${returnMatch[1]}intencao,\n${returnMatch[1]}genericPurchaseInquiry: genericPurchaseInquiryV1,\n`);
  new Function('$json', '$', next);
  return next;
}
function ensurePurchaseRoute(nodes, connections) {
  upsertNode(nodes, {
    id: 'sales-generic-purchase-question-v1', name: PURCHASE_NODE,
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [2080, 470],
    parameters: { jsCode: `const source = $json;\nreturn [{ json: { ...source, output: 'Claro 😊 Você quer ver a lista de celulares disponíveis ou está procurando algum produto específico?' } }];` },
  });
  const switchNode = nodes.find((node) => node.name === 'Switch Especialistas');
  assert.ok(switchNode, 'Switch Especialistas not found');
  const rules = switchNode.parameters?.rules?.values;
  assert.ok(Array.isArray(rules), 'Switch Especialistas rules not found');
  if (!rules.some((rule) => rule.outputKey === 'compra_generica')) {
    const fallbackIndex = rules.findIndex((rule) => rule.outputKey === 'fallback');
    const rule = {
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, combinator: 'and', conditions: [{ id: 'intent-compra-generica-v1', operator: { type: 'string', operation: 'equals' }, leftValue: '={{$json.intencao}}', rightValue: 'compra_generica' }] },
      renameOutput: true, outputKey: 'compra_generica',
    };
    if (fallbackIndex >= 0) rules.splice(fallbackIndex, 0, rule); else rules.push(rule);
  }
  const index = rules.findIndex((rule) => rule.outputKey === 'compra_generica');
  const main = connections['Switch Especialistas']?.main || [];
  while (main.length < rules.length) main.push([{ node: 'Agente Geral - Atendimento', type: 'main', index: 0 }]);
  main[index] = [{ node: PURCHASE_NODE, type: 'main', index: 0 }];
  connections['Switch Especialistas'] = { main };
  connections[PURCHASE_NODE] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
}
function patchWorkflow(workflow) {
  const classifier = workflow.nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = workflow.nodes.find((node) => node.name === 'Parse Classificacao');
  assert.ok(classifier?.parameters?.options?.systemMessage, 'Agente Inicial - Classificador not found');
  assert.ok(parse?.parameters?.jsCode, 'Parse Classificacao not found');
  classifier.parameters.options.systemMessage = patchClassifierPrompt(classifier.parameters.options.systemMessage);
  parse.parameters.jsCode = patchParseCode(parse.parameters.jsCode);
  ensurePurchaseRoute(workflow.nodes, workflow.connections);
  return workflow;
}
async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n Postgres container not found');
    const raw = JSON.parse((await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`)).trim());
    const workflow = patchWorkflow({ nodes: JSON.parse(Buffer.from(raw.nodesHex, 'hex').toString('utf8')), connections: JSON.parse(Buffer.from(raw.connectionsHex, 'hex').toString('utf8')) });
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, marker: MARKER, purchaseNode: Boolean(workflow.nodes.find((node) => node.name === PURCHASE_NODE)), purchaseRoute: Boolean(workflow.connections[PURCHASE_NODE]) }, null, 2));
      return;
    }
    const active = Number((await psql(conn, db, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backup = await psql(conn, db, `COPY (SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text FROM workflow_entity we LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => { if (error) return reject(error); sftp.writeFile(backupPath, Buffer.from(backup), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); }); }));
    await run(conn, `chmod 600 ${quote(backupPath)} && sha256sum ${quote(backupPath)} > ${quote(`${backupPath}.sha256`)}`);
    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); stopped = true;
    const nodesPath = `/tmp/${WORKFLOW_ID}-${MARKER}-nodes.json`; const connectionsPath = `/tmp/${WORKFLOW_ID}-${MARKER}-connections.json`;
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => { if (error) return reject(error); sftp.writeFile(nodesPath, Buffer.from(JSON.stringify(workflow.nodes)), (nodesError) => { if (nodesError) { sftp.end(); return reject(nodesError); } sftp.writeFile(connectionsPath, Buffer.from(JSON.stringify(workflow.connections)), (connectionsError) => { sftp.end(); connectionsError ? reject(connectionsError) : resolve(); }); }); }));
    await run(conn, `docker cp ${quote(nodesPath)} ${quote(db)}:${quote(nodesPath)} && docker cp ${quote(connectionsPath)} ${quote(db)}:${quote(connectionsPath)}`);
    try {
      await psql(conn, db, `BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('${nodesPath}')::json, connections=pg_read_file('${connectionsPath}')::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)}; UPDATE workflow_history SET nodes=pg_read_file('${nodesPath}')::json, connections=pg_read_file('${connectionsPath}')::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(raw.activeVersionId)}; COMMIT;`);
    } finally { await run(conn, `rm -f ${quote(nodesPath)} ${quote(connectionsPath)}`).catch(() => {}); await run(conn, `docker exec ${quote(db)} rm -f ${quote(nodesPath)} ${quote(connectionsPath)}`).catch(() => {}); }
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); stopped = false;
    const verification = JSON.parse((await psql(conn, db, `COPY (SELECT json_build_object('entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb, 'marker', we.nodes::text LIKE '%${MARKER}%', 'purchaseNode', EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(PURCHASE_NODE)}), 'purchaseRoute', we.connections::text LIKE '%${PURCHASE_NODE}%')::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`)).trim());
    assert.deepEqual(verification, { entityHistoryEqual: true, marker: true, purchaseNode: true, purchaseRoute: true });
    console.log(JSON.stringify({ apply: true, backupPath, ...verification }, null, 2));
  } finally {
    if (stopped) { await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {}); await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {}); }
    conn.end();
  }
}
module.exports = { MARKER, PURCHASE_NODE, patchClassifierPrompt, patchParseCode, ensurePurchaseRoute, patchWorkflow };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
