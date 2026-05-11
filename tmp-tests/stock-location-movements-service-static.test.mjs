import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

const service = read('services/stockLocationService.ts');
const types = read('types/stock-location.ts');

assertIncludes(types, 'export interface StockLocationMovementInput', 'movement input type');
assertIncludes(types, 'export interface StockLocationMovementFilters', 'movement filters type');
assertIncludes(service, "from('stock_location_movements')", 'movement table usage');
assertIncludes(service, 'async listMovements(', 'list movements method');
assertIncludes(service, 'async recordMovement(', 'record movement method');
assertIncludes(service, "order('created_at', { ascending: false })", 'movement ordering');
assertIncludes(service, 'getCompanyId()', 'company scoped inserts');
assertIncludes(service, 'created_by: user.data.user?.id || null', 'movement actor tracking');
assertIncludes(service, 'Math.min(Math.max(filters.limit || 50, 1), 200)', 'safe movement limit');
assertIncludes(service, 'return data as StockLocationMovement;', 'record movement return type');

console.log('stock location movements service static checks passed');
