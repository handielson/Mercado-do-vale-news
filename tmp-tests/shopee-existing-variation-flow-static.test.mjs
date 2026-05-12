import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/add_shopee_variation_links.sql', 'utf8');

assert.match(sql, /ADD COLUMN IF NOT EXISTS shopee_model_id bigint/i, 'migration must add shopee_model_id');
assert.match(sql, /ADD COLUMN IF NOT EXISTS shopee_model_sku text/i, 'migration must add shopee_model_sku');
assert.match(sql, /ADD COLUMN IF NOT EXISTS shopee_model_name text/i, 'migration must add shopee_model_name');
assert.match(sql, /ADD COLUMN IF NOT EXISTS shopee_tier_index jsonb/i, 'migration must add shopee_tier_index');
assert.match(sql, /idx_shopee_products_item_model/i, 'migration must index item/model lookup');

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(page, /matchShopeeModelsBySku/, 'ShopeePage must match returned models by SKU');
assert.match(page, /get_model_list/, 'ShopeePage must fetch model_list after variation publish');
assert.match(page, /shopee_model_id/, 'ShopeePage must persist shopee_model_id');
assert.match(page, /shopee_tier_index/, 'ShopeePage must persist shopee_tier_index');
assert.match(page, /findExistingShopeeItemIdForGroup/, 'ShopeePage must detect sibling item_id before publishing');
assert.match(page, /Adicionar variacao ao anuncio existente/, 'UI must show existing-listing variation action');
assert.match(page, /rawSelectedVariationGroup/, 'existing-listing detection should prefer the selected full variation group');
assert.match(page, /existing_variation:model_list_before_update/, 'existing variation update should fetch current Shopee models before update_model');
assert.match(page, /mergeExistingShopeeModelIds/, 'existing variation update should preserve model_id for already published SKUs');
assert.match(page, /existing_variation:model_id_merge/, 'existing variation update should log which SKUs were matched to model_id');
assert.match(page, /duplicate_variation:model_list_before_update/, 'duplicate recovery should inspect existing Shopee models before init_tier_variation');
assert.match(page, /duplicate_variation:update_existing_models/, 'duplicate recovery should update existing models when duplicate item already has variations');
assert.match(page, /duplicate_variation:update_model/, 'duplicate recovery should use update_model instead of init_tier_variation for existing variations');

const api = readFileSync('api/shopee-catalog.ts', 'utf8');
assert.match(api, /action === 'update_model'/, 'API must expose update_model action');
assert.match(api, /\/api\/v2\/product\/update_model/, 'API must call Shopee update_model endpoint');
assert.match(page, /add_item:existing_variation/, 'UI must have a tracked existing variation update path');

console.log('shopee existing variation flow static checks passed');
