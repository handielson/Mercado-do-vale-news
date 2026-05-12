import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/inventory/StockLocationsPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.ok(page.includes('stockLocationService'), 'page should use stockLocationService');
assert.ok(page.includes('listDeposits'), 'page should load deposits');
assert.ok(page.includes('listLocations'), 'page should load locations');
assert.ok(page.includes('createDeposit'), 'page should create deposits');
assert.ok(page.includes('createLocation'), 'page should create internal locations');
assert.ok(page.includes('getStockDivergences'), 'page should show divergence data');
assert.ok(page.includes('searchProducts'), 'page should search products');
assert.ok(page.includes('getProductStockDistribution'), 'page should load selected product distribution');
assert.ok(page.includes('Depósitos'), 'page should show deposits section');
assert.ok(page.includes('Locais internos'), 'page should show locations section');
assert.ok(page.includes('Estoque por produto'), 'page should show stock by product section');
assert.ok(page.includes('por local'), 'page should show distribution table');
assert.ok(page.includes('Divergências'), 'page should show divergences section');
assert.ok(page.includes('Entrada de estoque'), 'page should expose audited stock entry now');
assert.ok(page.includes('addStockLocation'), 'page should use stock entry service');
assert.ok(page.includes('Estrutura ainda não aplicada'), 'page should explain missing database structure');
assert.ok(page.includes('Promise.all'), 'page should load read-only data together');
assert.ok(page.includes('Novo dep'), 'page should expose deposit creation');
assert.ok(page.includes('Novo local'), 'page should expose internal location creation');
assert.ok(page.includes('Ajustar saldo'), 'page should expose manual adjustment now');
assert.ok(page.includes('adjustStockLocation'), 'page should use audited adjustment service');
assert.ok(page.includes('Transferir estoque'), 'page should expose audited transfer now');
assert.ok(page.includes('transferStockLocation'), 'page should use transfer service');
assert.ok(page.includes('submitDeposit'), 'page should submit deposit creation');
assert.ok(page.includes('submitLocation'), 'page should submit location creation');
assert.ok(page.includes('setDepositOpen(true)'), 'page should open deposit modal');
assert.ok(page.includes('setLocationOpen(true)'), 'page should open location modal');
assert.ok(!page.includes('recordMovement('), 'page should not create stock movements yet');

assert.ok(routes.includes('StockLocationsPage'), 'route should lazy-load StockLocationsPage');
assert.ok(routes.includes('/admin/inventory/locations'), 'route should expose stock locations page');

assert.ok(layout.includes('/admin/inventory/locations'), 'sidebar should link stock locations page');
assert.ok(layout.includes('Locais de Estoque'), 'sidebar should label the page');

console.log('stock locations page static checks passed');
