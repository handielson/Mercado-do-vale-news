import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['server.js', 'vps_server.js', 'vps_server.cjs'];

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
  const listingPayloadFunctions = source.match(
    /function buildTikTokShopListingPayloadVps\(remoteProduct(?:, fallbackCategoryId = '')?\) \{[\s\S]*?\n\}\n\nfunction formatTikTokShopBusinessErrorsVps/,
  )?.[0].replace(/\n\nfunction formatTikTokShopBusinessErrorsVps$/, '');
  assert.ok(listingPayloadFunctions, `${file} must expose the TikTok listing payload builder`);
  const { buildListingPayload, mergeAutomaticAttributes } = Function(
    `${listingPayloadFunctions}; return {
      buildListingPayload: buildTikTokShopListingPayloadVps,
      mergeAutomaticAttributes: mergeTikTokShopAutomaticAttributesVps,
    };`,
  )();
  const normalizedListingPayload = buildListingPayload({
    title: 'Produto de teste',
    description: '<p>Descricao</p>',
    categories: [
      { id: '100', is_leaf: false },
      { id: '985480', is_leaf: true },
    ],
    brand: { id: 'brand-123', name: 'Marca' },
    main_images: [{ uri: 'tos-image-uri' }],
    skus: [{ id: 'sku-123' }],
  });
  assert.equal(
    normalizedListingPayload.category_id,
    '985480',
    `${file} must convert the Get Product categories trail into Edit Product category_id`,
  );
  assert.equal(
    normalizedListingPayload.brand_id,
    'brand-123',
    `${file} must convert the Get Product brand object into Edit Product brand_id`,
  );
  const persistedCategoryPayload = buildListingPayload({
    title: 'Produto com categoria persistida',
    description: '<p>Descricao</p>',
    main_images: [{ uri: 'tos-image-uri' }],
    skus: [{ id: 'sku-123' }],
  }, '985480');
  assert.equal(
    persistedCategoryPayload.category_id,
    '985480',
    `${file} must fall back to the category persisted when the draft was created`,
  );
  assert.throws(
    () => buildListingPayload({
      title: 'Produto sem categoria',
      description: '<p>Descricao</p>',
      main_images: [{ uri: 'tos-image-uri' }],
      skus: [{ id: 'sku-123' }],
    }),
    (error) => error?.statusCode === 422 && /category_id/.test(error.message),
    `${file} must report incomplete remote drafts as validation errors instead of gateway errors`,
  );
  const anatelPayload = mergeAutomaticAttributes(
    persistedCategoryPayload,
    [{
      id: '102427',
      name: 'Is Anatel Homologation Code Required',
      is_requried: true,
      values: [
        { id: 'yes-id', name: 'Sim' },
        { id: 'no-id', name: 'Não' },
      ],
    }],
  );
  assert.deepEqual(
    anatelPayload.product_attributes,
    [{
      id: '102427',
      name: 'Is Anatel Homologation Code Required',
      values: [{ id: 'no-id', name: 'Não' }],
    }],
    `${file} must resolve the TikTok-provided ANATEL "Nao" value for passive 3D supplies`,
  );
  assert.match(
    source,
    /attribute\?\.is_required === true \|\| attribute\?\.is_requried === true/,
    `${file} must support TikTok's historical is_requried response field`,
  );
  assert.match(
    source,
    /reply\.code\(err\.tiktokCode \? 422 : \(err\.statusCode \|\| 502\)\)/,
    `${file} must return TikTok business errors as structured validation responses`,
  );
  assert.match(
    source,
    /Number\(err\?\.tiktokCode\) !== 12052901[\s\S]*?result = await loadProduct\(false\)/,
    `${file} must retry the current product version when TikTok rejects a stale draft-version lookup`,
  );
  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS tiktok_shop_products/,
    `${file} must persist TikTok product links separately`,
  );
  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS tiktok_shop_category_mappings/,
    `${file} must persist local-to-TikTok category mappings`,
  );
  assert.match(source, /idempotency_key VARCHAR\(128\)/, `${file} must persist draft idempotency`);
  assert.match(source, /uploaded_images JSON/, `${file} must cache TikTok image URIs`);
  assert.match(
    source,
    /fastify\.put\('\/tiktok-shop\/catalog\/category-mappings\/:localCategoryId', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose the protected proxy-safe category mapping write`,
  );
  assert.match(
    source,
    /fastify\.get\('\/api\/tiktok-shop\/products\/links', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must protect the API product links route`,
  );
  assert.match(
    source,
    /fastify\.get\('\/tiktok-shop\/products\/links', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose the proxy-safe product links route`,
  );
  assert.match(
    source,
    /AND COALESCE\(status, ''\) <> 'DELETED'/,
    `${file} must not light deleted TikTok links`,
  );
  assert.match(
    source,
    /pathname: '\/product\/202309\/images\/upload'/,
    `${file} must upload local images before product creation`,
  );
  assert.match(source, /\^data:\(image/, `${file} must accept controlled local base64 product images`);
  assert.match(
    source,
    /pathname: '\/product\/202309\/files\/upload'/,
    `${file} must upload product video with the official file endpoint`,
  );
  assert.match(
    source,
    /normalizeTikTokDraftVideoRatioVps/,
    `${file} must normalize video ratio before upload`,
  );
  assert.match(
    source,
    /ceil\(max\(iw,ih\*9\/16\)\/2\)\*2[\s\S]*ceil\(max\(ih,iw\*9\/16\)\/2\)\*2/,
    `${file} must pad videos into TikTok's 9:16 to 16:9 range without cropping`,
  );
  assert.match(source, /produto-video-original/, `${file} must use a distinct FFmpeg input path`);
  assert.match(source, /produto-video-ajustado\.mp4/, `${file} must use a distinct FFmpeg output path`);
  assert.match(source, /video_processing_version: 'pad-v1'/, `${file} must invalidate old video cache`);
  assert.match(source, /video_url, price_retail/, `${file} must load the product video`);
  assert.match(source, /\{ video: uploadedVideo \}/, `${file} must associate the uploaded video`);
  assert.match(
    source,
    /pathname: '\/product\/202309\/products'/,
    `${file} must use the official Create Product endpoint`,
  );
  assert.match(source, /save_mode: 'AS_DRAFT'/, `${file} must create a safe draft, never a live listing`);
  assert.match(source, /idempotency_key: crypto\.randomUUID\(\)/, `${file} must use UUID v4 idempotency`);
  assert.match(
    source,
    /fastify\.post\('\/tiktok-shop\/products\/drafts', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must protect the proxy-safe draft write route`,
  );
  assert.match(
    source,
    /fastify\.post\('\/tiktok-shop\/products\/draft-jobs', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must start protected asynchronous draft jobs`,
  );
  assert.match(
    source,
    /fastify\.get\('\/tiktok-shop\/products\/draft-jobs\/:jobId', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose protected live job progress`,
  );
  assert.match(
    source,
    /fastify\.post\('\/tiktok-shop\/products\/:productId\/publish', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must protect the proxy-safe draft publication route`,
  );
  assert.match(
    source,
    /pathname: `\/product\/202309\/products\/\$\{encodeURIComponent\(remoteProductId\)\}`/,
    `${file} must retrieve the latest remote draft before publishing`,
  );
  assert.match(
    source,
    /pathname: `\/product\/202509\/products\/\$\{encodeURIComponent\(remoteProductId\)\}`/,
    `${file} must publish drafts with the current Edit Product endpoint`,
  );
  assert.match(
    source,
    /buildTikTokShopListingPayloadVps\(remoteDraft, link\.tiktok_category_id\)/,
    `${file} must publish with the category persisted for the original draft`,
  );
  assert.match(source, /save_mode: 'LISTING'/, `${file} must submit the draft for listing`);
  assert.doesNotMatch(
    source,
    /pathname: '\/product\/202309\/products\/activate'[\s\S]{0,500}DRAFT/,
    `${file} must not use Activate Product for a draft`,
  );
  assert.match(
    source,
    /fastify\.get\('\/tiktok-shop\/logistics\/warehouses', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must protect the proxy-safe warehouse route`,
  );
  assert.match(
    source,
    /hostname\.endsWith\('\.mercadodovale\.com\.br'\)[\s\S]*hostname\.endsWith\('\.xiaomipetrolina\.com\.br'\)/,
    `${file} must restrict server-side image downloads to controlled domains`,
  );
  const draftProductQuery = source.match(
    /SELECT id, company_id, name, sku, description, images, image_url,[\s\S]*?FROM products[\s\S]*?WHERE id = \?[\s\S]*?LIMIT 1/,
  )?.[0] || '';
  assert.ok(draftProductQuery, `${file}: consulta do produto para rascunho ausente`);
  assert.doesNotMatch(
    draftProductQuery,
    /\bshipping_(?:weight|height|width|length)\b/,
    `${file}: a consulta nao pode depender de colunas shipping_* ausentes no banco`,
  );
}

const service = readFileSync('services/tiktokShopService.ts', 'utf8');
assert.match(service, /getProductLinks\(productIds: string\[\]\)/, 'frontend service must read TikTok links in bulk');
assert.match(service, /getCategoryMapping\(localCategoryId: string\)/, 'frontend service must read category mappings');
assert.match(service, /saveCategoryMapping\(input:/, 'frontend service must persist confirmed category mappings');
assert.match(service, /getWarehouses\(\)/, 'frontend service must discover TikTok warehouses');
assert.match(service, /createDraft\(input:/, 'frontend service must expose draft creation');
assert.match(service, /startDraftJob\(input:/, 'frontend service must start asynchronous draft creation');
assert.match(service, /getDraftJob\(jobId: string\)/, 'frontend service must poll live draft progress');
assert.match(service, /publishDraft\(productId: string\)/, 'frontend service must publish an existing draft');
assert.doesNotMatch(service, /include_video/, 'video must not be silently omitted from TikTok drafts');
assert.doesNotMatch(
  service,
  /['"]\/api\/tiktok-shop\/products\/links/,
  'frontend service must use the proxy-safe product links path',
);

const listPage = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
assert.match(listPage, /tiktokShopService\.getProductLinks\(productIds\)/, 'product list must load TikTok links');
assert.match(listPage, /tiktokProductLinks=\{tiktokProductLinks\}/, 'product list must pass link state to cards');
assert.match(
  listPage,
  /\}, \[visibleProductIdsKey\]\);/,
  'TikTok link loading must depend on stable product ids instead of the paginated array identity',
);

const card = readFileSync('components/products/ProductCard.tsx', 'utf8');
assert.match(card, /Enviar para o TikTok Shop/, 'product card must expose the TikTok shortcut');
assert.match(
  card,
  /setIsTikTokModalOpen\(true\)/,
  'TikTok shortcut must open synchronization in the product card',
);
assert.match(card, /isTikTokSynced/, 'product card must render a linked visual state');
assert.match(card, /bg-emerald-400/, 'active TikTok icon must show a confirmation dot');
assert.match(card, /currentTikTokProductLink\?\.status/, 'TikTok icon must use the real remote status');
assert.match(card, /TikTokShopSyncModal/, 'product card must render the TikTok synchronization modal');

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const preparation = readFileSync(
  'pages/admin/settings/components/TikTokShopProductPreparation.tsx',
  'utf8',
);
const modal = readFileSync(
  'pages/admin/settings/components/TikTokShopSyncModal.tsx',
  'utf8',
);
assert.match(page, /get\('product_id'\)/, 'TikTok page must read the selected product from the URL');
assert.match(page, /initialProductId=\{initialProductId\}/, 'TikTok page must forward the selected product');
assert.match(
  preparation,
  /productService\.getById\(initialProductId\)/,
  'TikTok preparation must hydrate the selected product',
);
assert.match(
  preparation,
  /tiktokShopService\.getCategoryMapping\(localCategoryId\)/,
  'TikTok preparation must reuse a saved category mapping',
);
assert.match(
  preparation,
  /normalizeCategoryName\(category\.name\) === normalizedLocalName/,
  'TikTok preparation must only auto-confirm an exact normalized category name',
);
assert.match(
  preparation,
  /tiktokShopService\.saveCategoryMapping/,
  'TikTok preparation must persist the category after confirmation',
);
assert.match(
  preparation,
  /Criar rascunho no TikTok/,
  'TikTok preparation must expose draft creation in the product modal',
);
assert.match(
  preparation,
  /window\.confirm/,
  'TikTok preparation must require explicit confirmation before the external write',
);
assert.match(preparation, /Acompanhamento do envio/, 'TikTok modal must display live sending steps');
assert.match(preparation, /getDraftJob\(job\.job_id\)/, 'TikTok modal must poll actual backend progress');
assert.match(preparation, /Copiar debug/, 'TikTok errors must expose a copy-debug action');
assert.match(preparation, /Publicar no TikTok/, 'TikTok draft must expose a publication button');
assert.match(preparation, /Ver rascunho/, 'TikTok draft must expose a Seller Center shortcut');
assert.match(preparation, /Ver anuncio/, 'active TikTok product must expose a public listing shortcut');
assert.match(
  preparation,
  /https:\/\/seller-br\.tiktok\.com\/product/,
  'draft shortcut must open the official Brazil Seller Center product page',
);
assert.match(
  preparation,
  /https:\/\/shop\.tiktok\.com\/view\/product\//,
  'listing shortcut must use the official TikTok Shop product URL format',
);
assert.match(preparation, /navigator\.clipboard\.writeText/, 'copy-debug must use the clipboard API');
assert.match(preparation, /Codigo TikTok:/, 'copied debug must include the TikTok error code');
assert.match(preparation, /Request ID:/, 'copied debug must include the TikTok request id');
assert.doesNotMatch(preparation, /Desmarque.*video/i, 'UI must not suggest publishing without the video');
assert.match(
  preparation,
  /seller\.product\.write/,
  'TikTok preparation must require product write scope',
);
assert.match(
  preparation,
  /seller\.logistics/,
  'TikTok preparation must require logistics scope for a valid warehouse',
);
assert.match(modal, /role="dialog"/, 'TikTok synchronization must open as a dialog');
assert.match(modal, /initialProductId=\{productId\}/, 'TikTok modal must load the clicked product');
assert.match(modal, /onDraftCreated=\{onSuccess\}/, 'TikTok modal must report successful draft creation');

const preview = readFileSync(
  'pages/admin/settings/components/TikTokShopListingPreview.tsx',
  'utf8',
);
assert.match(preview, /Previa do anuncio TikTok Shop/, 'modal must show a full listing preview');
assert.match(preview, /<video[\s\S]*controls/, 'listing preview must include the product video');
assert.match(preview, /Video incluido no envio/, 'listing preview must confirm that video is included');
assert.match(preview, /Descricao/, 'listing preview must include the description');
assert.match(preview, /Campos TikTok do anuncio/, 'listing preview must expose TikTok listing fields');
assert.match(preview, /required_attributes/, 'listing preview must identify mandatory category attributes');

const packageJson = readFileSync('package.json', 'utf8');
const deployScript = readFileSync('deploy-vps-server-only.cjs', 'utf8');
assert.match(packageJson, /"ffmpeg-static":/, 'runtime must declare the FFmpeg binary dependency');
assert.match(
  deployScript,
  /npm install sharp pdf-lib ffmpeg-static@5\.3\.0 --omit=dev/,
  'API deploy must provision FFmpeg on the VPS before restart',
);

console.log('TikTok Shop product shortcut static checks ok');
