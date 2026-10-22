import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('services/smartphonePriceGroupsServer.cjs', 'utf8');
const core = readFileSync('services/smartphonePriceGroupsCore.cjs', 'utf8');
const migration = readFileSync('migrations/vps-smartphone-price-groups.sql', 'utf8');
const intake = readFileSync('services/smartphonePhotoIntakeServer.cjs', 'utf8');
const productService = readFileSync('services/products.ts', 'utf8');
const panel = readFileSync('components/settings/ModelPricesPanel.tsx', 'utf8');
const modelsPage = readFileSync('pages/admin/settings/ModelsPage.tsx', 'utf8');
// Estado desconhecido apos falha de rede deve abrir o mesmo editor indicado pelo link.
assert.match(modelsPage, /phoneModel !== false \? <ModelPricesPanel/, 'falha na consulta inicial nao pode abrir a tabela antiga vazia; o editor deve consultar novamente e exibir erro/recarregar');
assert.match(panel, /setError\(e.message[\s\S]*Recarregar[\s\S]*role="alert"/, 'editor deve permitir recarga e mostrar falha de consulta');

assert.match(migration, /CREATE TABLE IF NOT EXISTS smartphone_price_groups/);
assert.match(migration, /price_retail INT NOT NULL[\s\S]*price_reseller INT NOT NULL[\s\S]*price_wholesale INT NOT NULL/);
assert.doesNotMatch(migration, /UPDATE\s+products|DELETE\s+FROM/i, 'migration must never choose or rewrite commercial prices');
assert.match(core, /company_id[\s\S]*model_id[\s\S]*ram[\s\S]*storage[\s\S]*version[\s\S]*network[\s\S]*condition/);
assert.match(api, /SELECT[\s\S]*FROM products[\s\S]*WHERE model_id=\?/);
assert.doesNotMatch(api, /stock_quantity\s*>\s*0/, 'empty-stock colors must remain part of the price group');
assert.match(api, /FOR UPDATE[\s\S]*revision[\s\S]*rollback/);
assert.match(api, /INSERT INTO product_price_history/);
assert.match(intake, /inheritSmartphonePrices\(connection,/);
assert.doesNotMatch(intake, /saleProductIds/, 'photo intake must inherit the canonical group instead of overwriting peers');
assert.match(productService, /smartphonePriceGroups\.reference\(source\.model_id, source\)/);
assert.doesNotMatch(panel, /price_cost[^\n]*CurrencyInput/, 'group editor must not expose collective cost editing');
assert.match(panel, /unit_costs/);

for (const file of ['server.js', 'vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /registerSmartphonePriceGroupRoutes\(fastify,/i, `${file} must expose the group routes`);
  assert.match(source, /withSmartphonePriceWrite\(pool, p,/i, `${file} batch writes must enforce group prices`);
  assert.match(source, /patchProductWithGroupPrices/i, `${file} generic patches must enforce group prices`);
  assert.match(source, /insertProductRecordsWithGroupPrices/i, `${file} generic inserts must enforce group prices`);
}

console.log('smartphone price group runtime wiring checks passed');
