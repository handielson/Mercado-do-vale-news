import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'pages/admin/inventory/StockLocationsPage.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const snippet of [
  'StockLocationMovement',
  'setMovements',
  'stockLocationService.listMovements({ limit: 20 })',
  'Histórico de movimentações',
  'Últimos registros auditáveis',
  'formatMovementType',
  'formatMovementDate',
  'movement.movement_type',
  'movement.reason',
]) {
  assert(page.includes(snippet), `missing ${snippet}`);
}

assert(!page.includes('recordMovement('), 'page must not create movements yet');
assert(page.includes('Entrada de estoque'), 'page should expose stock entry action after entry step');
assert(page.includes('addStockLocation'), 'page should use audited stock entry service after entry step');
assert(page.includes('Transferir estoque'), 'page should expose transfer action after transfer step');
assert(page.includes('transferStockLocation'), 'page should use audited transfer service after transfer step');

console.log('stock locations movements page static checks passed');
