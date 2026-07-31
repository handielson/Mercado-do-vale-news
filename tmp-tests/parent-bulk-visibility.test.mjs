import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isArchivedProductRecord } from '../utils/localProductVisibility.ts';
import { getShopeeBulkEffectiveStock, hasShopeeBulkPublishStock } from '../utils/shopeeBulkEligibility.ts';

assert.equal(isArchivedProductRecord({ sku: 'ARCH-PX85G8512P-11563CD5', status: 'inactive' }), true);
assert.equal(isArchivedProductRecord({ sku: 'PX85G8512P', status: 'active' }), false);

const parent = { stock_quantity: 0, variation_stock_quantity: 7, track_inventory: true };
assert.equal(getShopeeBulkEffectiveStock(parent), 7);
assert.equal(hasShopeeBulkPublishStock(parent), true);
assert.equal(hasShopeeBulkPublishStock({ stock_quantity: 0, variation_stock_quantity: 0, track_inventory: true }), false);

const shopeePage = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const modelPage = readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
assert.match(shopeePage, /variationStockByParentId/);
assert.match(shopeePage, /stock_quantity: getShopeeBulkEffectiveStock\(product\)/);
assert.match(shopeePage, /allLocalProds\.filter\(\(product: any\) => !isArchivedProductRecord\(product\)\)/);
assert.match(modelPage, /filter\(\(product: any\) => !isArchivedProductRecord\(product\)\)/);

console.log('parent bulk and archived product visibility checks passed');
