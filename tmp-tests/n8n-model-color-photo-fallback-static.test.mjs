import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchContext, patchPostList, MARKER, POST_LIST_MARKER, POST_LIST_HTTP_MARKER, PHOTO_CONTEXT_RECOVERY_MARKER } = require('./n8n-fix-model-color-photo-fallback.cjs');
const servers = ['vps_server.cjs', 'vps_server.js'];

for (const file of servers) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(source, /async function attachCatalogModelColorImages\(products, baseUrl\)/, `${file} must batch-resolve galleries`);
  assert.match(source, /INNER JOIN model_color_images mci[\s\S]*INNER JOIN colors c/, `${file} must resolve model/color galleries from VPS`);
  assert.match(source, /mci\.company_id = p\.company_id OR mci\.company_id IS NULL/, `${file} must preserve company isolation`);
  assert.match(source, /model_color_images: modelColorImages, resolved_images: resolvedImages/, `${file} must expose the canonical fallback`);
  const productsRoute = source.slice(source.indexOf("fastify.get('/products'"), source.indexOf("fastify.get('/products/by-ids'"));
  const categoriesRoute = source.slice(source.indexOf("fastify.get('/categories'"), source.indexOf('// POST /categories'));
  assert.match(productsRoute, /return attachCatalogModelColorImages\(result, buildSeoBaseUrl\(req\)\);/, `${file} /products must return enriched results`);
  assert.doesNotMatch(categoriesRoute, /attachCatalogModelColorImages/, `${file} must not enrich unrelated category responses`);
}

const oldCode = `const variants = products.map((product) => ({
      images: Array.isArray(product.images) ? product.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [],
    }));
return variants;`;
const patched = patchContext(oldCode);
assert.match(patched, new RegExp(MARKER));
assert.match(patched, /product\.resolved_images/);
assert.match(patched, /product\.model_color_images/);
assert.match(patched, /startsWith\('https:\/\/api\.xiaomipetrolina\.com\.br\/images\/'\)/);

const modelColorUrl = 'https://api.xiaomipetrolina.com.br/images/model-color/model/color/photo.jpg';
const product = { images: [], resolved_images: [modelColorUrl], model_color_images: [modelColorUrl] };
const selected = [...new Set([product.images, product.resolved_images, product.model_color_images]
  .flatMap((value) => Array.isArray(value) ? value : [])
  .map((url) => String(url || '').trim())
  .filter((url) => url.startsWith('https://api.xiaomipetrolina.com.br/images/')))].slice(0, 3);
assert.deepEqual(selected, [modelColorUrl], 'an empty product.images list must fall back to its model/color gallery');

