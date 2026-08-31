import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  imageMediaMetadata,
  patchSplitter,
  patchWorkflow,
  selectBlueprintMedia,
} = require('./n8n-add-product-blueprint-media.cjs');

const blueprint = 'https://imagens.xiaomipetrolina.com.br/blueprints/poco-x8-pro.png?v=1';
const photo1 = 'https://api.xiaomipetrolina.com.br/images/model-color/poco/preto/frente.jpg';
const photo2 = 'https://api.xiaomipetrolina.com.br/images/model-color/poco/preto/verso.webp';
const photo3 = 'https://api.xiaomipetrolina.com.br/images/model-color/poco/preto/lateral.jpg';
const photo4 = 'https://api.xiaomipetrolina.com.br/images/model-color/poco/preto/caixa.jpg';
const external = 'https://example.com/not-allowed.png';

assert.deepEqual(
  selectBlueprintMedia({ blueprintImageUrl: blueprint, images: [photo1, photo2] }),
  [blueprint, photo1],
  'pedir_foto must send the blueprint first and only one real photo',
);
assert.deepEqual(
  selectBlueprintMedia({ blueprintImageUrl: blueprint, images: [photo1, photo2], blueprintOnly: true }),
  [blueprint],
  'pedir_ficha must send only the blueprint when it exists',
);
assert.deepEqual(
  selectBlueprintMedia({ images: [photo1, photo2, photo2, external], blueprintOnly: true }),
  [photo1, photo2],
  'without a blueprint the current gallery fallback must remain available and deduplicated',
);
assert.deepEqual(
  selectBlueprintMedia({ images: [photo1, photo2, photo3, photo4, photo1] }),
  [photo1, photo2, photo3],
  'the legacy fallback must remain deduplicated and capped at three media items',
);
assert.deepEqual(imageMediaMetadata(blueprint), { mimetype: 'image/png', fileName: 'produto-1.png' });
assert.deepEqual(imageMediaMetadata(photo2, 'produto-preto', 1), { mimetype: 'image/webp', fileName: 'produto-preto-2.webp' });

const contextCode = `const variants = products.map((product) => ({
      // catalog-model-color-photo-fallback-v283
      images: [...new Set([product.images, product.resolved_images, product.model_color_images]
        .flatMap((value) => Array.isArray(value) ? value : [])
        .map((url) => String(url || '').trim())
        .filter((url) => /^(?:https:\/\/api\.xiaomipetrolina\.com\.br\/images\/|https:\/\/imagens\.xiaomipetrolina\.com\.br\/)/.test(url)))]
        .slice(0, 3),
    }));
const groupsByKey = new Map();
groupsByKey.set('fixture', {
      ...product,
      variants: [{ color: product.color, productId: product.id, sku: product.sku, stock: product.stock, url: product.url, images: product.images }],
});
const existing = groupsByKey.get('fixture');
existing.variants.push({ color: product.color, productId: product.id, sku: product.sku, stock: product.stock, url: product.url, images: product.images });
const options = products.map((product) => ({
        colors: (product.variants || [])
          .filter((variant) => variant.color)
          .map((variant) => ({
            color: variant.color,
            productId: variant.productId,
            sku: variant.sku || '',
            stock: variant.stock || 0,
            url: variant.url || product.url || '',
            images: Array.isArray(variant.images) ? variant.images : [],
          })),
}));`;

const postListCode = `const normalized = 'foto';
const source = $json;
const aiAction = String(source.salesFlowAction || '').trim();
const wantsPhotoFromAI = aiAction === 'pedir_foto';
async function hydratePhotoItem(item) {
  const currentImages = Array.isArray(item?.images) ? item.images : [];
  if (currentImages.length > 0) return { ...item, images: currentImages };
  const sku = String(item?.sku || '').trim();
  if (!sku) return { ...item, images: [] };
  try {
  const product = {};
  const resolvedImages = [];
  if (resolvedImages.length > 0) item.images = resolvedImages;
    return { ...item, images: resolvedImages };
  } catch (error) {
    return { ...item, images: [] };
  }
}
async function buildPhotoMessages(item, selectedOption) {
  const hydratedItem = await hydratePhotoItem(item);
  const images = hydratedItem.images;
  if (images.length === 0) return [];
  return images.map((mediaUrl) => ({ type: 'image', mediaUrl, mimetype: 'image/jpeg', fileName: 'produto.jpg' }));
}
async function recoverPhotoWithoutListState() {
    const product = {};
    const images = [...new Set([product?.images, product?.resolved_images, product?.model_color_images]
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map((url) => String(url || '').trim())
      .filter((url) => /^(?:https:\/\/api\.xiaomipetrolina\.com\.br\/images\/|https:\/\/imagens\.xiaomipetrolina\.com\.br\/)/.test(url)))]
      .slice(0, 3);
    if (images.length === 0) return [];
    const recoveredVariant = {
      images,
    };
    return recoveredVariant;
}`;

