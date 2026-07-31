import assert from 'node:assert/strict';
import fs from 'node:fs';

const saleService = fs.readFileSync('services/saleService.ts', 'utf8');
const blingService = fs.readFileSync('services/blingService.ts', 'utf8');
const units = fs.readFileSync('services/units.ts', 'utf8');
const orderService = fs.readFileSync('services/orderService.ts', 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = fs.readFileSync(file, 'utf8');
  assert.match(server, /operation must be S or E/, `${file} must validate stock movement direction`);
  assert.match(server, /operacao:\s*normalizedOperation/, `${file} must send the selected operation to Bling`);
}

assert.match(saleService, /releaseSaleSerializedUnits/, 'sale cancellation must release serialized units');
assert.match(saleService, /UnitStatus\.SOLD[\s\S]*UnitStatus\.RESERVED/, 'only linked sold or reserved units may be released');
assert.match(saleService, /syncReturnedSaleStockToBling[\s\S]*operation:\s*'E'/, 'returned sale inventory must enter Bling stock');
assert.match(saleService, /cancelSale[\s\S]*restoreCancelledSaleInventory/, 'cancelSale must restore all inventory layers');
assert.match(saleService, /refundSale[\s\S]*restoreCancelledSaleInventory/, 'refundSale must restore all inventory layers');
assert.match(saleService, /for \(const item of itemsToSyncBling\)[\s\S]*await syncStockToBling/, 'sale stock syncs must run sequentially to avoid silent rate-limit losses');
assert.match(units, /release[\s\S]*sold_at:\s*null/, 'released serialized units must clear sold_at');
assert.match(blingService, /if\s*\(!response\.ok\)/, 'Bling stock sync must not hide HTTP failures');
assert.match(orderService, /releaseOrderUnits[\s\S]*UnitStatus\.SOLD/, 'order cancellation must also release sold units');
assert.match(orderService, /syncReturnedOrderStockToBling[\s\S]*operation:\s*'E'/, 'returned order inventory must enter Bling stock');

console.log('sale cancel serialized inventory and Bling checks passed');
