import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const page = await readFile(new URL('pages/admin/settings/MarketingPage.tsx', root), 'utf8');
const card = await readFile(new URL('pages/admin/settings/marketing/ProductBlueprintCard.tsx', root), 'utf8');
const mapper = await readFile(new URL('pages/admin/settings/marketing/productBlueprintArtwork.ts', root), 'utf8');
const publicPage = await readFile(new URL('pages/store/PublicProductPage.tsx', root), 'utf8');
const formats = await readFile(new URL('utils/marketing-sticker.ts', root), 'utf8');

assert.match(formats, /'blueprint'/, 'blueprint must be an official marketing format');
assert.match(formats, /width:\s*1536,\s*height:\s*1024/, 'blueprint must export in 3:2 high resolution');
assert.match(page, /<ProductBlueprintCard/);
assert.match(page, /marketingSelectionOptions/);
assert.match(page, /blueprint:\$\{group\.groupKey\}/, 'bulk blueprint selection must be grouped by model');
assert.match(page, /\/models\/\$\{encodeURIComponent\(blueprint\.modelId\)\}\/blueprint/);
assert.match(page, /blueprint_source_hash/);
assert.match(page, /includeOutOfStock: isBlueprintFormat/, 'blueprint mode must include every active registered phone, even without stock');
assert.match(page, /if \(includeOutOfStock\)[\s\S]*vpsApiService\.getProducts\([\s\S]*status: 'active'[\s\S]*limit: 2000/, 'blueprint mode must read the complete active administrative category before public catalog visibility rules');
assert.match(page, /normalizeBlueprintProductNamesByModel/);
assert.match(page, /canonicalNameByModel\.get\(String\(product\.model_id \|\| product\.id/, 'blueprint grouping must collapse spelling variants under one model id');
assert.match(page, /groupProductsByVariants\(productsToGroup, isBlueprintFormat\)/, 'the model-normalized list must feed blueprint grouping');
assert.match(page, /!isBlueprintFormat && selectedProduct && selectedProductImages\.length === 0/, 'a missing gallery photo must be reported in the blueprint checklist without blocking model registration');
assert.match(page, /sourceHash\.slice\(0, 12\)/, 'immutable blueprint filenames must include the source hash');
assert.match(page, /\/synology\/upload\?folder=imagens/);
assert.match(page, /products\/blueprints\/\$\{file\.name\}/, 'blueprints must have a public API storage fallback when the Synology tunnel is offline');
assert.match(page, /vpsClient\.upload<\{ url\?: string \}>\('\/images\/upload'/);
assert.match(page, /Checklist incompleto/);
assert.match(page, /nenhum dado será inventado/);
assert.match(page, /Todos celulares/);
assert.match(page, /\^smartphones\?\$[\s\S]*\^celulares\?\$/, 'the shortcut must prioritize the populated Smartphones category over the legacy Celulares category');

assert.match(card, /data-blueprint-watermark="true"/, 'watermark must be part of the exported canvas');
assert.match(card, /opacity-\[0\.12\]/, 'watermark must remain visible without covering specifications');
assert.match(card, /Ficha técnica ilustrada/);

assert.match(mapper, /group\.variants\.flatMap/, 'mapper must aggregate all products of the model');
assert.match(mapper, /group\.allColors/, 'mapper must aggregate every registered color');
assert.match(mapper, /missingFields/);
assert.match(mapper, /Resolução da tela/);
assert.match(mapper, /Conteúdo da caixa/);
assert.match(mapper, /cam_principal_mpx/);
assert.match(mapper, /battery_mah/);
assert.match(mapper, /conteudo_da_caixa/);

assert.match(publicPage, /blueprint_image_url/);
assert.match(publicPage, /Blueprint do modelo/);
assert.match(publicPage, /Abrir em tamanho completo/);
assert.match(publicPage, /loading="lazy"/);

console.log('product-blueprint-static.test.mjs: ok');
