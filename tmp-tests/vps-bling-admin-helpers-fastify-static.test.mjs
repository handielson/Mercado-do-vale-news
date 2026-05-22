import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'fix-profile'/, `${file} must route fix-profile through Fastify`);
  assert.match(source, /userId is required/, `${file} must validate fix-profile userId`);
  assert.match(source, /select=id&slug=eq\.mercado-do-vale&limit=1/, `${file} must resolve Mercado do Vale company id`);
  assert.match(source, /supabaseRestUpsert\('profiles'/, `${file} must upsert profile by id`);
  assert.match(source, /on_conflict=id/, `${file} must upsert profile with id conflict target`);

  assert.match(source, /resource === 'sync-model-brand'/, `${file} must route sync-model-brand through Fastify`);
  assert.match(source, /model_id and brand_name are required/, `${file} must validate sync-model-brand payload`);
  assert.match(source, /select=id,brand_id,company_id&id=eq\.\$\{encodeURIComponent\(String\(model_id\)\)\}&limit=1/, `${file} must load model by id`);
  assert.match(source, /normalizeBlingAdminSlugVps\(brand_name\)/, `${file} must generate normalized brand slug`);
  assert.match(source, /name=ilike\.\$\{encodeURIComponent\(String\(brand_name\)\)\}/, `${file} must find existing brand by name`);
  assert.match(source, /supabaseRestInsert\('brands'/, `${file} must create missing brand`);
  assert.match(source, /supabaseRestPatch\('models'[\s\S]*brand_id/, `${file} must update model brand_id`);
  assert.match(source, /patchVpsJsonForBlingAdminVps\(request, wasCreated \? 'POST' : 'PUT'/, `${file} must sync brand to VPS`);

  assert.match(source, /resource === 'fix-bling-id'/, `${file} must route fix-bling-id through Fastify`);
  assert.match(source, /sku e blingId são obrigatórios/, `${file} must validate fix-bling-id payload`);
  assert.match(source, /select=id,sku,bling_id,stock_quantity&sku=eq\.\$\{encodeURIComponent\(String\(sku\)\)\}&limit=1/, `${file} must load product before fixing bling_id`);
  assert.match(source, /supabaseRestPatch\('products'[\s\S]*bling_id: Number\(blingId\)/, `${file} must patch product bling_id`);
  assert.match(source, /buildCopyableDebug\('bling-admin-helpers'/, `${file} must return copyable debug details for admin helpers`);
  assert.match(source, /fix-profile\|sync-model-brand\|fix-bling-id/, `${file} must list admin helpers as migrated`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-admin-helpers',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped admin helper debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|apikey)\b/i, `${file} must not expose secrets in admin helper debug payloads`);
  }
}

console.log('vps Bling admin helpers Fastify static checks ok');
