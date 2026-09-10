'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { Client } = require('ssh2');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'multiple-photo-selection-v343';
const LIST_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;
const APPLY = process.argv.includes('--apply-production');

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `${name} must exist`);
  return node;
}

function patchExpiryGuard(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`recover-expired-list-context-${MARKER}`)) return;
  const oldGuard = `if (state && Number(state.expiresAt || 0) <= now) {
  delete staticData.salesPostList[remoteJid];
}`;
  assert.ok(code.includes(oldGuard), `${node.name} expiry guard changed`);
  const newGuard = `// recover-expired-list-context-${MARKER}
const salesListCreatedAtV343 = Date.parse(String(state?.updatedAt || state?.createdAt || ''));
const salesListRecoverableV343 = state?.flow === 'sales_post_list'
  && Number.isFinite(salesListCreatedAtV343)
  && now >= salesListCreatedAtV343
  && now - salesListCreatedAtV343 <= ${LIST_CONTEXT_TTL_MS};
if (state && Number(state.expiresAt || 0) <= now) {
  if (salesListRecoverableV343) state.expiresAt = salesListCreatedAtV343 + ${LIST_CONTEXT_TTL_MS};
  else delete staticData.salesPostList[remoteJid];
}`;
  node.parameters.jsCode = code.replace(oldGuard, newGuard);
}

function patchClassifier(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  if (prompt.includes(`classifier-${MARKER}`)) return;
  const instructionAnchor = '- Se o cliente escolhe numero e cor na mesma mensagem, preencha item_numero e cor.';
  assert.ok(prompt.includes(instructionAnchor), 'Classifier item-number instruction changed');
  prompt = prompt.replace(instructionAnchor, `${instructionAnchor}
- Quando o cliente pedir foto de dois ou mais numeros da lista na mesma mensagem, use acao="pedir_foto", preserve todos em itens_numero na ordem recebida e mantenha item_numero com o primeiro apenas para compatibilidade. Ex.: "fotos dos numeros 15 e 16" => item_numero=15 e itens_numero=[15,16]. // classifier-${MARKER}`);
  const exampleAnchor = '    "item_numero": 22,';
  assert.ok(prompt.includes(exampleAnchor), 'Classifier JSON example changed');
  node.parameters.options.systemMessage = prompt.replace(exampleAnchor, `${exampleAnchor}
    "itens_numero": [22],`);
}

function patchParse(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('salesFlowItemNumbers')) return;
  const outputAnchor = '    salesFlowItemNumber: Number(fluxoVenda.item_numero || 0),';
  assert.ok(code.includes(outputAnchor), 'Parse item-number output changed');
  node.parameters.jsCode = code.replace(outputAnchor, `${outputAnchor}
    // ${MARKER}: preserve every numbered-list choice returned by the classifier.
    salesFlowItemNumbers: [...new Set([
      ...(Array.isArray(fluxoVenda.itens_numero) ? fluxoVenda.itens_numero : []),
      fluxoVenda.item_numero,
    ].map(Number).filter((value) => Number.isInteger(value) && value > 0))],`);
}

function patchCatalogTtl(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`catalog-ttl-${MARKER}`)) return;
  const anchor = `flow: 'sales_post_list',
      step: 'awaiting_product_choice',
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 60 * 60 * 1000,`;
  assert.ok(code.includes(anchor), 'Catalog sales-list TTL block changed');
  node.parameters.jsCode = code.replace(anchor, `flow: 'sales_post_list',
      step: 'awaiting_product_choice',
      createdAt: new Date().toISOString(),
      // catalog-ttl-${MARKER}: customers often answer a numbered list hours later.
      expiresAt: Date.now() + ${LIST_CONTEXT_TTL_MS},`);
}

