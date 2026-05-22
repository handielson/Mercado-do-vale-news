import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/inventory/StockLocationsPage.tsx', 'utf8');
const service = readFileSync('services/stockLocationService.ts', 'utf8');
const types = readFileSync('types/stock-location.ts', 'utf8');

assert.match(page, /buildProductFromContentItem/, 'content transfer must build selected product from the location row');
assert.match(page, /buildDistributionFromContentItem/, 'content transfer must seed transfer availability from the location row');
assert.match(page, /onClick=\{\(\) => handleContentTransferFromRow\(item\)\}/, 'content transfer button must use direct row data instead of a new Bling/VPS search');
assert.match(page, /closeLocationContents\(true\)/, 'content transfer must only close the box modal after the transfer modal is prepared');
assert.match(page, /contentsActionProductId === item\.product_id \? 'Abrindo\.\.\.' : 'Transferir'/, 'content transfer button must show an in-progress state instead of looking like it returned to the page');
assert.match(page, /setProductDistribution\(distribution\)/, 'content transfer must keep row-seeded distribution when live distribution is unavailable');
assert.match(page, /toast\.success\(`\$\{quantity\} unidade\(s\) de \$\{selectedProduct\.name\} transferida\(s\) para \$\{targetLocationName\}\.`\)/, 'transfer save must show a success message after moving stock');
assert.match(page, /handleReturnContentItemToStore/, 'page must expose return-to-store action for a box item');
assert.match(page, /Voltar para loja/, 'content modal must show a return-to-store button');
assert.match(page, /stockLocationService\.transferStockLocation\(\{[\s\S]*from_location_id: item\.location_id/, 'return-to-store must transfer from the current box location');
assert.match(page, /getDefaultStockTarget\(/, 'page must resolve the default store target automatically');
assert.match(page, /Pencil/, 'page should import an edit icon for rename actions');
assert.match(page, /openEditDepositModal/, 'page must expose deposit rename/edit flow');
assert.match(page, /openEditLocationModal/, 'page must expose location rename/edit flow');
assert.match(page, /disabled=\{Boolean\(editingLocationId\)\}/, 'editing a location must not silently move it between deposits');
assert.match(service, /async updateDeposit\(/, 'service must update deposits');
assert.match(service, /async updateLocation\(/, 'service must update locations');
assert.match(types, /export interface StockDepositUpdateInput/, 'types must define deposit update input');
assert.match(types, /export interface StockLocationUpdateInput/, 'types must define location update input');

console.log('stock location content transfer/remove/rename static checks ok');
