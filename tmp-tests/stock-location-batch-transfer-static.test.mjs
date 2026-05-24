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
assertIncludes(page, 'BATCH_TRANSFER_STORAGE_KEY', 'batch transfer draft should have a localStorage key');
assertIncludes(page, 'window.localStorage.getItem(BATCH_TRANSFER_STORAGE_KEY)', 'batch transfer should restore unfinished draft after reload');
assertIncludes(page, 'window.localStorage.setItem(BATCH_TRANSFER_STORAGE_KEY', 'batch transfer should persist unfinished draft');
assertIncludes(page, 'window.localStorage.removeItem(BATCH_TRANSFER_STORAGE_KEY)', 'batch transfer should clear persisted draft after success');
assertIncludes(page, 'batchReadErrors', 'batch scanner errors should be stored as a list');
assertIncludes(page, 'playBatchErrorSound', 'batch scanner errors should trigger an audible warning');
assertIncludes(page, 'batchSearchInputRef.current?.focus()', 'batch scanner should keep focus after an error');
assertIncludes(page, 'addBatchReadError(term', 'missing scanned products should be appended to the error list');
assertIncludes(page, "setBatchSearch('')", 'missing scanned products should clear the scanner input so the next barcode can be read');
assertIncludes(page, 'clearBatchReadErrorForProduct(candidate, term)', 'rescanning a previously missing product should remove it from the error list');
assertIncludes(page, 'Erros de leitura', 'batch scanner should render the reading error queue for the operator');
assertIncludes(page, 'Limpar erros', 'batch scanner should allow clearing the reading error queue');
assertIncludes(page, 'getBatchTransferAvailable', 'batch transfer should expose total movable stock');
assertIncludes(page, 'getBatchUndistributedQuantity', 'batch transfer availability should include product stock not yet assigned to a location');
assertIncludes(page, 'return sourceAvailable + getBatchUndistributedQuantity(item)', 'batch transfer visible availability should include materializable stock');
assertIncludes(page, 'const getBatchFallbackSource = (excludeLocationId = \'\')', 'batch materialization should be able to avoid the destination location');
assertIncludes(page, 'location.id !== excludeLocationId', 'batch fallback source should not use the same location selected as destination');
assertIncludes(page, 'materializeBatchItemDistribution', 'batch transfer should materialize missing location rows from product stock');
assertIncludes(page, 'const missingQuantity = Math.max(0, productStockQuantity - localStockQuantity)', 'batch transfer should only materialize the stock missing from locations');
assertIncludes(page, 'const transferableAvailableQuantity = distribution', 'batch materialization should calculate needed stock from real transferable origins only');
assertIncludes(page, 'const quantityToMaterialize = Math.min(missingQuantity, neededQuantity)', 'batch transfer must materialize only the requested missing quantity');
assertIncludes(page, 'const fallbackSource = getBatchFallbackSource(toLocationId)', 'batch materialization should create fallback stock away from the destination');
assertIncludes(page, "reason: 'Distribuição automática para transferência em lote'", 'batch materialization should leave an audit reason');
assertIncludes(page, "quantity: '1'", 'scanned product should default to one unit');
assertIncludes(page, 'getBatchProductIdentityKeys', 'batch duplicate detection should compare stable SKU/EAN keys');
assertIncludes(page, 'findBatchItemByProduct(product)', 'batch duplicate detection should not depend only on product id');
assertIncludes(page, 'quantity: String((Number(existing.quantity) || 0) + 1)', 'scanning the same product again should increment its quantity by one');
assertIncludes(page, 'return [incremented, ...withoutExisting]', 're-scanned product should stay at the top after its quantity increments');
assertIncludes(page, 'decrementBatchItemQuantity', 'batch quantity control should expose a minus action');
assertIncludes(page, 'incrementBatchItemQuantity', 'batch quantity control should expose a plus action');
assertIncludes(page, 'onFocus={(e) => e.target.select()}', 'batch quantity manual input should select its current value on focus');
assertIncludes(page, 'aria-label="Diminuir quantidade"', 'minus button should be accessible');
assertIncludes(page, 'aria-label="Aumentar quantidade"', 'plus button should be accessible');
assertIncludes(page, 'batchDestinationLocations', 'batch destination locations should be derived for sorting and filtering');
assertIncludes(page, 'new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()', 'batch destination locations should show newest locations first');
assertIncludes(page, 'list="batch-destination-locations"', 'batch destination location should be searchable with a datalist');
assertIncludes(page, '<datalist id="batch-destination-locations">', 'batch destination location should expose filterable options');
assertIncludes(page, 'preparedBatchItems = await Promise.all', 'batch submit should prepare rows using the requested quantities before validating availability');
assertIncludes(page, 'const transferableSourceAvailable = getBatchTransferSources(item, batchToLocationId)', 'batch submit should distinguish real source rows from undistributed product stock');
assertIncludes(page, 'if (quantity > transferableSourceAvailable) {', 'batch submit should materialize undistributed stock even when total visible availability is enough');
assertIncludes(page, 'originLocations.length > 1 ? \'Todas as origens com saldo\'', 'batch row should show all origins instead of forcing a single source choice');
assertIncludes(page, 'setBatchItems(prev => [item, ...prev])', 'adding a product should put the newest item at the top of the batch list');
assertIncludes(page, 'setBatchResults(prev => prev.filter(result => !hasBatchProductIdentityOverlap(result, product)))', 'adding a product should remove equivalent suggestions from the queue immediately');
assertIncludes(page, 'remainingQuantity', 'batch submit should split requested quantity across source locations');
assertIncludes(page, 'source.location_id === toLocationId', 'batch submit should not reserve one unit or re-transfer stock already in destination');
assert(!page.includes('quantity: String(available)'), 'batch item must not default to all available stock');

console.log('stock location batch transfer static checks passed');
