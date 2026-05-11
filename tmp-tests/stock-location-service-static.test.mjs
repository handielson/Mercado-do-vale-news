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
assert.ok(service.includes("eq('product_id', productId)"), 'distribution should be scoped by product id');
assert.ok(service.includes("or(`name.ilike.%${searchTerm}%"), 'product search should match name');
assert.ok(service.includes('sku.ilike.%${searchTerm}%'), 'product search should match SKU');
assert.ok(service.includes('ean.ilike.%${searchTerm}%'), 'product search should match EAN');
assert.ok(!service.includes('.update('), 'read-only service should not update stock yet');
assert.ok(!service.includes('.delete('), 'read-only service should not delete stock yet');
for (const tableName of ['stock_deposits', 'stock_locations', 'product_stock_locations']) {
  const tableSegments = service.split(`from('${tableName}')`).slice(1);
  assert.ok(
    tableSegments.every(segment => !segment.slice(0, 280).includes('.insert(')),
    `service should not insert ${tableName} yet`
  );
}
assert.ok(service.includes("from('stock_location_movements')"), 'service may insert audit-only movement logs');

console.log('stock location service static checks passed');
