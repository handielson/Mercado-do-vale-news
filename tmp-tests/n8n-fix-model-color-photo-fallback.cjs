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
const POST_LIST_NODE_NAME = 'Vendas - Verificar Pos Lista';
const MARKER = 'catalog-model-color-photo-fallback-v283';
const POST_LIST_MARKER = 'photo-interrupt-refresh-v284';
const APPLY = process.argv.includes('--apply');
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}

async function waitService(conn, service, replicas) {
  const expected = `${replicas}/${replicas}`;
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const current = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (current === expected) return;
    await sleep(2500);
  }
  throw new Error(`${service} did not reach ${expected}`);
}

function patchContext(code) {
  if (code.includes(MARKER)) return code;
  const anchors = [
    `images: Array.isArray(product.images) ? product.images.filter((image) => typeof image === 'string' && image.includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [],`,
    `images: Array.isArray(product.images) ? product.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [],`,
  ];
  const anchor = anchors.find((candidate) => code.includes(candidate));
  if (!anchor) {
    const nearby = code.split(/\r?\n/)
      .filter((line) => line.includes('product.images') || line.includes('images:'))
      .slice(0, 20)
      .join('\n');
    throw new Error(`product image mapping anchor changed unexpectedly\n${nearby}`);
  }
  const replacement = `// ${MARKER}\n      images: [...new Set([product.images, product.resolved_images, product.model_color_images]\n        .flatMap((value) => Array.isArray(value) ? value : [])\n        .map((url) => String(url || '').trim())\n        .filter((url) => url.startsWith('https://api.xiaomipetrolina.com.br/images/')))]\n        .slice(0, 3),`;
  const next = code.replace(anchor, replacement);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', next);
  return next;
}

function patchPostList(code) {
  if (code.includes(POST_LIST_MARKER)) return code;

  const fulfillmentAnchor = `// default-one-unit-v245
if (activeState?.step === 'awaiting_fulfillment') {`;
  assert.ok(code.includes(fulfillmentAnchor), 'awaiting_fulfillment anchor changed unexpectedly');
  const photoInterrupt = `// ${POST_LIST_MARKER}
if ((wantsPhoto || wantsPhotoFromAI) && hasOrderDraft) {
  const draft = activeState.orderDraft || {};
  const photoOptions = Array.isArray(activeState.options) ? activeState.options : [];
  const optionByNumber = photoOptions.find((item) => Number(item.number) === Number(aiSelectedNumber || activeState.selectedOptionNumber || 0));
  const optionByProduct = photoOptions.find((item) => uniqueColorItems(item?.colors || []).some((variant) => String(variant?.productId || '') === String(draft.productId || '')));
  const photoOption = optionByNumber || optionByProduct;
  const photoVariants = uniqueColorItems(photoOption?.colors || []);
  const photoVariant = photoVariants.find((item) => String(item?.productId || '') === String(draft.productId || ''))
    || photoVariants.find((item) => normalize(item?.color) === normalize(draft.color))
    || (photoVariants.length === 1 ? photoVariants[0] : null);
  if (photoOption && photoVariant) {
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        salesPostListStep: activeState.step,
        orderDraft: activeState.orderDraft,
        messages: await buildPhotoMessages(photoVariant, photoOption),
      },
    }];
  }
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      messages: [{ type: 'text', text: withGreeting('Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo e a cor.') }],
    },
  }];
}

${fulfillmentAnchor}`;
  let next = code.replace(fulfillmentAnchor, photoInterrupt);

  const oldBuilder = `const buildPhotoMessages = (item) => {
  const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [];
  const productUrl = item.url || option.url || '';
  const linkText = productUrl ? 'No link tem mais fotos, video e as caracteristicas dele: ' + productUrl : '';
  if (images.length === 0) {
    return [
      { type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.')) },
    ];
  }
  const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');`;
  assert.ok(next.includes(oldBuilder), 'buildPhotoMessages anchor changed unexpectedly');
  const newBuilder = `async function hydratePhotoItem(item) {
  const currentImages = Array.isArray(item?.images)
    ? item.images.filter((url) => String(url || '').startsWith('https://api.xiaomipetrolina.com.br/images/')).slice(0, 3)
    : [];
  if (currentImages.length > 0) return { ...item, images: currentImages };
  const sku = String(item?.sku || '').trim();
  if (!sku) return { ...item, images: [] };
  try {
    const response = await fetch('https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(sku), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ...item, images: [] };
    const payload = await response.json();
    const products = Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : []);
    const requestedProductId = String(item?.productId || '').trim();
    const product = requestedProductId
      ? products.find((candidate) => String(candidate?.id || '') === requestedProductId)
      : products[0];
    if (!product) return { ...item, images: [] };
    const resolvedImages = [...new Set([product?.images, product?.resolved_images, product?.model_color_images]
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map((url) => String(url || '').trim())
      .filter((url) => url.startsWith('https://api.xiaomipetrolina.com.br/images/')))]
      .slice(0, 3);
    if (resolvedImages.length > 0) item.images = resolvedImages;
    return { ...item, images: resolvedImages };
  } catch (error) {
    return { ...item, images: [] };
  }
}

async function buildPhotoMessages(item, selectedOption) {
  const hydratedItem = await hydratePhotoItem(item);
  const images = hydratedItem.images;
  const productUrl = hydratedItem.url || selectedOption.url || '';
  const linkText = productUrl ? 'No link tem mais fotos, video e as caracteristicas dele: ' + productUrl : '';
  if (images.length === 0) {
    return [
      { type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.')) },
    ];
  }
  const captionBase = [selectedOption.name, selectedOption.memory, titleCase(hydratedItem.color)].filter(Boolean).join(' - ');`;
  next = next.replace(oldBuilder, newBuilder);
  const oldFileName = `fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',`;
  assert.ok(next.includes(oldFileName), 'photo filename anchor changed unexpectedly');
  next = next.replace(oldFileName, `fileName: 'produto-' + normalize(hydratedItem.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',`);

  const oldCall = `messages: buildPhotoMessages(variant),`;
  assert.ok(next.includes(oldCall), 'buildPhotoMessages call anchor changed unexpectedly');
  next = next.replace(oldCall, `messages: await buildPhotoMessages(variant, option),`);
  assert.equal((next.match(/(?<!await )buildPhotoMessages\(/g) || []).length, 1, 'all buildPhotoMessages calls must be awaited');
  new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'fetch', 'AbortSignal', next);
  return next;
}

