import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inventory = readFileSync('components/admin/sales/SaleItemInventoryInfo.tsx', 'utf8');
const service = readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
const page = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const modal = readFileSync('components/admin/sales/MarketplaceSaleDetailsModal.tsx', 'utf8');

assert.match(inventory, /pickMarketplaceProduct/, 'marketplace items need a fallback matcher when the local SKU is absent');
assert.match(inventory, /getProducts\(\{ search: name\.trim\(\), status: 'all', limit: 100, compact: true \}\)/, 'inventory lookup must search by marketplace product name');
assert.match(modal, /variation=\{item\.variation\}/, 'marketplace item variation must reach stock matching');
assert.match(service, /MARKETPLACE_SALES_CACHE_TTL_MS = 5 \* 60 \* 1000/, 'marketplace list cache must have a bounded five-minute refresh');
assert.match(service, /window\.sessionStorage\.getItem/, 'marketplace sales should restore browser cache');
assert.match(service, /options: \{ force\?: boolean \}/, 'manual refresh must be able to bypass browser cache');
assert.match(page, /getCachedMarketplaceSales\(\)/, 'sales page should paint cached marketplace sales immediately');
assert.match(page, /forceMarketplace: true/, 'manual refresh must request a fresh marketplace snapshot');
assert.match(page, /AUTO_REFRESH_MS = 5 \* 60_000/, 'automatic marketplace refresh must be periodic and bounded');

console.log('marketplace sales cache and stock match static checks passed');
