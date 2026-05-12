import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const api = readFileSync('api/shopee-catalog.ts', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /shopeeVariationEngine/, 'Shopee page should import the variation engine');
assert.match(page, /variationGroups/, 'Shopee page should discover selectable variation groups');
assert.match(page, /selectedVariationGroupId/, 'Shopee modal should track the selected variation group');
assert.match(page, /buildShopeeVariationModels/, 'publish flow should build tier_variation and model_list');
assert.match(page, /tier_variation/, 'add_item payload should include Shopee tier variations');
assert.match(page, /model_list/, 'add_item payload should include Shopee model list');
assert.match(page, /Publicar como anuncio com variacoes/, 'operator should explicitly opt in to variation publish');
assert.match(page, /setPublishWithVariations\(true\)/, 'matching variation groups should auto-enable variation publish');
assert.match(page, /setPublishWithVariations\(false\)/, 'products without a matching variation group should keep variation publish off');
assert.match(page, /setSelectedVariationGroupId\(''\)/, 'products without a matching variation group should clear variation group selection');
assert.match(page, /Selecione grupo/, 'variation status should be neutral when no group is selected');
assert.doesNotMatch(page, /missingSupabaseProducts|supaProds|supaMap/, 'Shopee page should not use Supabase as a catalog fallback for variation groups');
assert.match(page, /getProductsByParentId/, 'Shopee modal should fetch missing variation siblings from VPS');
assert.doesNotMatch(page, /seller_stock:\s*undefined/, 'variation add_item payload must not send a null seller_stock field');
assert.match(page, /postShopeeDebug\('add_item',\s*variationPayload,\s*'add_item:variation'\)/, 'variation add_item should first send variation payload directly');
assert.match(page, /publishShopeeVariationItem\(basePayload,\s*finalPayload,\s*variationPayloadParts,\s*parsedStock\)/, 'variation add_item should use the variation publish fallback wrapper');
assert.doesNotMatch(page, /publishShopeeItemWithStockFallback\(finalPayload, variationTotalStock\)/, 'variation add_item must not add simple-item stock fallback fields');
assert.match(page, /variation_image:skipped/, 'variation image download failures should be logged as skipped instead of aborting publish');
assert.match(page, /continue;/, 'variation image download failures should continue publishing without optional option image');
assert.match(page, /init_tier_variation/, 'seller_stock-constrained variation add_item should initialize variations after base item fallback');
assert.match(page, /add_item:variation_fallback_base/, 'variation fallback should log base item creation before initializing variations');
assert.match(api, /action === 'init_tier_variation'/, 'API must expose init_tier_variation action');
assert.match(api, /\/api\/v2\/product\/init_tier_variation/, 'API must call Shopee init_tier_variation endpoint');
assert.match(docs, /Primeira entrega: variacoes manuais/, 'Shopee docs should document the first manual variation delivery');

console.log('shopee variation modal static checks passed');
