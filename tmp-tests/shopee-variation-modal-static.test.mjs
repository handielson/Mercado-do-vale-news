import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /shopeeVariationEngine/, 'Shopee page should import the variation engine');
assert.match(page, /variationGroups/, 'Shopee page should discover selectable variation groups');
assert.match(page, /selectedVariationGroupId/, 'Shopee modal should track the selected variation group');
assert.match(page, /buildShopeeVariationModels/, 'publish flow should build tier_variation and model_list');
assert.match(page, /tier_variation/, 'add_item payload should include Shopee tier variations');
assert.match(page, /model_list/, 'add_item payload should include Shopee model list');
assert.match(page, /Publicar como anuncio com variacoes/, 'operator should explicitly opt in to variation publish');
assert.match(docs, /Primeira entrega: variacoes manuais/, 'Shopee docs should document the first manual variation delivery');

console.log('shopee variation modal static checks passed');