function summarize(nodes) {
  const node = nodes.find((item) => item.name === NODE_NAME);
  assert.ok(node, `${NODE_NAME} not found`);
  const code = String(node.parameters?.jsCode || '');
  const postList = nodes.find((item) => item.name === POST_LIST_NODE_NAME);
  assert.ok(postList, `${POST_LIST_NODE_NAME} not found`);
  const postListCode = String(postList.parameters?.jsCode || '');
  return {
    marker: code.includes(MARKER),
    readsResolvedImages: code.includes('product.resolved_images'),
    readsModelColorImages: code.includes('product.model_color_images'),
    imageLimit: code.includes('.slice(0, 3)'),
    postListMarker: postListCode.includes(POST_LIST_MARKER),
    photoBeforeFulfillment: postListCode.indexOf(POST_LIST_MARKER) < postListCode.indexOf("activeState?.step === 'awaiting_fulfillment'"),
    refreshesStaleImages: postListCode.includes("compact=true&limit=1&sku=") && postListCode.includes('product?.resolved_images'),
    awaitsPhotoMessages: postListCode.includes('messages: await buildPhotoMessages'),
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container not found');
    const readSql = `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const row = JSON.parse((await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(readSql)}`)).trim());
    const nodes = JSON.parse(Buffer.from(row.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(row.connectionsHex, 'hex').toString('utf8'));
    const context = nodes.find((item) => item.name === NODE_NAME);
    assert.ok(context, `${NODE_NAME} not found`);
    context.parameters.jsCode = patchContext(String(context.parameters?.jsCode || ''));
    const postList = nodes.find((item) => item.name === POST_LIST_NODE_NAME);
    assert.ok(postList, `${POST_LIST_NODE_NAME} not found`);
    postList.parameters.jsCode = patchPostList(String(postList.parameters?.jsCode || ''));
    const summary = summarize(nodes);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    const activeExecutionsSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new', 'running')) TO STDOUT;`;
    const activeExecutions = Number((await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(activeExecutionsSql)}`)).trim());
    assert.equal(activeExecutions, 0, 'workflow has an active execution; refusing to update it');

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupDir = `/var/backups/mdv-system/n8n-workflow-photo-interrupt-${timestamp}`;
    await run(conn, `mkdir -p ${quote(backupDir)} && chmod 700 ${quote(backupDir)}`);
    const backupSql = `COPY (SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text FROM workflow_entity we LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(backupSql)} > ${quote(`${backupDir}/workflow.json`)} && chmod 600 ${quote(`${backupDir}/workflow.json`)} && sha256sum ${quote(`${backupDir}/workflow.json`)} > ${quote(`${backupDir}/SHA256SUMS`)}`);

    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    stopped = true;
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);

    const remotePath = '/tmp/mdv-n8n-photo-interrupt-v284.json';
    await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(remotePath, Buffer.from(JSON.stringify(nodes)), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));
    await run(conn, `docker cp ${quote(remotePath)} ${quote(db)}:${quote(remotePath)}`);
    const updateSql = `BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('${remotePath}')::json, connections=${quote(JSON.stringify(connections))}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)}; UPDATE workflow_history SET nodes=pg_read_file('${remotePath}')::json, connections=${quote(JSON.stringify(connections))}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(row.activeVersionId)}; COMMIT;`;
    await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${quote(updateSql)}`);

    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    stopped = false;

    const verifySql = `COPY (SELECT json_build_object('entityMarker', we.nodes::text LIKE '%${MARKER}%', 'historyMarker', wh.nodes::text LIKE '%${MARKER}%', 'postListEntityMarker', we.nodes::text LIKE '%${POST_LIST_MARKER}%', 'postListHistoryMarker', wh.nodes::text LIKE '%${POST_LIST_MARKER}%', 'sameNodes', we.nodes::jsonb = wh.nodes::jsonb, 'active', we.active)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const database = JSON.parse((await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(verifySql)}`)).trim());
    console.log(JSON.stringify({ apply: true, backupDir, database, ...summary }, null, 2));
  } finally {
    if (stopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { patchContext, patchPostList, summarize, MARKER, POST_LIST_MARKER };
