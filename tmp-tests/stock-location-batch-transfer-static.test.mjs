import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'pages/admin/inventory/StockLocationsPage.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

assertIncludes(page, 'getBatchTransferSources', 'batch transfer should calculate all source locations');
assertIncludes(page, 'getBatchTransferAvailable', 'batch transfer should expose total movable stock');
assertIncludes(page, 'materializeBatchItemDistribution', 'batch transfer should materialize missing location rows from product stock');
assertIncludes(page, 'const missingQuantity = Math.max(0, productStockQuantity - localStockQuantity)', 'batch transfer should only materialize the stock missing from locations');
assertIncludes(page, "reason: 'Distribuição automática para transferência em lote'", 'batch materialization should leave an audit reason');
assertIncludes(page, "quantity: String(available)", 'scanned product should default to all available stock');
assertIncludes(page, 'originLocations.length > 1 ? \'Todas as origens com saldo\'', 'batch row should show all origins instead of forcing a single source choice');
assertIncludes(page, 'setBatchResults(prev => prev.filter(r => r.id !== product.id))', 'adding a product should remove it from the suggestion queue immediately');
assertIncludes(page, 'remainingQuantity', 'batch submit should split requested quantity across source locations');
assertIncludes(page, 'source.location_id === toLocationId', 'batch submit should not reserve one unit or re-transfer stock already in destination');
assert(!page.includes("quantity: available > 0 ? '1' : '0'"), 'batch item must not default to one unit');

console.log('stock location batch transfer static checks passed');
