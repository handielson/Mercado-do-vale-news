import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const migration = read('migrations/017_model_blueprints.sql');
const modelTypes = read('types/model.ts');
const productTypes = read('types/product.ts');
const modelService = read('services/models.ts');
const productNormalizer = read('services/productNormalizer.ts');
const productService = read('services/products.ts');
const servers = ['vps_server.cjs', 'vps_server.js'].map((file) => ({ file, source: read(file) }));

for (const column of ['blueprint_image_url', 'blueprint_source_hash', 'blueprint_generated_at']) {
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `migration must add ${column}`);
  assert.match(modelTypes, new RegExp(`${column}\\?:`), `Model contract must expose ${column}`);
  assert.match(productTypes, new RegExp(`${column}\\?:`), `Product contract must expose derived ${column}`);
  assert.match(productNormalizer, new RegExp(`${column}:`), `product normalizer must preserve ${column}`);
  assert.match(productService, new RegExp(`${column}: row\\.${column}`), `product service must map ${column}`);
}

assert.match(modelTypes, /export interface ModelBlueprintInput[\s\S]*blueprint_image_url: string \| null/);
assert.match(modelService, /vpsClient\.patch<Model>\(`\/models\/\$\{encodeURIComponent\(id\)\}\/blueprint`, input\)/);

for (const { file, source } of servers) {
  assert.match(source, /fastify\.patch\('\/models\/:id\/blueprint', \{ preHandler: requireSyncKey \}/, `${file} must expose authenticated focused PATCH`);
  assert.match(source, /blueprint_image_url must be a valid HTTPS URL/, `${file} must reject non-HTTPS blueprint URLs`);
  assert.match(source, /blueprint_source_hash must be a SHA-256 hex digest/, `${file} must validate source hashes`);
  assert.match(source, /blueprint_generated_at must be a valid date/, `${file} must validate generation timestamps`);
  assert.match(source, /function modelBlueprintSelectSql\(/, `${file} must derive blueprint fields from models`);
  assert.match(source, /FROM models m WHERE m\.id = \$\{productAlias\}\.model_id/, `${file} must join the model source of truth`);
  assert.match(source, /CREATE TABLE IF NOT EXISTS models[\s\S]*blueprint_image_url TEXT NULL[\s\S]*blueprint_source_hash CHAR\(64\) NULL[\s\S]*blueprint_generated_at DATETIME NULL/, `${file} runtime schema must include blueprint fields`);
  assert.match(source, /addColumnIfMissing\('models', 'blueprint_image_url', 'TEXT NULL'\)/);
  assert.match(source, /addColumnIfMissing\('models', 'blueprint_source_hash', 'CHAR\(64\) NULL'\)/);
  assert.match(source, /addColumnIfMissing\('models', 'blueprint_generated_at', 'DATETIME NULL'\)/);

  const queryUses = source.match(/\$\{modelBlueprintSelectSql\('products'\)\}/g) || [];
  assert.ok(queryUses.length >= 12, `${file} must expose model blueprints in product and autoresponder reads`);
}

assert.equal(servers[0].source, servers[1].source, 'vps_server.js and vps_server.cjs must remain identical');

console.log('model blueprint data/API static checks passed');