const oldPostListCode = `(async () => {
const activeState = $json.activeState === null ? null : {
  step: 'awaiting_fulfillment',
  selectedOptionNumber: 36,
  orderDraft: { productId: 'product-1', color: 'Laranja' },
  options: [{
    number: 36,
    name: 'Wp58 Pró',
    memory: '8GB/512GB',
    url: '',
    colors: [{ color: 'Laranja', productId: 'product-1', sku: 'W58P24816512L', url: '', images: [] }],
  }],
};
const wantsPhoto = true;
const wantsPhotoFromAI = true;
const hasOrderDraft = true;
const aiSelectedNumber = 36;
const source = $json;
const aiAction = String(source.salesFlowAction || 'pedir_foto');
const aiColor = String(source.salesFlowColor || '');
const uniqueColorItems = (items) => items;
const normalize = (value) => String(value || '').toLowerCase();
const normalized = normalize(source.conversation || '');
const titleCase = (value) => value;
const withGreeting = (value) => value;
const periodGreeting = () => '';
const lineBreak = '\\n';
const buildContinueItem = () => [{ json: { ...source, salesPostListHandled: false } }];
if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
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
}
// default-one-unit-v245
if (activeState?.step === 'awaiting_fulfillment') {}
const option = { name: 'Wp58 Pró', memory: '8GB/512GB', url: '' };
const buildPhotoMessages = (item) => {
  const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [];
  const productUrl = item.url || option.url || '';
  const linkText = productUrl ? 'No link tem mais fotos, video e as caracteristicas dele: ' + productUrl : '';
  if (images.length === 0) {
    return [
      { type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.')) },
    ];
  }
  const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');
  return images.map((mediaUrl, index) => ({
    type: 'image',
    mediaUrl,
    mimetype: 'image/jpeg',
    fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',
    caption: index === 0 ? captionBase + periodGreeting() + lineBreak + linkText : '',
  }));
};
const variant = { sku: 'W58P24816512L' };
const result = { messages: buildPhotoMessages(variant), };
return result;
})();`;
const patchedPostList = patchPostList(oldPostListCode);
assert.equal(patchPostList(patchedPostList), patchedPostList, 'the v286 patch must be byte-for-byte idempotent');
assert.match(patchedPostList, new RegExp(POST_LIST_MARKER));
assert.ok(patchedPostList.indexOf(POST_LIST_MARKER) < patchedPostList.indexOf("activeState?.step === 'awaiting_fulfillment'"));
assert.match(patchedPostList, /products\?status=active&compact=true&limit=1&sku=/);
assert.match(patchedPostList, /product\?\.resolved_images/);
assert.match(patchedPostList, /messages: await buildPhotoMessages\(photoVariant, photoOption\)/);
assert.match(patchedPostList, /messages: await buildPhotoMessages\(variant, option\)/);
assert.match(patchedPostList, /wantsPhoto \|\| wantsPhotoFromAI/);
assert.match(patchedPostList, new RegExp(POST_LIST_HTTP_MARKER));
assert.match(patchedPostList, /helpers\.httpRequest/);
assert.match(patchedPostList, new RegExp(PHOTO_CONTEXT_RECOVERY_MARKER));
assert.match(patchedPostList, /recoverPhotoWithoutListState/);
const hydrateSection = patchedPostList.slice(patchedPostList.indexOf('async function hydratePhotoItem'), patchedPostList.indexOf('async function buildPhotoMessages'));
assert.doesNotMatch(hydrateSection, /fetch\(/);
assert.doesNotMatch(hydrateSection, /AbortSignal/);

const executePostList = (mockHttpRequest, json = {}) => new Function(
  '$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers',
  `return ${patchedPostList}`,
)(json, {}, () => ({}), {}, {}, { httpRequest: mockHttpRequest });

const fetchCalls = [];
const execution = await executePostList(async (options) => {
  fetchCalls.push(options);
  return [{ id: 'product-1', images: [], resolved_images: [modelColorUrl], model_color_images: [modelColorUrl] }];
});
assert.equal(fetchCalls.length, 1, 'a stale list must refresh its image once');
assert.match(fetchCalls[0].url, /sku=W58P24816512L$/);
assert.equal(fetchCalls[0].json, true);
assert.equal(fetchCalls[0].timeout, 8000);
assert.equal(execution[0].json.messages[0].type, 'image');
assert.equal(execution[0].json.messages[0].mediaUrl, modelColorUrl);

const mismatchedProduct = await executePostList(async () => [{ id: 'another-product', resolved_images: [modelColorUrl] }]);
assert.equal(mismatchedProduct[0].json.messages[0].type, 'text', 'an ID mismatch must never send another product photo');

const helperFailure = await executePostList(async () => { throw new Error('timeout'); });
assert.equal(helperFailure[0].json.messages[0].type, 'text', 'an HTTP helper failure must degrade to a safe text reply');

const recoveredCalls = [];
const recovered = await executePostList(async (options) => {
  recoveredCalls.push(options);
  return [{
    id: 'product-1',
    name: 'Wp58 Pró',
    sku: 'W58P24816512L',
    slug: 'wp58-pro-24gb-8-16-512gb-laranja-w58p24816512l',
    specs: { color: 'Laranja', keywords: ['wp58 pro'] },
    images: [],
    resolved_images: [modelColorUrl],
    model_color_images: [modelColorUrl],
  }];
}, {
  activeState: null,
  salesSearchQuery: 'wp58 pro laranja',
  salesFlowColor: 'laranja',
  salesFlowAction: 'pergunta_sobre_item',
  salesFlowItemNumber: 36,
});
assert.equal(recoveredCalls.length, 1, 'a classified model/color must trigger one recovery lookup');
assert.match(recoveredCalls[0].url, /search=wp58%20pro$/);
assert.equal(recovered[0].json.salesPostListStep, 'photo_recovered_without_list');
assert.equal(recovered[0].json.messages[0].type, 'image');
assert.equal(recovered[0].json.messages[0].mediaUrl, modelColorUrl);

const numericHistoryCalls = [];
const recoveredFromRecentLink = await executePostList(async (options) => {
  numericHistoryCalls.push(options);
  return [{
    id: 'product-1', name: 'Wp58 Pró', sku: 'W58P24816512L',
    slug: 'wp58-pro-24gb-8-16-512gb-laranja-w58p24816512l',
    specs: { color: 'Laranja', keywords: ['wp58 pro'] },
    resolved_images: [modelColorUrl],
  }];
}, {
  activeState: null,
  conversation: '36',
  salesFlowAction: 'pedir_foto',
  salesFlowItemNumber: 36,
  recentMessages: [
    { direction: 'outbound', text: 'Veja: https://mercadodovale.com.br/produto/wp58-pro-24gb-8-16-512gb-laranja-w58p24816512l' },
    { direction: 'outbound', text: 'Consigo mandar. Me confirma o numero do item.' },
  ],
});
assert.match(numericHistoryCalls[0].url, /sku=W58P24816512L$/);
assert.equal(recoveredFromRecentLink[0].json.messages[0].type, 'image');

const ambiguous = await executePostList(async () => [
  { id: 'a', name: 'Wp58 Pró', sku: 'A', specs: { color: 'Laranja', keywords: ['wp58 pro'] }, resolved_images: [modelColorUrl] },
  { id: 'b', name: 'Wp58 Pró', sku: 'B', specs: { color: 'Laranja', keywords: ['wp58 pro'] }, resolved_images: [modelColorUrl] },
], { activeState: null, salesSearchQuery: 'wp58 pro laranja', salesFlowColor: 'laranja', salesFlowAction: 'pedir_foto' });
assert.equal(ambiguous[0].json.messages, undefined, 'an ambiguous recovery must not send a product photo');
assert.match(ambiguous[0].json.output, /modelo e a cor/);

const noStock = await executePostList(async () => [{
  id: 'product-1', name: 'Wp58 Pró', sku: 'W58P24816512L', status: 'active',
  track_inventory: 1, stock_quantity: 0,
  specs: { color: 'Laranja', keywords: ['wp58 pro'] }, resolved_images: [modelColorUrl],
}], { activeState: null, salesSearchQuery: 'wp58 pro laranja', salesFlowColor: 'laranja', salesFlowAction: 'pedir_foto' });
assert.equal(noStock[0].json.messages, undefined, 'an out-of-stock result must not be recovered as the requested catalog item');

console.log('n8n model/color photo fallback regression OK');