function patchPostList(node) {
  patchExpiryGuard(node);
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`executor-${MARKER}`)) {
    node.parameters.jsCode = code;
    return;
  }
  const selectedAnchor = `const aiAction = String(source.salesFlowAction || '').trim();
const aiSelectedNumber = Number(source.salesFlowItemNumber || 0);`;
  assert.ok(code.includes(selectedAnchor), 'Post-list AI selection block changed');
  const selectedReplacement = `${selectedAnchor}
// executor-${MARKER}: accept structured arrays and a strict list-syntax fallback.
// The strict fallback intentionally rejects model names such as "Poco 7 Pro".
const rawSelectionTextV343 = String(text || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
const explicitMultipleListSyntaxV343 = /^(?:(?:foto|fotos|imagem|imagens)\\s+(?:do|dos|da|das)\\s+)?(?:(?:numero|numeros|n|item|itens|opcao|opcoes)\\s*)?\\d{1,3}(?:\\s*(?:,|;|\\/|\\+|&|e)\\s*\\d{1,3})+$/i.test(rawSelectionTextV343);
const explicitMultipleNumbersV343 = explicitMultipleListSyntaxV343
  ? (rawSelectionTextV343.match(/\\d{1,3}/g) || []).map(Number)
  : [];
const aiSelectedNumbersV343 = [...new Set([
  ...(Array.isArray(source.salesFlowItemNumbers) ? source.salesFlowItemNumbers : []),
  ...(aiAction === 'pedir_foto' ? explicitMultipleNumbersV343 : []),
  aiSelectedNumber,
].map(Number).filter((value) => Number.isInteger(value) && value > 0))];`;
  code = code.replace(selectedAnchor, selectedReplacement);

  const builderAnchor = 'const buildAllPhotoMessages = (items) => {';
  assert.ok(code.includes(builderAnchor), 'All-photo builder changed');
  code = code.replace(builderAnchor, 'const buildAllPhotoMessages = (items, selectedOption = option, includeGreeting = true) => {');
  const builderStart = code.indexOf('const buildAllPhotoMessages = (items, selectedOption = option, includeGreeting = true) => {');
  const builderEnd = code.indexOf('\n\nif (!variant && (wantsPhoto || wantsPhotoFromAI)) {', builderStart);
  assert.ok(builderStart >= 0 && builderEnd > builderStart, 'All-photo builder boundaries changed');
  let builder = code.slice(builderStart, builderEnd);
  builder = builder
    .replace("const linkText = option.url ? 'Veja mais fotos e as caracteristicas dele: ' + option.url : '';", "const linkText = selectedOption.url ? 'Veja mais fotos e as caracteristicas dele: ' + selectedOption.url : '';")
    .replace("if (greeting) messages.push({ type: 'text', text: greeting, delayMs: 800 });", "if (includeGreeting && greeting) messages.push({ type: 'text', text: greeting, delayMs: 800 });")
    .replace("const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');", "const captionBase = [selectedOption.name, selectedOption.memory, titleCase(item.color)].filter(Boolean).join(' - ');");
  assert.match(builder, /selectedOption\.name/);
  code = code.slice(0, builderStart) + builder + code.slice(builderEnd);

  const multiBranchAnchor = `if (!variant && (wantsPhoto || wantsPhotoFromAI)) {`;
  assert.ok(code.includes(multiBranchAnchor), 'Photo variant branch changed');
  const multiBranch = `// executor-${MARKER}: send every requested model without converting either one into an order draft.
const requestedPhotoNumbersV343 = aiAction === 'pedir_foto' ? aiSelectedNumbersV343 : [];
if ((wantsPhoto || wantsPhotoFromAI) && requestedPhotoNumbersV343.length > 1) {
    const requestedOptionsV343 = requestedPhotoNumbersV343
      .map((number) => activeState.options.find((item) => Number(item.number) === number))
      .filter(Boolean);
    const missingNumbersV343 = requestedPhotoNumbersV343.filter((number) => !requestedOptionsV343.some((item) => Number(item.number) === number));
    if (requestedOptionsV343.length === 0) {
      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,
        output: withGreeting('Nao encontrei esses numeros na lista. Pode escolher opcoes de 1 a ' + activeState.options.length + '? 😊') } }];
    }
    const multiplePhotoMessagesV343 = [];
    requestedOptionsV343.forEach((selectedOptionV343, optionIndexV343) => {
      multiplePhotoMessagesV343.push(...buildAllPhotoMessages(
        uniqueColorItems(selectedOptionV343?.colors || []),
        selectedOptionV343,
        optionIndexV343 === 0,
      ));
    });
    if (missingNumbersV343.length > 0) {
      multiplePhotoMessagesV343.push({ type: 'text', text: 'Nao encontrei na lista: ' + missingNumbersV343.join(', ') + '.' });
    }
    multiplePhotoMessagesV343.push({ type: 'text', text: 'Se quiser continuar com algum deles, me diga o numero e a cor. 😊' });
    multiplePhotoMessagesV343.forEach((message, index) => {
      message.delayMs = index === 0 ? Number(message.delayMs || 800) : 1200 + index * 4500;
    });
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      messages: multiplePhotoMessagesV343,
    } }];
}

${multiBranchAnchor}`;
  code = code.replace(multiBranchAnchor, multiBranch);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  patchClassifier(findNode(nodes, 'Agente Inicial - Classificador'));
  patchParse(findNode(nodes, 'Parse Classificacao'));
  patchExpiryGuard(findNode(nodes, 'Vendas - Preparar Contexto IA'));
  patchCatalogTtl(findNode(nodes, 'Vendas - Contexto Produtos'));
  patchPostList(findNode(nodes, 'Vendas - Verificar Pos Lista'));
  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code' && item.parameters?.jsCode)) {
    assert.doesNotThrow(() => new Function(node.parameters.jsCode), `${node.name} must compile`);
  }
  return nodes;
}

