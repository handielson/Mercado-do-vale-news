const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('ssh2');

for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { patchGraph: patchSalesPreferencesGraphV289 } = require('./n8n-add-cumulative-sales-preferences-followup.cjs');
const { patchWorkflow: patchGreetingWorkflowV289 } = require('./n8n-fix-central-greeting-time.cjs');
const { patchWorkflow: patchRapidCatalogContinuationV290 } = require('./n8n-preserve-rapid-greeting.cjs');
const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Contexto Produtos';
const POST_LIST_NODE_NAME = 'Vendas - Verificar Pos Lista';
const MARKER = 'catalog-model-color-photo-fallback-v283';
const POST_LIST_MARKER = 'photo-interrupt-refresh-v284';
const POST_LIST_HTTP_MARKER = 'photo-http-helper-v285';
const PHOTO_CONTEXT_RECOVERY_MARKER = 'photo-context-recovery-v286';
const CONTEXTUAL_VIDEO_AI_MARKER = 'contextual-video-ai-v287';
const RESOLVER_NODE_NAME = 'Resolver Acao de Conversacao';
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

function patchPostListV284(code) {
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

function patchPostList(code) {
  let next = patchPostListV284(code);
  const assertV285 = (candidate) => {
    const hydrateSection = candidate.slice(candidate.indexOf('async function hydratePhotoItem'), candidate.indexOf('async function buildPhotoMessages'));
    assert.ok(candidate.includes(POST_LIST_HTTP_MARKER), 'photo HTTP helper marker must exist');
    assert.ok(hydrateSection.includes('helpers.httpRequest'), 'photo hydration must use the runner HTTP helper');
    assert.ok(!hydrateSection.includes('fetch('), 'photo hydration must not use unavailable fetch');
    assert.ok(!hydrateSection.includes('AbortSignal'), 'photo hydration must not use unavailable AbortSignal');
    assert.equal((candidate.match(/(?<!await )buildPhotoMessages\(/g) || []).length, 1, 'all buildPhotoMessages calls must be awaited');
  };
  if (next.includes(POST_LIST_HTTP_MARKER)) {
    assertV285(next);
  } else {
    const oldRequest = `const response = await fetch('https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(sku), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ...item, images: [] };
    const payload = await response.json();`;
    assert.ok(next.includes(oldRequest), 'photo fetch anchor changed unexpectedly');
    const helperRequest = `// ${POST_LIST_HTTP_MARKER}
    const payload = await helpers.httpRequest({
      method: 'GET',
      url: 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(sku),
      headers: { Accept: 'application/json' },
      json: true,
      timeout: 8000,
    });`;
    next = next.replace(oldRequest, helperRequest);
    assertV285(next);
  }

  const assertV286 = (candidate) => {
    assert.ok(candidate.includes(PHOTO_CONTEXT_RECOVERY_MARKER), 'missing-list photo recovery marker must exist');
    assert.ok(candidate.includes('recoverPhotoWithoutListState'), 'missing-list photo recovery helper must exist');
    assert.ok(candidate.includes('salesSearchQuery'), 'missing-list photo recovery must consume the classified product query');
    assert.ok(candidate.includes('historyProductSku'), 'missing-list photo recovery must support the exact recent product link');
    assert.ok(candidate.includes("messages: recoveredPhotoMessages"), 'missing-list photo recovery must emit media messages directly');
  };
  if (!next.includes(PHOTO_CONTEXT_RECOVERY_MARKER)) {
    const oldMissingState = `if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  if (wantsPhoto || wantsPhotoFromAI) {
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        output: withGreeting('Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?'),
      },
    }];
  }
  return buildContinueItem();
}`;
    assert.ok(next.includes(oldMissingState), 'missing sales-list state anchor changed unexpectedly');
    const recoveredMissingState = `// ${PHOTO_CONTEXT_RECOVERY_MARKER}
async function recoverPhotoWithoutListState() {
  const SMARTPHONES_CATEGORY_ID_V289 = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
  const classifiedQuery = String(source.salesSearchQuery || '').trim();
  const recentText = [source.conversationHistory, ...(Array.isArray(source.recentMessages) ? source.recentMessages.map((item) => item?.text) : [])]
    .filter(Boolean)
    .join(' ');
  const productLinks = [...recentText.matchAll(new RegExp('https://mercadodovale[.]com[.]br/produto/([a-z0-9-]+)', 'gi'))];
  const recentSlug = productLinks.length > 0 ? String(productLinks[productLinks.length - 1][1] || '') : '';
  const previousOutbound = [...(Array.isArray(source.recentMessages) ? source.recentMessages : [])].reverse()
    .find((item) => String(item?.direction || '') === 'outbound');
  const followsPhotoNumberPrompt = aiAction === 'pedir_foto'
    && /^\\d{1,3}$/.test(normalized)
    && normalize(previousOutbound?.text).includes('confirma o numero do item');
  const historyProductSku = followsPhotoNumberPrompt && recentSlug.includes('-') ? recentSlug.split('-').pop().toUpperCase() : '';
  const requestedColor = normalize(aiColor);
  const ignoredWords = new Set(['foto', 'fotos', 'imagem', 'imagens', 'video', 'videos', 'dele', 'dela', requestedColor].filter(Boolean));
  const searchWords = normalize(classifiedQuery).split(/\\s+/).filter((word) => word && !ignoredWords.has(word));
  if (!historyProductSku && searchWords.length === 0) return [];
  try {
    const requestUrl = historyProductSku
      ? 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(historyProductSku)
      : 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=20&category_id=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=' + encodeURIComponent(searchWords.join(' '));
    const payload = await helpers.httpRequest({ method: 'GET', url: requestUrl, headers: { Accept: 'application/json' }, json: true, timeout: 8000 });
    const products = Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : []);
    const candidates = products.filter((product) => {
      if (!historyProductSku && String(product?.category_id || '') !== SMARTPHONES_CATEGORY_ID_V289) return false;
      if (product?.status && normalize(product.status) !== 'active') return false;
      if (product?.hide_from_catalog === true || Number(product?.hide_from_catalog || 0) === 1) return false;
      const stockQuantity = Number(product?.stock_quantity);
      if (Number(product?.track_inventory || 0) === 1 && Number.isFinite(stockQuantity) && stockQuantity <= 0) return false;
      const productColor = normalize(product?.specs?.color || product?.specs?.cor || product?.color);
      if (requestedColor && productColor !== requestedColor) return false;
      if (historyProductSku && normalize(product?.sku) !== normalize(historyProductSku)) return false;
      const haystack = normalize([product?.name, product?.sku, ...(Array.isArray(product?.specs?.keywords) ? product.specs.keywords : [])].join(' '));
      return historyProductSku || searchWords.every((word) => haystack.includes(word));
    });
    if (candidates.length !== 1) return [];
    const product = candidates[0];
    const images = [...new Set([product?.images, product?.resolved_images, product?.model_color_images]
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map((url) => String(url || '').trim())
      .filter((url) => url.startsWith('https://api.xiaomipetrolina.com.br/images/')))]
      .slice(0, 3);
    if (images.length === 0) return [];
    const productUrl = product?.slug ? 'https://mercadodovale.com.br/produto/' + product.slug : '';
    const recoveredVariant = {
      productId: product?.id,
      sku: product?.sku,
      color: product?.specs?.color || product?.specs?.cor || product?.color || aiColor,
      url: productUrl,
      images,
    };
    const recoveredOption = {
      number: aiSelectedNumber || 0,
      name: product?.name || classifiedQuery || 'Produto',
      memory: '',
      url: productUrl,
    };
    return await buildPhotoMessages(recoveredVariant, recoveredOption);
  } catch (error) {
    return [];
  }
}

if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  if (wantsPhoto || wantsPhotoFromAI) {
    const recoveredPhotoMessages = await recoverPhotoWithoutListState();
    if (recoveredPhotoMessages.length > 0) {
      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: 'photo_recovered_without_list', messages: recoveredPhotoMessages } }];
    }
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        output: withGreeting('Consigo te mandar a foto sim 😊 Me informa o modelo e a cor que voce quer ver.'),
      },
    }];
  }
  return buildContinueItem();
}`;
    next = next.replace(oldMissingState, recoveredMissingState);
  }
  assertV286(next);
  if (!next.includes("const SMARTPHONES_CATEGORY_ID_V289 = '8b7c4852-c195-4527-8fd7-c3cc2debda42';")) {
    next = next.replace(
      'async function recoverPhotoWithoutListState() {',
      "async function recoverPhotoWithoutListState() {\n  const SMARTPHONES_CATEGORY_ID_V289 = '8b7c4852-c195-4527-8fd7-c3cc2debda42';",
    );
    next = next.replace(
      "'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=20&search=' + encodeURIComponent(searchWords.join(' '))",
      "'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=20&category_id=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=' + encodeURIComponent(searchWords.join(' '))",
    );
    next = next.replace(
      'const candidates = products.filter((product) => {',
      "const candidates = products.filter((product) => {\n      if (!historyProductSku && String(product?.category_id || '') !== SMARTPHONES_CATEGORY_ID_V289) return false;",
    );
  }
  assert.ok(next.includes("category_id=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289)"), 'photo recovery must restrict the API lookup to smartphones');
  assert.ok(next.includes("String(product?.category_id || '') !== SMARTPHONES_CATEGORY_ID_V289"), 'photo recovery must reject accessory collisions');
  next = patchPostListV287(next);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', next);
  return next;
}

function patchPostListV287(code) {
  if (code.includes(CONTEXTUAL_VIDEO_AI_MARKER)) return code;

  const continueAnchors = [
    `function buildContinueItem() {\n  return [{`,
    `const buildContinueItem = () => [{ json: { ...source, salesPostListHandled: false } }];`,
  ];
  const continueAnchor = continueAnchors.find((candidate) => code.includes(candidate));
  assert.ok(continueAnchor, 'continue-item anchor changed before v287');
  const mediaHelpers = `// ${CONTEXTUAL_VIDEO_AI_MARKER}
async function resolveExactMediaFactsV287(item, selectedOption) {
  const sku = String(item?.sku || '').trim();
  const requestedProductId = String(item?.productId || '').trim();
  const fallback = {
    status: 'unknown', productId: requestedProductId, sku,
    name: String(selectedOption?.name || '').trim(), memory: String(selectedOption?.memory || '').trim(),
    color: String(item?.color || '').trim(), url: String(item?.url || selectedOption?.url || '').trim(),
    videoUrl: '', marketingVideoUrl: '',
  };
  if (!sku) return fallback;
  try {
    const payload = await helpers.httpRequest({
      method: 'GET',
      url: 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(sku),
      headers: { Accept: 'application/json' }, json: true, timeout: 8000,
    });
    const products = Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : []);
    const product = products.find((candidate) => (!requestedProductId || String(candidate?.id || '') === requestedProductId)
      && normalize(candidate?.sku) === normalize(sku));
    if (!product) return fallback;
    const videoUrl = String(product?.video_url || '').trim();
    const marketingVideoUrl = String(product?.marketing_video_url || '').trim();
    return {
      ...fallback,
      status: videoUrl || marketingVideoUrl ? 'available' : 'unavailable',
      productId: String(product?.id || requestedProductId),
      name: String(product?.name || fallback.name).trim(),
      color: String(product?.specs?.color || product?.specs?.cor || product?.color || fallback.color).trim(),
      url: String(product?.slug ? 'https://mercadodovale.com.br/produto/' + product.slug : fallback.url).trim(),
      videoUrl,
      marketingVideoUrl,
    };
  } catch (error) {
    return fallback;
  }
}

function rememberMediaContextV287(item, selectedOption) {
  if (!activeState || !item?.productId || !item?.sku) return;
  activeState.lastMediaContext = {
    number: Number(selectedOption?.number || 0),
    productId: String(item.productId), sku: String(item.sku),
    name: String(selectedOption?.name || '').trim(), memory: String(selectedOption?.memory || '').trim(),
    color: String(item?.color || '').trim(), url: String(item?.url || selectedOption?.url || '').trim(),
    updatedAt: new Date(now).toISOString(), expiresAt: now + 15 * 60 * 1000,
  };
  activeState.updatedAt = new Date(now).toISOString();
}

${continueAnchor}`;
  let next = code.replace(continueAnchor, mediaHelpers);

  const photoReturn = `if (photoOption && photoVariant) {
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        salesPostListStep: activeState.step,
        orderDraft: activeState.orderDraft,
        messages: await buildPhotoMessages(photoVariant, photoOption),
      },
    }];
  }`;
  assert.ok(next.includes(photoReturn), 'photo interrupt return anchor changed before v287');
  next = next.replace(photoReturn, `if (photoOption && photoVariant) {
    const photoMessagesV287 = await buildPhotoMessages(photoVariant, photoOption);
    if (photoMessagesV287.some((message) => message?.type === 'image')) rememberMediaContextV287(photoVariant, photoOption);
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        salesPostListStep: activeState.step,
        orderDraft: activeState.orderDraft,
        messages: photoMessagesV287,
      },
    }];
  }`);

  const fulfillmentAnchor = `// default-one-unit-v245
if (activeState?.step === 'awaiting_fulfillment') {`;
  assert.ok(next.includes(fulfillmentAnchor), 'fulfillment anchor changed before v287');
  const videoRoute = `const contextualVideoQuestionV287 = aiAction === 'pergunta_sobre_item'
  && /\\b(?:video|videos|filmagem|gravacao)\\b/.test(normalized);
if (contextualVideoQuestionV287) {
  const explicitNumberV287 = numberMatch ? Number(numberMatch[1] || 0) : 0;
  const lastMediaV287 = activeState?.lastMediaContext && Number(activeState.lastMediaContext.expiresAt || 0) > now
    ? activeState.lastMediaContext : null;
  const mediaOptionsV287 = Array.isArray(activeState?.options) ? activeState.options : [];
  const mediaOptionV287 = explicitNumberV287
    ? mediaOptionsV287.find((candidate) => Number(candidate?.number || 0) === explicitNumberV287)
    : (lastMediaV287
      ? mediaOptionsV287.find((candidate) => Number(candidate?.number || 0) === Number(lastMediaV287.number || 0)
        || uniqueColorItems(candidate?.colors || []).some((item) => String(item?.productId || '') === String(lastMediaV287.productId || '')))
      : mediaOptionsV287.find((candidate) => Number(candidate?.number || 0) === Number(activeState?.selectedOptionNumber || 0)));
  const mediaVariantsV287 = uniqueColorItems(mediaOptionV287?.colors || []);
  const mentionedMediaColorV287 = findMentionedColor(mediaVariantsV287.map((item) => item.color));
  const mediaVariantV287 = mentionedMediaColorV287
    ? mediaVariantsV287.find((item) => normalize(item?.color) === normalize(mentionedMediaColorV287))
    : (lastMediaV287 && !explicitNumberV287
      ? mediaVariantsV287.find((item) => String(item?.productId || '') === String(lastMediaV287.productId || ''))
      : (mediaVariantsV287.find((item) => String(item?.productId || '') === String(activeState?.orderDraft?.productId || ''))
        || (mediaVariantsV287.length === 1 ? mediaVariantsV287[0] : null)));
  const mediaFactsV287 = mediaOptionV287 && mediaVariantV287
    ? await resolveExactMediaFactsV287(mediaVariantV287, mediaOptionV287)
    : { status: 'unknown', productId: '', sku: '', name: '', memory: '', color: '', url: '', videoUrl: '', marketingVideoUrl: '' };
  const identityV287 = [mediaFactsV287.name, mediaFactsV287.memory, mediaFactsV287.color].filter(Boolean).join(' - ');
  const guidanceByStatusV287 = mediaFactsV287.status === 'available'
    ? 'A consulta do SKU exato confirmou que existe video cadastrado para ' + identityV287 + '. Responda com palavras proprias, curta e naturalmente. Confirme que ha video e mantenha a conversa nesse produto. Nao retome entrega ou retirada nesta resposta e nao invente outros dados.'
    : (mediaFactsV287.status === 'unavailable'
      ? 'A consulta do SKU exato confirmou que nao existe video cadastrado para ' + identityV287 + '. Responda com palavras proprias, curta e naturalmente. Diga que ha fotos cadastradas quando o contexto recente mostrar fotos, mas que ainda nao ha video desse aparelho. Nao retome entrega ou retirada e nao invente video ou link.'
      : 'Nao foi possivel confirmar com seguranca qual produto ou se existe video cadastrado. Responda com palavras proprias e peca somente o numero do item, modelo ou cor necessarios para confirmar. Nao diga que tem ou que nao tem video e nao retome entrega ou retirada.');
  return [{ json: {
    ...source,
    salesPostListHandled: false,
    salesPostListStep: String(activeState?.step || ''),
    orderDraft: activeState?.orderDraft,
    mediaProductFacts: mediaFactsV287,
    forceGeneralAiResponse: true,
    aiResponseGuidance: guidanceByStatusV287,
  } }];
}

${fulfillmentAnchor}`;
  next = next.replace(fulfillmentAnchor, videoRoute);

  next = next.replaceAll('No link tem mais fotos, video e as caracteristicas dele: ', 'Veja mais fotos e as caracteristicas dele: ');
  next = next.replace(`    { type: 'text', text: 'Gostou desse modelo?' + lineBreak + 'Posso separar ele para voce? 😊' },\n`, '');
  next = next.replace(`  messages.push({ type: 'text', text: 'Gostou de alguma dessas cores?' + lineBreak + 'Posso separar para voce? 😊', delayMs: 1200 + messages.length * 4500 });\n`, '');

  const repeatedPhotoBranch = `if (!variant && (wantsPhoto || wantsPhotoFromAI)) {
  activeState.step = 'awaiting_quantity';
  activeState.selectedOptionNumber = option.number;
  activeState.updatedAt = new Date(now).toISOString();
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      messages: buildAllPhotoMessages(optionColorItems),
    },
  }];
}`;
  const repeatedCount = next.split(repeatedPhotoBranch).length - 1;
  if (repeatedCount > 1) {
    next = next.replace(new RegExp(repeatedPhotoBranch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\n\\n' + repeatedPhotoBranch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')*'), repeatedPhotoBranch);
  }

  const finalPhotoReturn = `if (wantsPhoto || wantsPhotoFromAI) {
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      messages: await buildPhotoMessages(variant, option),
    },
  }];
}`;
  if (next.includes(finalPhotoReturn)) next = next.replace(finalPhotoReturn, `if (wantsPhoto || wantsPhotoFromAI) {
  const selectedPhotoMessagesV287 = await buildPhotoMessages(variant, option);
  if (selectedPhotoMessagesV287.some((message) => message?.type === 'image')) rememberMediaContextV287(variant, option);
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      orderDraft: activeState.orderDraft,
      messages: selectedPhotoMessagesV287,
    },
  }];
}`);

  assert.ok(!next.includes('No link tem mais fotos, video e as caracteristicas dele'), 'stale video claim still reachable');
  assert.ok(!next.includes('Gostou desse modelo?'), 'canned single-photo prompt still reachable');
  assert.ok(!next.includes('Gostou de alguma dessas cores?'), 'canned multi-photo prompt still reachable');
  new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', next);
  return next;
}

function patchResolverV287(code) {
  if (code.includes(CONTEXTUAL_VIDEO_AI_MARKER)) return code;
  const decisionAnchor = `const legacy = legacyDecision($json, text);
const decision = `;
  assert.ok(code.includes(decisionAnchor), 'resolver decision anchor changed before v287');
  let next = code.replace(decisionAnchor, `// ${CONTEXTUAL_VIDEO_AI_MARKER}
const contextualMediaDecisionV287 = $json.forceGeneralAiResponse === true && $json.mediaProductFacts
  ? { acao: 'responder_direto', intencao: 'midia_produto_contextual', confianca: 1, motivo: 'O Agente Geral deve redigir a resposta usando somente os fatos de midia apurados.' }
  : null;
const legacy = legacyDecision($json, text);
const decision = contextualMediaDecisionV287 || `);
  const outputAnchor = `    output: $json.output,`;
  assert.ok(next.includes(outputAnchor), 'resolver output anchor changed before v287');
  next = next.replace(outputAnchor, `    output: contextualMediaDecisionV287 ? '' : $json.output,`);
  new Function('$json', '$getWorkflowStaticData', '$', next);
  return next;
}

function summarize(nodes) {
  const node = nodes.find((item) => item.name === NODE_NAME);
  assert.ok(node, `${NODE_NAME} not found`);
  const code = String(node.parameters?.jsCode || '');
  const postList = nodes.find((item) => item.name === POST_LIST_NODE_NAME);
  assert.ok(postList, `${POST_LIST_NODE_NAME} not found`);
  const postListCode = String(postList.parameters?.jsCode || '');
  const resolver = nodes.find((item) => item.name === RESOLVER_NODE_NAME);
  assert.ok(resolver, `${RESOLVER_NODE_NAME} not found`);
  const resolverCode = String(resolver.parameters?.jsCode || '');
  return {
    marker: code.includes(MARKER),
    readsResolvedImages: code.includes('product.resolved_images'),
    readsModelColorImages: code.includes('product.model_color_images'),
    imageLimit: code.includes('.slice(0, 3)'),
    postListMarker: postListCode.includes(POST_LIST_MARKER),
    photoBeforeFulfillment: postListCode.indexOf(POST_LIST_MARKER) < postListCode.indexOf("activeState?.step === 'awaiting_fulfillment'"),
    refreshesStaleImages: postListCode.includes("compact=true&limit=1&sku=") && postListCode.includes('product?.resolved_images'),
    awaitsPhotoMessages: postListCode.includes('await buildPhotoMessages'),
    usesRunnerHttpHelper: postListCode.includes(POST_LIST_HTTP_MARKER) && postListCode.includes('helpers.httpRequest'),
    recoversPhotoWithoutListState: postListCode.includes(PHOTO_CONTEXT_RECOVERY_MARKER) && postListCode.includes('recoverPhotoWithoutListState'),
    contextualVideoUsesLastMedia: postListCode.includes(CONTEXTUAL_VIDEO_AI_MARKER) && postListCode.includes('lastMediaContext'),
    contextualVideoBeforeFulfillment: postListCode.indexOf('contextualVideoQuestionV287') < postListCode.indexOf("activeState?.step === 'awaiting_fulfillment'"),
    contextualVideoUsesExactSku: postListCode.includes('resolveExactMediaFactsV287') && postListCode.includes('product?.video_url') && postListCode.includes('product?.marketing_video_url'),
    removesStaleVideoClaim: !postListCode.includes('No link tem mais fotos, video e as caracteristicas dele'),
    removesCannedPhotoPrompt: !postListCode.includes('Gostou desse modelo?') && !postListCode.includes('Gostou de alguma dessas cores?'),
    resolverRoutesContextualMediaToAi: resolverCode.includes(CONTEXTUAL_VIDEO_AI_MARKER) && resolverCode.includes("acao: 'responder_direto'") && resolverCode.includes("output: contextualMediaDecisionV287 ? '' : $json.output"),
  };
}

async function runV287SelfTest(nodes) {
  const postListCode = String(nodes.find((item) => item.name === POST_LIST_NODE_NAME)?.parameters?.jsCode || '');
  const resolverCode = String(nodes.find((item) => item.name === RESOLVER_NODE_NAME)?.parameters?.jsCode || '');
  const product35 = { number: 35, name: 'Realme Note 70', memory: '4GB/256GB', url: 'https://mercadodovale.com.br/produto/realme-note-70-rn704256p', colors: [{ productId: 'product-35', sku: 'RN704256P', color: 'Preto', url: 'https://mercadodovale.com.br/produto/realme-note-70-rn704256p', images: ['https://api.xiaomipetrolina.com.br/images/realme.jpg'] }] };
  const product36 = { number: 36, name: 'Wp58 Pró', memory: '8GB/512GB', url: 'https://mercadodovale.com.br/produto/wp58-pro-w58p', colors: [{ productId: 'product-36', sku: 'W58P', color: 'Laranja', url: 'https://mercadodovale.com.br/produto/wp58-pro-w58p', images: ['https://api.xiaomipetrolina.com.br/images/wp58.jpg'] }] };
  const orderDraft = { productId: 'product-36', sku: 'W58P', name: 'Wp58 Pró', color: 'Laranja', quantity: 1 };
  const buildStatic = () => ({ salesPostList: { 'test@s.whatsapp.net': {
    flow: 'sales_post_list', step: 'awaiting_fulfillment', selectedOptionNumber: 36,
    options: [product35, product36], orderDraft: { ...orderDraft }, expiresAt: Date.now() + 60 * 60 * 1000,
    lastMediaContext: { number: 35, productId: 'product-35', sku: 'RN704256P', name: 'Realme Note 70', memory: '4GB/256GB', color: 'Preto', expiresAt: Date.now() + 15 * 60 * 1000 },
  } } });
  const executePostList = async (conversation, httpRequest) => {
    const staticData = buildStatic();
    const source = { remoteJid: 'test@s.whatsapp.net', conversation, salesFlowAction: 'pergunta_sobre_item', salesFlowItemNumber: 36, salesFlowColor: 'Laranja', salesSearchQuery: 'video wp58 pro' };
    const result = await new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', postListCode)(
      source, {}, () => staticData, () => ({ first: () => ({ json: {} }) }), {}, { httpRequest },
    );
    return { result: result[0].json, state: staticData.salesPostList['test@s.whatsapp.net'] };
  };

  const contextual = await executePostList('tem video?', async (options) => {
    assert.match(options.url, /sku=RN704256P$/);
    return [{ id: 'product-35', sku: 'RN704256P', name: 'Realme Note 70', slug: 'realme-note-70-rn704256p', specs: { color: 'Preto' }, video_url: null, marketing_video_url: null }];
  });
  assert.equal(contextual.result.salesPostListHandled, false);
  assert.equal(contextual.result.mediaProductFacts.sku, 'RN704256P');
  assert.equal(contextual.result.mediaProductFacts.status, 'unavailable');
  assert.deepEqual(contextual.state.orderDraft, orderDraft, 'contextual media question must not mutate the checkout draft');
  assert.doesNotMatch(contextual.result.aiResponseGuidance, /vai ser para entrega ou retirada/i);

  const explicit = await executePostList('tem video do 36?', async (options) => {
    assert.match(options.url, /sku=W58P$/);
    return [{ id: 'product-36', sku: 'W58P', name: 'Wp58 Pró', slug: 'wp58-pro-w58p', specs: { color: 'Laranja' }, video_url: 'https://cdn.example.test/wp58.mp4', marketing_video_url: null }];
  });
  assert.equal(explicit.result.mediaProductFacts.sku, 'W58P');
  assert.equal(explicit.result.mediaProductFacts.status, 'available');
  assert.deepEqual(explicit.state.orderDraft, orderDraft, 'explicit media question must not mutate the checkout draft');

  const unavailableHttp = await executePostList('tem video?', async () => { throw new Error('timeout'); });
  assert.equal(unavailableHttp.result.mediaProductFacts.status, 'unknown');

  const resolverResult = new Function('$json', '$getWorkflowStaticData', '$', resolverCode)(
    contextual.result, () => ({}), () => ({ first: () => ({ json: contextual.result }) }),
  );
  assert.equal(resolverResult[0].json.conversationAction, 'responder_direto');
  assert.equal(resolverResult[0].json.conversationIntent, 'midia_produto_contextual');
  assert.equal(resolverResult[0].json.output, '');
  return { contextualSku: contextual.result.mediaProductFacts.sku, contextualStatus: contextual.result.mediaProductFacts.status, explicitSku: explicit.result.mediaProductFacts.sku, explicitStatus: explicit.result.mediaProductFacts.status, timeoutStatus: unavailableHttp.result.mediaProductFacts.status, draftPreserved: true, resolverAction: resolverResult[0].json.conversationAction };
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
    const resolver = nodes.find((item) => item.name === RESOLVER_NODE_NAME);
    assert.ok(resolver, `${RESOLVER_NODE_NAME} not found`);
    resolver.parameters.jsCode = patchResolverV287(String(resolver.parameters?.jsCode || ''));
    patchSalesPreferencesGraphV289(nodes, connections);
    patchGreetingWorkflowV289(nodes);
    patchRapidCatalogContinuationV290(nodes);
    for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
      new Function(String(node.parameters?.jsCode || ''));
    }
    const summary = summarize(nodes);
    if (process.argv.includes('--self-test')) {
      const selfTest = await runV287SelfTest(nodes);
      return console.log(JSON.stringify({ apply: false, selfTest, ...summary }, null, 2));
    }
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    const activeExecutionsSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new', 'running')) TO STDOUT;`;
    const activeExecutions = Number((await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(activeExecutionsSql)}`)).trim());
    assert.equal(activeExecutions, 0, 'workflow has an active execution; refusing to update it');

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupDir = `/var/backups/mdv-system/n8n-workflow-contextual-video-ai-${timestamp}`;
    await run(conn, `mkdir -p ${quote(backupDir)} && chmod 700 ${quote(backupDir)}`);
    const backupSql = `COPY (SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text FROM workflow_entity we LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(backupSql)} > ${quote(`${backupDir}/workflow.json`)} && chmod 600 ${quote(`${backupDir}/workflow.json`)} && sha256sum ${quote(`${backupDir}/workflow.json`)} > ${quote(`${backupDir}/SHA256SUMS`)}`);

    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    stopped = true;
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    const activeAfterStop = Number((await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(activeExecutionsSql)}`)).trim());
    assert.equal(activeAfterStop, 0, 'workflow received an execution during shutdown; refusing to update it');
    const versionAfterStopSql = `COPY (SELECT "activeVersionId" FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const activeVersionAfterStop = (await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(versionAfterStopSql)}`)).trim();
    assert.equal(activeVersionAfterStop, row.activeVersionId, 'active workflow version changed during preparation; refusing to overwrite it');

    const remotePath = '/tmp/mdv-n8n-contextual-video-ai-v287.json';
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
    await run(conn, `docker exec ${quote(db)} rm -f ${quote(remotePath)} && rm -f ${quote(remotePath)}`);

    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    stopped = false;

    const verifySql = `COPY (SELECT json_build_object('entityMarker', we.nodes::text LIKE '%${MARKER}%', 'historyMarker', wh.nodes::text LIKE '%${MARKER}%', 'postListEntityMarker', we.nodes::text LIKE '%${POST_LIST_MARKER}%', 'postListHistoryMarker', wh.nodes::text LIKE '%${POST_LIST_MARKER}%', 'httpHelperEntityMarker', we.nodes::text LIKE '%${POST_LIST_HTTP_MARKER}%', 'httpHelperHistoryMarker', wh.nodes::text LIKE '%${POST_LIST_HTTP_MARKER}%', 'contextRecoveryEntityMarker', we.nodes::text LIKE '%${PHOTO_CONTEXT_RECOVERY_MARKER}%', 'contextRecoveryHistoryMarker', wh.nodes::text LIKE '%${PHOTO_CONTEXT_RECOVERY_MARKER}%', 'contextualVideoEntityMarker', we.nodes::text LIKE '%${CONTEXTUAL_VIDEO_AI_MARKER}%', 'contextualVideoHistoryMarker', wh.nodes::text LIKE '%${CONTEXTUAL_VIDEO_AI_MARKER}%', 'smartphonePhotoCategoryEntity', we.nodes::text LIKE '%SMARTPHONES_CATEGORY_ID_V289%', 'smartphonePhotoCategoryHistory', wh.nodes::text LIKE '%SMARTPHONES_CATEGORY_ID_V289%', 'structuredNormalizerEntity', we.nodes::text LIKE '%const normalizeStructuredV288 =%', 'structuredNormalizerHistory', wh.nodes::text LIKE '%const normalizeStructuredV288 =%', 'duplicateGreetingGuardEntity', we.nodes::text LIKE '%SAUDACAO\\]\\]\\s*(?:bom dia|boa tarde|boa noite)%', 'duplicateGreetingGuardHistory', wh.nodes::text LIKE '%SAUDACAO\\]\\]\\s*(?:bom dia|boa tarde|boa noite)%', 'rapidCatalogContinuationEntity', we.nodes::text LIKE '%rapid-catalog-continuation-v290%', 'rapidCatalogContinuationHistory', wh.nodes::text LIKE '%rapid-catalog-continuation-v290%', 'staleVideoClaimAbsentEntity', we.nodes::text NOT LIKE '%No link tem mais fotos, video e as caracteristicas dele%', 'staleVideoClaimAbsentHistory', wh.nodes::text NOT LIKE '%No link tem mais fotos, video e as caracteristicas dele%', 'cannedPhotoPromptAbsentEntity', we.nodes::text NOT LIKE '%Gostou desse modelo?%', 'cannedPhotoPromptAbsentHistory', wh.nodes::text NOT LIKE '%Gostou desse modelo?%', 'sameNodes', we.nodes::jsonb = wh.nodes::jsonb, 'active', we.active)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const database = JSON.parse((await run(conn, `docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(verifySql)}`)).trim());
    assert.ok(Object.values(database).every(Boolean), 'database verification failed');
    const health = JSON.parse((await run(conn, 'curl -fsS https://n8n.mercadodovale.com.br/healthz')).trim());
    assert.equal(health.status, 'ok', 'n8n healthcheck failed after update');
    console.log(JSON.stringify({ apply: true, backupDir, database, health, ...summary }, null, 2));
  } finally {
    if (stopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { patchContext, patchPostList, patchPostListV287, patchResolverV287, runV287SelfTest, summarize, MARKER, POST_LIST_MARKER, POST_LIST_HTTP_MARKER, PHOTO_CONTEXT_RECOVERY_MARKER, CONTEXTUAL_VIDEO_AI_MARKER };
