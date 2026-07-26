import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'pages/admin/inventory/StockLocationsPage.tsx'), 'utf8');
const typeSource = fs.readFileSync(path.join(root, 'types/stock-location.ts'), 'utf8');
const vpsSource = fs.readFileSync(path.join(root, 'vps_server.cjs'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const snippet of [
  'StockLocationMovement',
  'setMovements',
  'stockLocationService.listMovements(',
  'Histórico de movimentações',
  'Últimos registros auditáveis',
  'formatMovementType',
  'formatMovementDate',
  'movement.movement_type',
  'movement.reason',
  'product.name ||',
  'MovementSourceIcon',
  'Smartphone',
  'Monitor',
  'formatMovementReason',
  'formatMovementReferenceType',
  '/admin/sales?sale=',
  'Pedido #',
]) {
  assert(page.includes(snippet), `missing ${snippet}`);
}

assert(typeSource.includes('product?:'), 'StockLocationMovement should allow hydrated product data');
assert(typeSource.includes('name: string'), 'StockLocationMovement product data should expose product name');
assert(vpsSource.includes('LEFT JOIN products p ON p.id = slm.product_id'), 'VPS movements endpoint should join products');
assert(vpsSource.includes('product_name'), 'VPS movements endpoint should return product_name');
assert(vpsSource.includes('product: row.product_name ?'), 'VPS movements endpoint should hydrate movement.product');
assert(vpsSource.includes('source_device:'), 'VPS movements endpoint should identify mobile or computer');
assert(vpsSource.includes('sale_order_number:'), 'VPS movements endpoint should expose the receipt sale number');
assert(vpsSource.includes('LEFT JOIN stock_locations fl'), 'VPS movements endpoint should hydrate source and target locations');
assert(!page.includes('if (!product) return movement.product_id;'), 'movement table should not prefer raw product id as the visible product label');

assert(!page.includes('recordMovement('), 'page must not create movements yet');
assert(page.includes('Entrada de estoque'), 'page should expose stock entry action after entry step');
assert(page.includes('addStockLocation'), 'page should use audited stock entry service after entry step');
assert(page.includes('Transferir estoque'), 'page should expose transfer action after transfer step');
assert(page.includes('transferStockLocation'), 'page should use audited transfer service after transfer step');

console.log('stock locations movements page static checks passed');
