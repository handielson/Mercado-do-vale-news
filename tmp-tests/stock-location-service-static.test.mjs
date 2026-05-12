import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const servicePath = 'services/stockLocationService.ts';
const typesPath = 'types/stock-location.ts';

const service = readFileSync(servicePath, 'utf8');
const types = readFileSync(typesPath, 'utf8');

for (const typeName of [
  'StockDeposit',
  'StockLocation',
  'ProductStockLocation',
  'StockLocationMovement',
  'StockLocationDivergence',
  'StockLocationProductSearchResult',
]) {
  assert.match(types, new RegExp(`export interface ${typeName}\\b`), `${typeName} should be exported`);
}

for (const methodName of [
  'listDeposits',
  'listLocations',
  'createDeposit',
  'createLocation',
  'getProductStockDistribution',
  'getStockDivergences',
  'searchProducts',
]) {
  assert.match(service, new RegExp(`async ${methodName}\\b`), `${methodName} should exist`);
}

for (const tableName of [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_divergences',
  'products',
]) {
  assert.ok(service.includes(`from('${tableName}')`), `service should read ${tableName}`);
}

assert.ok(service.includes("order('is_default'"), 'deposit/location lists should prioritize defaults');
assert.ok(service.includes('StockDepositInput'), 'service should type deposit creation input');
assert.ok(service.includes('StockLocationInput'), 'service should type location creation input');
assert.ok(service.includes("type: input.type || 'warehouse'"), 'deposit creation should default type to warehouse');
assert.ok(service.includes('const code = normalizeLocationCode(input.code || input.name)'), 'deposit creation should normalize deposit codes');
assert.ok(service.includes('deposit_id: input.deposit_id'), 'location creation should bind to a deposit');
assert.ok(service.includes('description: input.description?.trim() || null'), 'location creation should persist optional descriptions');
assert.ok(service.includes("eq('product_id', productId)"), 'distribution should be scoped by product id');
assert.ok(service.includes("or(`name.ilike.%${searchTerm}%"), 'product search should match name');
assert.ok(service.includes('sku.ilike.%${searchTerm}%'), 'product search should match SKU');
assert.ok(service.includes('ean.ilike.%${searchTerm}%'), 'product search should match EAN');
assert.ok(!service.includes('.delete('), 'read-only service should not delete stock yet');
assert.match(service, /from\('stock_deposits'\)[\s\S]{0,260}\.insert\(payload\)/, 'service should insert stock deposits');
assert.match(service, /from\('stock_locations'\)[\s\S]{0,260}\.insert\(payload\)/, 'service should insert stock locations');
assert.ok(service.includes("from('stock_location_movements')"), 'service may insert audit-only movement logs');

console.log('stock location service static checks passed');
