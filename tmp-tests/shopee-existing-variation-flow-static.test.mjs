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

const api = readFileSync('api/shopee-catalog.ts', 'utf8');
assert.match(api, /action === 'update_model'/, 'API must expose update_model action');
assert.match(api, /\/api\/v2\/product\/update_model/, 'API must call Shopee update_model endpoint');
assert.match(page, /add_item:existing_variation/, 'UI must have a tracked existing variation update path');

console.log('shopee existing variation flow static checks passed');