function validateParse(nodes) {
  const code = findNode(nodes, 'Parse Classificacao').parameters.jsCode;
  const raw = JSON.stringify({
    intencao: 'vendas_produtos',
    fluxo_venda: { acao: 'pedir_foto', item_numero: 15, itens_numero: [15, 16] },
  });
  const input = { output: raw, conversation: 'Número 15,16' };
  const result = vm.runInNewContext(`(function(){${code}})()`, {
    $json: input,
    $: () => ({ first: () => ({ json: input }) }),
  });
  return result[0].json;
}

function makeOption(number, name, colors) {
  return {
    number,
    name,
    memory: number === 15 ? '4GB/256GB' : '6GB/128GB',
    url: `https://mercadodovale.com.br/produto/${name.toLowerCase().replace(/\\s+/g, '-')}`,
    colors: colors.map((color, index) => ({
      productId: `product-${number}-${index}`,
      sku: `SKU${number}${index}`,
      color,
      images: [`https://api.xiaomipetrolina.com.br/images/model-color/${number}-${index}.jpg`],
    })),
  };
}

async function validatePostList(nodes, sourceOverrides = {}) {
  const code = findNode(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const remoteJid = '559999999999@s.whatsapp.net';
  const createdAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const state = {
    salesPostList: {
      [remoteJid]: {
        flow: 'sales_post_list', step: 'awaiting_product_choice', createdAt,
        expiresAt: Date.now() - 2 * 60 * 60 * 1000,
        options: [
          makeOption(15, 'Poco C81 Pró', ['Preto', 'Dourado', 'Verde']),
          makeOption(16, 'Poco C85', ['Roxo', 'Preto']),
        ],
      },
    },
  };
  const source = {
    remoteJid,
    conversation: 'Número 15,16',
    salesFlowAction: 'pedir_foto',
    salesFlowItemNumber: 15,
    salesFlowItemNumbers: [15, 16],
    ...sourceOverrides,
  };
  const selectors = {
    'switc Mensagens': { first: () => ({ json: source }) },
    'Vendas - Preparar Contexto IA': { first: () => ({ json: source }) },
  };
  const result = await vm.runInNewContext(`(async function(){${code}})()`, {
    $json: source,
    $input: { all: () => [] },
    $getWorkflowStaticData: () => state,
    $: (name) => selectors[name] || { first: () => ({ json: {} }), all: () => [] },
    helpers: { httpRequest: async () => [] },
    Date,
    Intl,
  });
  return { output: result[0].json, state: state.salesPostList[remoteJid] };
}

async function validateWorkflow(nodes) {
  const parsed = validateParse(nodes);
  assert.deepEqual(Array.from(parsed.salesFlowItemNumbers), [15, 16]);
  const structured = await validatePostList(nodes);
  const structuredImages = structured.output.messages.filter((message) => message.type === 'image');
  assert.equal(structuredImages.length, 5, 'both products and all known colors must produce previews');
  assert.ok(structuredImages.some((message) => /Poco C81 Pró/.test(message.caption)), JSON.stringify(structuredImages));
  assert.ok(structuredImages.some((message) => /Poco C85/.test(message.caption)), JSON.stringify(structuredImages));
  assert.equal(structured.state.step, 'awaiting_product_choice', 'multi-photo preview must not start an order');
  assert.equal(structured.state.orderDraft, undefined, 'multi-photo preview must not choose a product implicitly');
  assert.ok(structured.state.expiresAt > Date.now(), 'three-hour-old list context must be recovered');

  const fallback = await validatePostList(nodes, { salesFlowItemNumbers: undefined });
  assert.equal(fallback.output.messages.filter((message) => message.type === 'image').length, 5, 'strict textual fallback must preserve both choices');

  const modelName = await validatePostList(nodes, {
    conversation: 'tem foto do Poco 7 Pro?', salesFlowItemNumbers: undefined, salesFlowItemNumber: 0,
  });
  assert.ok(!Array.isArray(modelName.output.messages) || modelName.output.messages.length !== 5, 'model number must not be parsed as a multi-list selection');
  return {
    parsedNumbers: Array.from(parsed.salesFlowItemNumbers),
    structuredImageCount: structuredImages.length,
    structuredCaptions: structuredImages.map((message) => message.caption).filter(Boolean),
    recoveredListContext: structured.state.expiresAt > Date.now(),
    orderDraftCreated: Boolean(structured.state.orderDraft),
    fallbackImageCount: fallback.output.messages.filter((message) => message.type === 'image').length,
    modelNameRejectedAsMultiSelection: !Array.isArray(modelName.output.messages) || modelName.output.messages.length !== 5,
  };
}

const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const dollar = (value, tag) => `$${tag}$${value}$${tag}$`;
function runRemote(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(connection, db, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = ''; let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}
async function waitService(connection, service, expected) {
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const replicas = (await runRemote(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n Postgres container must be running');
    const raw = await psql(connection, db, `COPY (SELECT json_build_object(
      'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
      'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
      'activeVersionId', "activeVersionId", 'versionId', "versionId", 'active', active
    )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    assert.equal(entity.versionId, entity.activeVersionId, 'active workflow version must be aligned before patch');
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    const before = JSON.stringify(nodes);
    patchWorkflow(nodes);
    const firstPatch = JSON.stringify(nodes);
    patchWorkflow(nodes);
    assert.equal(JSON.stringify(nodes), firstPatch, 'patch must be idempotent');
    const regression = await validateWorkflow(nodes);
    const summary = { apply: APPLY, changed: before !== firstPatch, active: entity.active, activeVersionId: entity.activeVersionId, regression };
    if (!APPLY) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const activeExecutionsSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`;
    assert.equal(Number((await psql(connection, db, activeExecutionsSql)).trim()), 0, 'workflow has active executions; retry after they finish');
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupDir = `/var/backups/mdv-system/n8n-multiple-photo-selection-${timestamp}`;
    const backupPath = `${backupDir}/workflow.json`;
    await runRemote(connection, `mkdir -p ${shQuote(backupDir)} && chmod 700 ${shQuote(backupDir)}`);
    const backup = await psql(connection, db, `COPY (SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text FROM workflow_entity we LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); });
    }));
    await runRemote(connection, `chmod 600 ${shQuote(backupPath)} && sha256sum ${shQuote(backupPath)} > ${shQuote(`${backupDir}/SHA256SUMS`)}`);

    await runRemote(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 0);
    await runRemote(connection, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(connection, 'n8n_n8n', 0); stopped = true;
    assert.equal(Number((await psql(connection, db, activeExecutionsSql)).trim()), 0, 'workflow received an execution during shutdown');
    const activeVersionAfterStop = (await psql(connection, db, `COPY (SELECT "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`)).trim();
    assert.equal(activeVersionAfterStop, entity.activeVersionId, 'active version changed during preparation');

    await psql(connection, db, `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodesv343')}::json, connections=${dollar(JSON.stringify(connections), 'connectionsv343')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'historynodesv343')}::json, connections=${dollar(JSON.stringify(connections), 'historyconnectionsv343')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COMMIT;`);
    await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(connection, 'n8n_n8n', 1);
    await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 1); stopped = false;

    const verification = JSON.parse((await psql(connection, db, `COPY (SELECT json_build_object(
      'active', we.active,
      'versionAligned', we."versionId"=we."activeVersionId",
      'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
      'markerEntity', we.nodes::text LIKE '%${MARKER}%',
      'markerHistory', wh.nodes::text LIKE '%${MARKER}%',
      'arrayContract', we.nodes::text LIKE '%salesFlowItemNumbers%',
      'catalogTtl24h', we.nodes::text LIKE '%expiresAt: Date.now() + ${LIST_CONTEXT_TTL_MS}%'
    )::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`)).trim());
    assert.ok(Object.values(verification).every(Boolean), 'database verification failed');
    const health = JSON.parse((await runRemote(connection, 'curl -fsS https://n8n.mercadodovale.com.br/healthz')).trim());
    assert.equal(health.status, 'ok');
    console.log(JSON.stringify({ ...summary, backupPath, verification, health }, null, 2));
  } finally {
    if (stopped) {
      await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { patchWorkflow, patchClassifier, patchParse, patchCatalogTtl, patchPostList, validateParse, validatePostList, validateWorkflow, MARKER, LIST_CONTEXT_TTL_MS };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
