import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/shopeeTemplateService.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'shopee template service must not use Supabase directly');
assert.match(source, /vpsClient/, 'shopee template service must use vpsClient');
assert.match(source, /\/table-data\/shopee_templates/, 'Shopee templates must use the VPS table-data endpoint');
assert.match(source, /CACHE_KEY/, 'Shopee templates must preserve local fallback cache');
assert.match(source, /DEFAULT_SHOPEE_TEMPLATES/, 'Shopee templates must preserve default seeding');
assert.match(source, /seedDefaultsIfEmpty/, 'Shopee templates must preserve seedDefaultsIfEmpty');
assert.match(source, /vpsClient\.delete/, 'Shopee template delete must use VPS DELETE');
assert.match(source, /includeCompanyTemplateRow/, 'Shopee templates must include global/orphan templates without company_id');

console.log('shopee template VPS static checks passed');
