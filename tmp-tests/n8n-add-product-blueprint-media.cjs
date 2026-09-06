const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const MARKER = 'blueprint-product-media-v309';
const STATE_MARKER = 'blueprint-state-caption-v320';
const SPECIFIC_MODEL_MARKER = 'specific-model-blueprint-v336';
const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const DRY_RUN = process.argv.includes('--dry-run');
const MEDIA_PREFIXES = [
  'https://api.xiaomipetrolina.com.br/images/',
  'https://imagens.xiaomipetrolina.com.br/',
];

function isAllowedMediaUrl(value) {
  const url = String(value || '').trim();
  return MEDIA_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => (
      code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
    ));
  }));
}

function psql(conn, db, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.end(sql);
    });
  });
}

async function waitService(conn, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = String(await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function normalizeBlueprintUrl(value) {
  const url = String(value || '').trim();
  return isAllowedMediaUrl(url) ? url : '';
}

function imageMediaMetadata(url, fallbackBase = 'produto', index = 0) {
  const cleanUrl = String(url || '').split(/[?#]/, 1)[0].toLowerCase();
  const extension = cleanUrl.endsWith('.png')
    ? 'png'
    : (cleanUrl.endsWith('.webp') ? 'webp' : (cleanUrl.endsWith('.gif') ? 'gif' : 'jpg'));
  const mimetype = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
  return {
    mimetype,
    fileName: `${fallbackBase}-${index + 1}.${extension}`,
  };
}

function selectBlueprintMedia({ blueprintImageUrl, images, blueprintOnly = false }) {
  const blueprint = normalizeBlueprintUrl(blueprintImageUrl);
  const realImages = [...new Set((Array.isArray(images) ? images : [])
    .map((url) => String(url || '').trim())
    .filter((url) => isAllowedMediaUrl(url) && url !== blueprint))];

  // A ficha explicita envia apenas o blueprint quando ele existe. Sem blueprint,
  // preserva o fallback historico da galeria para nao deixar o cliente sem midia.
  if (blueprintOnly && blueprint) return [blueprint];
  if (blueprint) return [blueprint, ...realImages.slice(0, 1)];
  return realImages.slice(0, 3);
}

function findNode(nodes, name) {
  const node = (Array.isArray(nodes) ? nodes : []).find((item) => item?.name === name);
  assert.ok(node, `Node ${name} not found`);
  return node;
}

function findFunctionRange(code, signature) {
  const start = code.indexOf(signature);
  assert.ok(start >= 0, `${signature} not found`);
  const opening = code.indexOf('{', start + signature.length);
  assert.ok(opening >= 0, `${signature} opening brace not found`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = opening; index < code.length; index += 1) {
    const char = code[index];
    const next = code[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`${signature} closing brace not found`);
}

function patchProductContext(code) {
  let next = String(code || '');
  if (!next.includes(`// ${MARKER}-context`)) {
    const imageMarker = '// catalog-model-color-photo-fallback-v283';
    const markerIndex = next.indexOf(imageMarker);
    assert.ok(markerIndex >= 0, 'canonical model/color image mapping marker not found');
    const sliceToken = '.slice(0, 3),';
    const sliceIndex = next.indexOf(sliceToken, markerIndex);
    assert.ok(sliceIndex >= 0, 'canonical image limit not found');
    const insertionIndex = sliceIndex + sliceToken.length;
    const addition = `\n      // ${MARKER}-context\n      blueprintImageUrl: ${JSON.stringify(MEDIA_PREFIXES)}.some((prefix) => String(product.blueprint_image_url || '').trim().startsWith(prefix))\n        ? String(product.blueprint_image_url).trim()\n        : '',`;
    next = next.slice(0, insertionIndex) + addition + next.slice(insertionIndex);
  }
  if (next.includes(`// ${STATE_MARKER}-context`)) return next;

  const firstVariant = 'variants: [{ color: product.color, productId: product.id, sku: product.sku, stock: product.stock, url: product.url, images: product.images }],';
  const nextVariant = 'existing.variants.push({ color: product.color, productId: product.id, sku: product.sku, stock: product.stock, url: product.url, images: product.images });';
  const storedVariant = '            images: Array.isArray(variant.images) ? variant.images : [],\n          })),';
  assert.ok(next.includes(firstVariant), 'first grouped variant anchor not found');
  assert.ok(next.includes(nextVariant), 'subsequent grouped variant anchor not found');
  assert.ok(next.includes(storedVariant), 'stored post-list variant anchor not found');
  next = next.replace(firstVariant, `// ${STATE_MARKER}-context\n      variants: [{ color: product.color, productId: product.id, sku: product.sku, stock: product.stock, url: product.url, images: product.images, blueprintImageUrl: product.blueprintImageUrl || '' }],`);
  next = next.replace(nextVariant, `existing.variants.push({ color: product.color, productId: product.id, sku: product.sku, stock: product.stock, url: product.url, images: product.images, blueprintImageUrl: product.blueprintImageUrl || '' });`);
  next = next.replace(storedVariant, `            images: Array.isArray(variant.images) ? variant.images : [],\n            blueprintImageUrl: variant.blueprintImageUrl || product.blueprintImageUrl || '',\n          })),`);
  return next;
}

function patchClassifierPrompt(systemMessage) {
  const source = String(systemMessage || '');
  if (source.includes(`${MARKER}-classifier`)) return source;
  const photoLine = '- pedir_foto: cliente pediu foto/imagem de item, produto, cor ou do item ja selecionado.';
  assert.ok(source.includes(photoLine), 'sales classifier photo action line not found');
  return source.replace(
    photoLine,
    `${photoLine}\n- pedir_ficha: cliente pediu ficha tecnica, blueprint ou arte completa de especificacoes do item.\n- ${MARKER}-classifier: pedir_ficha nao e pedir preco nem iniciar checkout.`,
  );
}

function patchHydratedBlueprint(code) {
  const oldReturn = `if (resolvedImages.length > 0) item.images = resolvedImages;\n    return { ...item, images: resolvedImages };`;
  const newReturn = `const blueprintImageUrlV309 = normalizeBlueprintUrlV309(product?.blueprint_image_url);\n    if (resolvedImages.length > 0) item.images = resolvedImages;\n    return { ...item, images: resolvedImages, blueprintImageUrl: blueprintImageUrlV309 || normalizeBlueprintUrlV309(item?.blueprintImageUrl) };`;
  assert.ok(code.includes(oldReturn), 'exact-SKU hydration return not found');
  return code.replace(oldReturn, newReturn);
}

function patchMissingStateRecovery(code) {
  const imagesAnchor = `const images = [...new Set([product?.images, product?.resolved_images, product?.model_color_images]`;
  const start = code.indexOf(imagesAnchor);
  if (start < 0) return code;
  const limit = code.indexOf('.slice(0, 3);', start);
  assert.ok(limit >= 0, 'missing-state image limit not found');
  const afterLimit = limit + '.slice(0, 3);'.length;
  let next = code.slice(0, afterLimit)
    + `\n    const blueprintImageUrlV309 = normalizeBlueprintUrlV309(product?.blueprint_image_url);`
    + code.slice(afterLimit);
  next = next.replace(
    'if (images.length === 0) return [];',
    'if (images.length === 0 && !blueprintImageUrlV309) return [];',
  );
  const recoveredVariantAnchor = `      images,\n    };`;
  assert.ok(next.includes(recoveredVariantAnchor), 'recovered variant image field not found');
  return next.replace(recoveredVariantAnchor, `      images,\n      blueprintImageUrl: blueprintImageUrlV309,\n    };`);
}

function buildPhotoFunctionSource() {
  return `async function buildPhotoMessages(item, selectedOption) {
  const hydratedItem = await hydratePhotoItem(item);
  const blueprintImageUrlV309 = normalizeBlueprintUrlV309(hydratedItem?.blueprintImageUrl);
  const realImagesV309 = [...new Set((Array.isArray(hydratedItem?.images) ? hydratedItem.images : [])
    .map((url) => String(url || '').trim())
    .filter((url) => isAllowedMediaUrlV309(url) && url !== blueprintImageUrlV309))];
  const selectedMediaV309 = wantsBlueprintOnlyV309 && blueprintImageUrlV309
    ? [blueprintImageUrlV309]
    : (blueprintImageUrlV309
      ? [blueprintImageUrlV309, ...realImagesV309.slice(0, 1)]
      : realImagesV309.slice(0, 3));
  const productUrl = hydratedItem.url || selectedOption.url || '';
  if (selectedMediaV309.length === 0) {
    return [{ type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (productUrl ? 'Veja os detalhes: ' + productUrl : 'Esse produto esta sem link cadastrado no momento.')) }];
  }
  const captionBase = [selectedOption.name, selectedOption.memory, titleCase(hydratedItem.color)].filter(Boolean).join(' - ');
  const fileBaseV309 = 'produto-' + (normalize(hydratedItem.color).replace(/\\s+/g, '-') || 'catalogo');
  return selectedMediaV309.slice(0, 3).map((mediaUrl, index) => {
    const cleanMediaUrlV309 = String(mediaUrl).split(/[?#]/, 1)[0].toLowerCase();
    const extensionV309 = cleanMediaUrlV309.endsWith('.png') ? 'png'
      : (cleanMediaUrlV309.endsWith('.webp') ? 'webp' : (cleanMediaUrlV309.endsWith('.gif') ? 'gif' : 'jpg'));
    return {
      type: 'image', mediaUrl,
      mimetype: extensionV309 === 'jpg' ? 'image/jpeg' : 'image/' + extensionV309,
      fileName: (mediaUrl === blueprintImageUrlV309 ? 'blueprint-' : fileBaseV309 + '-') + (index + 1) + '.' + extensionV309,
      caption: index === 0 ? captionBase : '',
    };
  });
}`;
}

function patchPostList(code) {
  let next = String(code || '');
  if (!next.includes(`// ${MARKER}-post-list`)) {
    const aiPhotoAnchor = "const wantsPhotoFromAI = aiAction === 'pedir_foto';";
    assert.ok(next.includes(aiPhotoAnchor), 'AI photo intent anchor not found');
    next = next.replace(aiPhotoAnchor, `// ${MARKER}-post-list
const MEDIA_PREFIXES_V309 = ${JSON.stringify(MEDIA_PREFIXES)};
const isAllowedMediaUrlV309 = (value) => {
  const url = String(value || '').trim();
  return MEDIA_PREFIXES_V309.some((prefix) => url.startsWith(prefix));
};
const normalizeBlueprintUrlV309 = (value) => {
  const url = String(value || '').trim();
  return isAllowedMediaUrlV309(url) ? url : '';
};
const wantsBlueprintOnlyV309 = aiAction === 'pedir_ficha' || /\\b(?:blueprint|ficha tecnica)\\b/.test(normalized);
const wantsPhotoFromAI = aiAction === 'pedir_foto' || wantsBlueprintOnlyV309;`);

    next = patchHydratedBlueprint(next);
    next = patchMissingStateRecovery(next);
    const range = findFunctionRange(next, 'async function buildPhotoMessages');
    next = next.slice(0, range.start) + buildPhotoFunctionSource() + next.slice(range.end);
  }
  if (next.includes(`// ${STATE_MARKER}-hydrate`)) return next;
  const currentImagesAnchor = `  if (currentImages.length > 0) return { ...item, images: currentImages };\n  const sku = String(item?.sku || '').trim();\n  if (!sku) return { ...item, images: [] };`;
  assert.ok(next.includes(currentImagesAnchor), 'photo hydration early-return anchor not found');
  next = next.replace(currentImagesAnchor, `  // ${STATE_MARKER}-hydrate
  const currentBlueprintImageUrlV320 = normalizeBlueprintUrlV309(item?.blueprintImageUrl);
  if (currentImages.length > 0 && currentBlueprintImageUrlV320) {
    return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };
  }
  const sku = String(item?.sku || '').trim();
  if (!sku) return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };`);
  next = next.replace(
    `if (!product) return { ...item, images: [] };`,
    `if (!product) return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };`,
  );
  const catchAnchor = `  } catch (error) {\n    return { ...item, images: [] };\n  }\n}`;
  assert.ok(next.includes(catchAnchor), 'photo hydration catch anchor not found');
  next = next.replace(catchAnchor, `  } catch (error) {\n    return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };\n  }\n}`);
  return next;
}

function patchSplitter(code) {
  let next = String(code || '');
  if (next.includes(`// ${STATE_MARKER}-splitter`)) return next;
  const anchor = `const message = normalizeOutboundPayload(rawMessage);\n  return { json: { message: message.text || message.caption || message, caption: message.caption || message.text || message, messageType:`;
  assert.ok(next.includes(anchor), 'splitter image caption anchor not found');
  return next.replace(anchor, `const message = normalizeOutboundPayload(rawMessage);
  // ${STATE_MARKER}-splitter
  const safeMessageTextV320 = typeof message === 'string'
    ? message
    : (typeof message?.text === 'string' ? message.text : (typeof message?.caption === 'string' ? message.caption : ''));
  const safeCaptionV320 = typeof message === 'object' && message !== null
    ? (typeof message.caption === 'string' ? message.caption : (typeof message.text === 'string' ? message.text : ''))
    : safeMessageTextV320;
  return { json: { message: safeMessageTextV320, caption: safeCaptionV320, messageType:`);
}

function patchSpecificModelBlueprintContext(code) {
  let next = String(code || '');
  if (next.includes(`// ${SPECIFIC_MODEL_MARKER}-context`)) return next;
  const anchor = `const deterministicCatalogOutputV322 = finalQuoteMessages.filter(Boolean).join('[[MSG]]');`;
  assert.ok(next.includes(anchor), 'specific-model blueprint context anchor not found');
  const addition = `${anchor}
// ${SPECIFIC_MODEL_MARKER}-context
const specificModelBlueprintCandidateV336 = String(products[0]?.blueprintImageUrl || products[0]?.variants?.find((variant) => variant?.blueprintImageUrl)?.blueprintImageUrl || '').trim();
const specificModelBlueprintUrlV336 = requestedDeviceModelQuery && products.length === 1 && !unavailableRequestedDevice
  && ${JSON.stringify(MEDIA_PREFIXES)}.some((prefix) => specificModelBlueprintCandidateV336.startsWith(prefix))
  ? specificModelBlueprintCandidateV336 : '';
const specificModelBlueprintMediaV336 = specificModelBlueprintUrlV336 ? {
  type: 'image',
  mediaUrl: specificModelBlueprintUrlV336,
  mimetype: specificModelBlueprintUrlV336.split(/[?#]/, 1)[0].toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
  fileName: 'blueprint-modelo.' + (specificModelBlueprintUrlV336.split(/[?#]/, 1)[0].toLowerCase().endsWith('.png') ? 'png' : 'jpg'),
  caption: 'Ficha técnica • ' + String(products[0]?.name || 'Modelo selecionado'),
  delayMs: 4500,
} : null;`;
  next = next.replace(anchor, addition);
  const returnAnchor = `    productsInStock: products,`;
  assert.ok(next.includes(returnAnchor), 'specific-model blueprint return anchor not found');
  return next.replace(returnAnchor, `${returnAnchor}
    specificProductBlueprintMedia: specificModelBlueprintMediaV336,`);
}

function patchSpecificModelBlueprintSplitter(code) {
  let next = String(code || '');
  if (next.includes(`// ${SPECIFIC_MODEL_MARKER}-splitter`)) return next;
  const suffixAnchor = `const suffix = [];`;
  assert.ok(next.includes(suffixAnchor), 'specific-model blueprint splitter anchor not found');
  return next.replace(suffixAnchor, `${suffixAnchor}
// ${SPECIFIC_MODEL_MARKER}-splitter
const specificModelBlueprintV336 = $json.specificProductBlueprintMedia;
if (specificModelBlueprintV336?.type === 'image'
  && /^https:\\/\\/(?:api\\.xiaomipetrolina\\.com\\.br\\/images\\/|imagens\\.xiaomipetrolina\\.com\\.br\\/)/i.test(String(specificModelBlueprintV336.mediaUrl || ''))) {
  suffix.push(specificModelBlueprintV336);
}`);
}

function patchWorkflow(workflow) {
  assert.ok(workflow && Array.isArray(workflow.nodes), 'workflow.nodes must be an array');
  const cloned = JSON.parse(JSON.stringify(workflow));
  const context = findNode(cloned.nodes, 'Vendas - Contexto Produtos');
  context.parameters.jsCode = patchProductContext(String(context.parameters?.jsCode || ''));
  context.parameters.jsCode = patchSpecificModelBlueprintContext(String(context.parameters?.jsCode || ''));
  const postList = findNode(cloned.nodes, 'Vendas - Verificar Pos Lista');
  postList.parameters.jsCode = patchPostList(String(postList.parameters?.jsCode || ''));
  const splitter = findNode(cloned.nodes, 'Dividir mensagens');
  splitter.parameters.jsCode = patchSplitter(String(splitter.parameters?.jsCode || ''));
  splitter.parameters.jsCode = patchSpecificModelBlueprintSplitter(String(splitter.parameters?.jsCode || ''));

  const classifier = cloned.nodes.find((node) => String(node?.parameters?.options?.systemMessage || '').includes('- pedir_foto:'));
  assert.ok(classifier, 'sales classifier system prompt not found');
  classifier.parameters.options.systemMessage = patchClassifierPrompt(classifier.parameters.options.systemMessage);
  return cloned;
}

async function readActiveWorkflow(conn, db) {
  const raw = await psql(conn, db, `COPY (
    SELECT json_build_object(
      'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
      'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
      'activeVersionId', "activeVersionId",
      'active', active
    )::text
    FROM workflow_entity
    WHERE id=${shQuote(WORKFLOW_ID)}
  ) TO STDOUT;`);
  const entity = JSON.parse(raw.trim());
  return {
    nodes: JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8')),
    connections: JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8')),
    activeVersionId: entity.activeVersionId,
    active: entity.active,
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = String(await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    if (!db) throw new Error('n8n Postgres container not found');

    const current = await readActiveWorkflow(conn, db);
    const patched = patchWorkflow({ nodes: current.nodes, connections: current.connections });
    const changed = JSON.stringify(patched.nodes) !== JSON.stringify(current.nodes);
    for (const nodeName of ['Vendas - Contexto Produtos', 'Vendas - Verificar Pos Lista', 'Dividir mensagens']) {
      const node = findNode(patched.nodes, nodeName);
      new Function(node.parameters.jsCode);
    }

    if (DRY_RUN) {
      console.log(JSON.stringify({ dryRun: true, workflowId: WORKFLOW_ID, active: current.active, changed, codeCompiles: true }, null, 2));
      return;
    }

    const backupDirectory = path.join(__dirname, '..', 'backups', 'n8n');
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupPath = path.join(backupDirectory, `${WORKFLOW_ID}-${Date.now()}-${MARKER}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(current, null, 2), { flag: 'wx' });

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity
SET nodes=${dollar(JSON.stringify(patched.nodes), 'nodesjson')}::json,
    connections=${dollar(JSON.stringify(patched.connections), 'connectionsjson')}::json,
    "versionId"="activeVersionId",
    "updatedAt"=NOW()
WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history
SET nodes=${dollar(JSON.stringify(patched.nodes), 'historynodesjson')}::json,
    connections=${dollar(JSON.stringify(patched.connections), 'historyconnectionsjson')}::json,
    "updatedAt"=NOW()
WHERE "workflowId"=${shQuote(WORKFLOW_ID)}
  AND "versionId"=${shQuote(current.activeVersionId)};
COMMIT;
COPY (
  SELECT json_build_object(
    'active', we.active,
    'versionAligned', we."versionId"=we."activeVersionId",
    'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
    'markerPresent', we.nodes::text LIKE '%${MARKER}%' AND we.nodes::text LIKE '%${STATE_MARKER}%' AND we.nodes::text LIKE '%${SPECIFIC_MODEL_MARKER}%'
  )::text
  FROM workflow_entity we
  JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
  WHERE we.id=${shQuote(WORKFLOW_ID)}
) TO STDOUT;`;
    const result = JSON.parse(String(await psql(conn, db, sql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const health = String(await runRemote(conn, "curl -fsS http://127.0.0.1:5678/healthz")).trim();
    console.log(JSON.stringify({ ...result, changed, codeCompiles: true, health, backupPath }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = {
  MEDIA_PREFIXES,
  MARKER,
  STATE_MARKER,
  SPECIFIC_MODEL_MARKER,
  imageMediaMetadata,
  isAllowedMediaUrl,
  normalizeBlueprintUrl,
  patchClassifierPrompt,
  patchPostList,
  patchProductContext,
  patchSplitter,
  patchSpecificModelBlueprintContext,
  patchSpecificModelBlueprintSplitter,
  patchWorkflow,
  selectBlueprintMedia,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
