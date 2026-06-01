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
assertIncludes(page, 'isBatchBarcodeTerm', 'batch scanner should detect barcode-like scans');
assertIncludes(page, '!isBatchBarcodeTerm(term) ? results[0] : undefined', 'barcode-like scans should not fall back to the first fuzzy product result');
assert(!page.includes('|| batchResults[0]'), 'batch scanner enter must not reuse stale suggestion results as a found product');
assertIncludes(page, 'addBatchReadError(term', 'missing scanned products should be appended to the error list');
assertIncludes(page, "setBatchSearch('')", 'missing scanned products should clear the scanner input so the next barcode can be read');
assertIncludes(page, 'clearBatchReadErrorForProduct(candidate, term)', 'rescanning a previously missing product should remove it from the error list');
assertIncludes(page, 'Erros de leitura', 'batch scanner should render the reading error queue for the operator');
assertIncludes(page, 'Limpar erros', 'batch scanner should allow clearing the reading error queue');
assertIncludes(page, 'getBatchTransferAvailable', 'batch transfer should expose total movable stock');
assertIncludes(page, 'getBatchUndistributedQuantity', 'batch transfer availability should include product stock not yet assigned to a location');
assertIncludes(page, 'getBatchExcessLocationQuantity', 'batch transfer should detect local stock that exceeds the product total');
assertIncludes(page, 'item.fromLocationId ? sourceAvailable : 0', 'batch transfer availability should stay zero until the operator selects a source');
assert(!page.includes('materializeBatchItemDistribution'), 'batch transfer must not automatically create missing location stock before transfer');
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
assertIncludes(page, 'const preparedBatchItems = batchItems.map', 'batch submit should prepare rows using the requested quantities before validating availability');
assertIncludes(page, 'Estoque de origem', 'batch row should label the origin stock selector');
assert(!page.includes('originOptions.length > 1 ?'), 'batch row should show an origin selector even when there is one source');
assertIncludes(page, 'selectedOriginLocationId', 'batch row should track the selected source location');
assertIncludes(page, 'handleBatchOriginChange', 'batch row should allow choosing a source location');
assertIncludes(page, 'Selecione a origem (1 local)', 'batch row should require explicit origin selection with a single source');
assertIncludes(page, 'const undistributedQuantity = getBatchUndistributedQuantity(item)', 'batch row should expose stock that exists in Bling/product total but has no internal location yet');
assertIncludes(page, 'const excessLocationQuantity = getBatchExcessLocationQuantity(item)', 'batch row should expose local stock that exceeds the current product total');
assertIncludes(page, 'Locais somam', 'batch row should warn when local stock sum is greater than the product total');
assertIncludes(page, 'availableSources.length === 1 && undistributedQuantity <= 0', 'batch add should not auto-select the only source when there is undistributed stock');
assertIncludes(page, 'source.location_id !== item.fromLocationId', 'batch transfer sources should honor a selected source location');
assertIncludes(page, 'setBatchItems(prev => [item, ...prev])', 'adding a product should put the newest item at the top of the batch list');
assertIncludes(page, 'setBatchResults(prev => prev.filter(result => !hasBatchProductIdentityOverlap(result, product)))', 'adding a product should remove equivalent suggestions from the queue immediately');
assertIncludes(page, 'remainingQuantity', 'batch submit should split requested quantity across source locations');
assertIncludes(page, 'source.location_id === toLocationId', 'batch submit should not reserve one unit or re-transfer stock already in destination');
assert(!page.includes('quantity: String(available)'), 'batch item must not default to all available stock');

console.log('stock location batch transfer static checks passed');
