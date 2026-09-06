'use strict';

// Local-only transformation. Never connects to production or sends messages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'phone-price-list-cards-v1';
const CHECK = 'Vendas - Lista precisa de cards?';
const GENERATE = 'Vendas - Gerar cards da lista';
const APPEND = 'Vendas - Juntar lista e cards';

function buildGroups(products) {
  return (Array.isArray(products) ? products : []).flatMap(product => {
    const options = Array.isArray(product.memoryOptions) && product.memoryOptions.length
      ? product.memoryOptions : [product];
    return options.map(option => ({
      productIds: [...new Set((option.productIds || [option.id || product.id]).filter(Boolean).map(String))],
      name: String(product.name || ''),
      memory: String(option.memory || product.memory || ''),
      priceCents: Number(option.priceCents),
    }));
  }).filter(group => group.productIds.length && group.name && Number.isSafeInteger(group.priceCents) && group.priceCents > 0);
}

function appendCards(source, response) {
  const unavailable = () => ({ ...source, phonePriceListCardsStatus: 'unavailable' });
  if (response?.ok !== true || !Array.isArray(response.items) || !response.items.length) return unavailable();
  const valid = response.items.every(item => item?.mediaType === 'image'
    && /^https:\/\/api\.xiaomipetrolina\.com\.br\/images\//.test(String(item.mediaUrl || '')));
  if (!valid) return unavailable();
  const textMessages = Array.isArray(source.messages) ? source.messages : String(source.output || '')
    .split(/\[\[MSG\]\]|\|\|\|/).map(text => text.trim()).filter(Boolean).map(text => ({ text }));
  const images = response.items.map((item, index) => ({
    type: 'image', mediaUrl: item.mediaUrl, text: String(item.caption || item.label || ''),
    caption: String(item.caption || item.label || ''),
    mimetype: 'image/png', fileName: `lista-celulares-${index + 1}.png`,
  }));
  return { ...source, messages: [...textMessages, ...images], phonePriceListCardsStatus: 'ready' };
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const get = name => { const node = workflow.nodes.find(n => n.name === name); assert.ok(node, `Missing node: ${name}`); return node; };
  const context = get('Vendas - Contexto Produtos');
  if (context.parameters.jsCode.includes(MARKER)) {
    for (const name of [CHECK, GENERATE, APPEND]) get(name);
    assert.equal(workflow.connections['Vendas - Precisa Handoff?'].main[1][0].node, CHECK);
    return workflow;
  }
  const anchor = '    productsInStock: products,';
  assert.ok(context.parameters.jsCode.includes(anchor), 'Catalog output anchor changed');
  context.parameters.jsCode = context.parameters.jsCode.replace(anchor, anchor + `\n    // ${MARKER}: reuse the exact deterministic catalog selection and cents.\n    phonePriceListGroups: isCompleteCategoryRequest && prefersSmartphones && products.length > 0 ? (${buildGroups.toString()})(products) : [],`);
  const gate = structuredClone(get('Enviar WhatsApp - Tipo imagem?'));
  gate.id = 'phone-price-list-cards-gate-v1'; gate.name = CHECK; gate.position = [1100, 800];
  gate.parameters.conditions.conditions = [{
    id: 'phone-price-list-cards-gate-condition', operator: { type: 'boolean', operation: 'true', singleValue: true },
    leftValue: "={{Array.isArray($('Vendas - Compor Resposta IA').first().json.phonePriceListGroups) && $('Vendas - Compor Resposta IA').first().json.phonePriceListGroups.length > 0}}", rightValue: true,
  }];
  const http = structuredClone(get('Vendas - Persistir Preferencias'));
  http.id = 'phone-price-list-cards-http-v1'; http.name = GENERATE; http.position = [1330, 720];
  http.parameters.url = 'https://api.xiaomipetrolina.com.br/admin/marketing/phone-price-list/preview';
  http.parameters.bodyParameters = { parameters: [{ name: 'groups', value: "={{$('Vendas - Compor Resposta IA').first().json.phonePriceListGroups}}" }] };
  http.parameters.options = { timeout: 120000 };
  // Preview can already take 120s on a cold cache. A retry would hold the text
  // reply for four minutes; let the existing text fallback run immediately.
  http.retryOnFail = false;
  delete http.maxTries; delete http.waitBetweenTries;
  http.onError = 'continueErrorOutput';
  http.notes = 'Gera imagens a partir dos mesmos grupos da lista. Reutiliza autenticação interna existente; falha mantém a resposta textual e fica registrada na execução.';
  const append = {
    id: 'phone-price-list-cards-append-v1', name: APPEND, type: 'n8n-nodes-base.code', typeVersion: 2, position: [1570, 800],
    parameters: { jsCode: `// ${MARKER}: combine API result with deterministic reply; existing sender owns ordering.\nconst source = $('Vendas - Compor Resposta IA').first().json;\nreturn [{json: (${appendCards.toString()})(source, $json)}];` },
  };
  const edge = name => ({ node: name, type: 'main', index: 0 });
  const handoff = workflow.connections['Vendas - Precisa Handoff?'].main;
  assert.deepEqual(handoff[1], [edge('Dividir mensagens')], 'Handoff false branch changed');
  handoff[1] = [edge(CHECK)];
  workflow.nodes.push(gate, http, append);
  workflow.connections[CHECK] = { main: [[edge(GENERATE)], [edge('Dividir mensagens')]] };
  workflow.connections[GENERATE] = { main: [[edge(APPEND)], [edge(APPEND)]] };
  workflow.connections[APPEND] = { main: [[edge('Dividir mensagens')]] };
  new Function('$json', '$input', '$getWorkflowStaticData', '$', context.parameters.jsCode);
  new Function('$json', '$', append.parameters.jsCode);
  return workflow;
}

function shellQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function sshRun(connection, command) { return new Promise((resolve, reject) => connection.exec(command, (error, stream) => { if (error) return reject(error); let output=''; let stderr=''; stream.on('data', chunk => output += chunk); stream.stderr.on('data', chunk => stderr += chunk); stream.on('close', code => code === 0 ? resolve(output) : reject(new Error(stderr || output || `exit ${code}`))); })); }
function sshPut(connection, remotePath, value) { return new Promise((resolve, reject) => connection.sftp((error, sftp) => { if (error) return reject(error); sftp.writeFile(remotePath, Buffer.from(value), writeError => { sftp.end(); writeError ? reject(writeError) : resolve(); }); })); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitService(connection, name, desired) { for (let attempt=0; attempt<72; attempt+=1) { const state=(await sshRun(connection, `docker service ls --filter name=${shellQuote(name)} --format '{{.Replicas}}' | head -n 1`)).trim(); if (state === `${desired}/${desired}`) return; await wait(2500); } throw new Error(`Timeout aguardando ${name}=${desired}`); }

async function applyProduction() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
  const { Client } = require('ssh2');
  const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  const remoteFile = '/tmp/mdv-phone-price-list-workflow.json';
  try {
    const db = (await sshRun(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('Container Postgres do n8n não encontrado');
    const query = `COPY (SELECT encode(convert_to(json_build_object('id',id,'nodes',nodes::jsonb,'connections',connections::jsonb,'activeVersionId',\"activeVersionId\")::text,'UTF8'),'hex') FROM workflow_entity WHERE id='SkrkB4vyKVDnQ68t') TO STDOUT;`;
    const encoded = (await sshRun(connection, `docker exec ${shellQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shellQuote(query)}`)).trim();
    if (!encoded) throw new Error('Workflow ativo não encontrado');
    const current = JSON.parse(Buffer.from(encoded, 'hex').toString('utf8'));
    const before = { nodes: current.nodes, connections: current.connections };
    const after = patchWorkflow(before);
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    if (!changed) return { applied: false, alreadyCurrent: true, workflowId: current.id, activeVersionId: current.activeVersionId };
    await sshPut(connection, remoteFile, JSON.stringify(after));
    await sshRun(connection, `docker cp ${remoteFile} ${shellQuote(db)}:${remoteFile}`);
    await sshRun(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 0);
    await sshRun(connection, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(connection, 'n8n_n8n', 0); stopped = true;
    const sql = `BEGIN; UPDATE workflow_entity SET nodes=(pg_read_file('${remoteFile}')::json->'nodes'), connections=(pg_read_file('${remoteFile}')::json->'connections'), \"updatedAt\"=NOW() WHERE id='${current.id}'; UPDATE workflow_history SET nodes=(pg_read_file('${remoteFile}')::json->'nodes'), connections=(pg_read_file('${remoteFile}')::json->'connections'), \"updatedAt\"=NOW() WHERE \"workflowId\"='${current.id}' AND \"versionId\"='${current.activeVersionId}'; COMMIT;`;
    await sshRun(connection, `docker exec ${shellQuote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${shellQuote(sql)}`);
    await sshRun(connection, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(connection, 'n8n_n8n', 1);
    await sshRun(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 1); stopped = false;
    const verifyQuery = `SELECT ((nodes::text LIKE '%phone-price-list-cards-v1%') AND (connections::text LIKE '%Vendas - Gerar cards da lista%')) FROM workflow_entity WHERE id='${current.id}';`;
    const verified = (await sshRun(connection, `docker exec ${shellQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shellQuote(verifyQuery)}`)).trim() === 't';
    if (!verified) throw new Error('Verificação do workflow publicado falhou');
    return { applied: true, verified, workflowId: current.id, activeVersionId: current.activeVersionId };
  } finally {
    if (stopped) {
      await sshRun(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(()=>{}); await waitService(connection, 'n8n_n8n', 1).catch(()=>{});
      await sshRun(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(()=>{}); await waitService(connection, 'n8n_n8n-runner', 1).catch(()=>{});
    }
    await sshRun(connection, `rm -f ${remoteFile}`).catch(()=>{}); connection.end();
  }
}

if (require.main === module && process.argv.includes('--apply-production')) {
  applyProduction().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.stack || error.message); process.exitCode=1; });
} else if (require.main === module) {
  const [source, target] = process.argv.slice(2);
  assert.ok(source && target && source !== target, 'Usage: node n8n-add-phone-price-list-cards.cjs input.json output.json (local only)');
  const before = JSON.parse(fs.readFileSync(source, 'utf8'));
  const after = patchWorkflow(before);
  fs.writeFileSync(target, JSON.stringify(after, null, 2));
  console.log(JSON.stringify({ localOnly: true, nodesAdded: after.nodes.length - before.nodes.length, target }));
}
module.exports = { buildGroups, appendCards, patchWorkflow, applyProduction, CHECK, GENERATE, APPEND };