const classifierPrompt = `Acoes de fluxo_venda:
- pedir_foto: cliente pediu foto/imagem de item, produto, cor ou do item ja selecionado.`;

const splitterCode = `const normalizeOutboundPayload = (rawMessage) => rawMessage;
const toItem = (rawMessage, index, all) => {
  const message = normalizeOutboundPayload(rawMessage);
  return { json: { message: message.text || message.caption || message, caption: message.caption || message.text || message, messageType: message.type === 'image' ? 'image' : 'text' } };
};`;

const workflow = {
  nodes: [
    { name: 'Vendas - Contexto Produtos', parameters: { jsCode: contextCode } },
    { name: 'Vendas - Verificar Pos Lista', parameters: { jsCode: postListCode } },
    { name: 'Dividir mensagens', parameters: { jsCode: splitterCode } },
    { name: 'Classificador IA', parameters: { options: { systemMessage: classifierPrompt } } },
  ],
};

const patched = patchWorkflow(workflow);
const patchedAgain = patchWorkflow(patched);
assert.deepEqual(patchedAgain, patched, 'workflow patch must be byte-for-byte idempotent');

const patchedContext = patched.nodes[0].parameters.jsCode;
const patchedPostList = patched.nodes[1].parameters.jsCode;
const patchedPrompt = patched.nodes[3].parameters.options.systemMessage;
assert.match(patchedContext, /blueprintImageUrl:[\s\S]*product\.blueprint_image_url/);
assert.match(patchedContext, /variants:[\s\S]*blueprintImageUrl: product\.blueprintImageUrl/);
assert.match(patchedContext, /blueprintImageUrl: variant\.blueprintImageUrl \|\| product\.blueprintImageUrl/);
assert.match(patchedPostList, /wantsBlueprintOnlyV309/);
assert.match(patchedPostList, /blueprintImageUrlV309[\s\S]*realImagesV309\.slice\(0, 1\)/);
assert.match(patchedPostList, /selectedMediaV309\.slice\(0, 3\)/);
assert.match(patchedPostList, /extensionV309 === 'jpg' \? 'image\/jpeg' : 'image\/' \+ extensionV309/);
assert.match(patchedPostList, /blueprintImageUrl: blueprintImageUrlV309/);
assert.match(patchedPostList, /currentImages\.length > 0 && currentBlueprintImageUrlV320/);
assert.match(patchedPostList, /images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320/);
assert.match(patchedPrompt, /pedir_ficha/);
assert.doesNotMatch(patchedContext, /images:[\s\S]*blueprint_image_url[\s\S]*\.slice\(0, 3\)/, 'blueprint must stay outside the real gallery array');

const patchScript = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('./n8n-add-product-blueprint-media.cjs', import.meta.url), 'utf8'));
assert.match(patchScript, /fs\.writeFileSync\(backupPath[\s\S]*flag: 'wx'/, 'production patch must create an exclusive recovery backup');
assert.match(patchScript, /docker service scale n8n_n8n-runner=0[\s\S]*docker service scale n8n_n8n=0/, 'runner and n8n must stop before the direct database update');
assert.match(patchScript, /UPDATE workflow_entity[\s\S]*UPDATE workflow_history/, 'entity and active history must be updated together');
assert.match(patchScript, /entityHistoryEqual[\s\S]*markerPresent/, 'production verification must compare entity/history and require the marker');

const patchedSplitter = patchSplitter(splitterCode);
assert.match(patchedSplitter, /safeMessageTextV320/);
assert.match(patchedSplitter, /safeCaptionV320/);
assert.doesNotMatch(patchedSplitter, /caption: message\.caption \|\| message\.text \|\| message/);
const splitterFactory = new Function(`${patchedSplitter}; return toItem;`);
const toItem = splitterFactory();
const emptyCaptionImage = toItem({ type: 'image', mediaUrl: photo1, text: '', caption: '' }, 0, [{}]);
assert.equal(emptyCaptionImage.json.message, '');
assert.equal(emptyCaptionImage.json.caption, '');

console.log('n8n product blueprint media static checks passed');
