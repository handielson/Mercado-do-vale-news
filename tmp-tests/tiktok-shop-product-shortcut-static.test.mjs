import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['server.js', 'vps_server.js', 'vps_server.cjs'];

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
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
assert.match(card, /bg-emerald-400 ring-2 ring-white/, 'linked TikTok icon must show a confirmation dot');
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
