import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchContext, patchPostList, MARKER, POST_LIST_MARKER } = require('./n8n-fix-model-color-photo-fallback.cjs');
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
const activeState = {
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
const source = {};
const uniqueColorItems = (items) => items;
const normalize = (value) => String(value || '').toLowerCase();
const titleCase = (value) => value;
const withGreeting = (value) => value;
const periodGreeting = () => '';
const lineBreak = '\\n';
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
assert.match(patchedPostList, new RegExp(POST_LIST_MARKER));
assert.ok(patchedPostList.indexOf(POST_LIST_MARKER) < patchedPostList.indexOf("activeState?.step === 'awaiting_fulfillment'"));
assert.match(patchedPostList, /products\?status=active&compact=true&limit=1&sku=/);
assert.match(patchedPostList, /product\?\.resolved_images/);
assert.match(patchedPostList, /messages: await buildPhotoMessages\(photoVariant, photoOption\)/);
assert.match(patchedPostList, /messages: await buildPhotoMessages\(variant, option\)/);
assert.match(patchedPostList, /wantsPhoto \|\| wantsPhotoFromAI/);
assert.match(patchedPostList, /AbortSignal\.timeout\(8000\)/);

const executePostList = (mockFetch) => new Function(
  '$json', '$input', '$getWorkflowStaticData', '$', '$env', 'fetch', 'AbortSignal',
  `return ${patchedPostList}`,
)({}, {}, () => ({}), {}, {}, mockFetch, { timeout: () => undefined });

const fetchCalls = [];
const execution = await executePostList(async (url) => {
  fetchCalls.push(url);
  return {
    ok: true,
    json: async () => [{ id: 'product-1', images: [], resolved_images: [modelColorUrl], model_color_images: [modelColorUrl] }],
  };
});
assert.equal(fetchCalls.length, 1, 'a stale list must refresh its image once');
assert.match(fetchCalls[0], /sku=W58P24816512L$/);
assert.equal(execution[0].json.messages[0].type, 'image');
assert.equal(execution[0].json.messages[0].mediaUrl, modelColorUrl);

const mismatchedProduct = await executePostList(async () => ({
  ok: true,
  json: async () => [{ id: 'another-product', resolved_images: [modelColorUrl] }],
}));
assert.equal(mismatchedProduct[0].json.messages[0].type, 'text', 'an ID mismatch must never send another product photo');

console.log('n8n model/color photo fallback regression OK');
