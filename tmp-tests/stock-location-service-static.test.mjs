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
  if (tableName === 'products') {
    assert.ok(service.includes('getProducts'), 'product search should read products through the VPS product service');
  } else {
    assert.ok(!service.includes(`from('${tableName}')`), `service should not read ${tableName} through Supabase`);
  }
}

assert.ok(service.includes('/stock-locations/deposits'), 'deposit list should use the VPS stock endpoint');
assert.ok(service.includes('/stock-locations/locations'), 'location list should use the VPS stock endpoint');
assert.ok(service.includes('StockDepositInput'), 'service should type deposit creation input');
assert.ok(service.includes('StockLocationInput'), 'service should type location creation input');
assert.ok(service.includes("type: input.type || 'warehouse'"), 'deposit creation should default type to warehouse');
assert.ok(service.includes('const code = normalizeLocationCode(input.code || input.name)'), 'deposit creation should normalize deposit codes');
assert.ok(service.includes('deposit_id: input.deposit_id'), 'location creation should bind to a deposit');
assert.ok(service.includes('description: input.description?.trim() || null'), 'location creation should persist optional descriptions');
assert.ok(service.includes('/distribution'), 'distribution should be scoped by product id through VPS');
assert.ok(service.includes('search: searchTerm'), 'product search should match term through VPS');
assert.ok(!service.includes('.delete('), 'read-only service should not delete stock yet');
assert.match(service, /vpsClient\.post<StockDeposit>\('\/stock-locations\/deposits'/, 'service should insert stock deposits on VPS');
assert.match(service, /vpsClient\.post<StockLocation>\('\/stock-locations\/locations'/, 'service should insert stock locations on VPS');
assert.ok(service.includes('/stock-locations/movements'), 'service should read audit movement logs from VPS');

console.log('stock location service static checks passed');
