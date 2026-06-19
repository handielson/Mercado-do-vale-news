import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saleService = readFileSync('services/saleService.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');
const types = readFileSync('types/stock-location.ts', 'utf8');
const saleDetails = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');

assert.match(
  saleService,
  /await stockLocationService\.decrementStockByPriority\(/,
  'PDV sales must call stock location priority decrement'
);

assert.match(
  saleService,
  /catch \(priorityError\)[\s\S]*throw priorityError;/,
  'priority decrement failures must bubble so the sale is marked needs_review instead of silently succeeding'
);

assert.match(
  saleService,
  /recordFinalizationWarning\([\s\S]*'stock_location_fallback'/,
  'PDV sales must leave a warning when stock is decremented outside the main store'
);

assert.match(
  server,
  /sd\.name AS deposit_name[\s\S]*sl\.name AS location_name/,
  'priority decrement sources must include human-readable deposit and location names'
);

assert.match(
  server,
  /deposit_name: source\.deposit_name[\s\S]*location_name: source\.location_name/,
  'priority decrement response must return the source location names used by the sale'
);

assert.match(
  types,
  /deposit_name\?: string \| null;[\s\S]*location_name\?: string \| null;/,
  'priority decrement result type must expose location names for sale warnings'
);


assert.match(
  saleDetails,
  /parseSaleFinalizationWarnings/,
  'sale details modal must parse finalization warnings from the stored sale log'
);

assert.match(
  saleDetails,
  /saleFinalizationWarnings\.map/,
  'sale details modal must render stock fallback warnings visibly on the sale'
);

console.log('pdv-stock-location-decrement-static.test.mjs: ok');
