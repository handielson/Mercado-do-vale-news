import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inventory = readFileSync('components/admin/sales/SaleItemInventoryInfo.tsx', 'utf8');
const service = readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
const page = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const modal = readFileSync('components/admin/sales/MarketplaceSaleDetailsModal.tsx', 'utf8');

assert.match(inventory, /pickMarketplaceProduct/, 'marketplace items need a fallback matcher when the local SKU is absent');
assert.match(inventory, /marketplaceProductSearchTerms/, 'marketplace items without SKU must derive stable search terms from the title');
assert.ok(inventory.includes('trimmed.match(/[a-z0-9]+(?:[-_.\\/][a-z0-9]+)+/gi)'), 'inventory lookup must extract model codes embedded in marketplace titles');
assert.match(inventory, /compactExpectedName\.includes\(productSku\)/, 'a local SKU embedded in the marketplace title must be a strong match');
assert.match(inventory, /getProducts\(\{ search, status: 'all', limit: 100, compact: true, noCache: true \}\)/, 'inventory lookup must retry catalog searches with the derived terms');
assert.match(modal, /variation=\{item\.variation\}/, 'marketplace item variation must reach stock matching');
assert.match(service, /marketplace-sales-local-first-v1/, 'marketplace list must open from the local cache first');
assert.match(service, /window\.localStorage\.getItem/, 'marketplace sales must survive closing the tab');
assert.match(service, /changed_since/, 'refresh must ask the VPS only for sales changed since the last read');
assert.match(service, /\/admin\/marketplace-sales\?/, 'the list must come from the VPS MySQL cache, not live marketplace APIs');
assert.doesNotMatch(service, /\/admin\/mobile-sales\?/, 'the sales page must not call the slow live marketplace readers');
assert.match(service, /options: \{ force\?: boolean \}/, 'manual refresh must be able to bypass browser cache');
assert.match(page, /getCachedMarketplaceSales\(\)/, 'sales page should paint cached marketplace sales immediately');
assert.match(page, /getCachedMarketplaceSales\(marketplaceFilters\)/, 'changing filters must paint the cached range before the VPS answers');
assert.doesNotMatch(page, /setMarketplaceSales\(\[\]\)/, 'loading must not wipe the marketplace rows already on screen');
assert.match(page, /forceMarketplace: true/, 'manual refresh must request a fresh marketplace snapshot');
assert.match(page, /AUTO_REFRESH_MS = 60_000/, 'automatic refresh only reads the delta, so it runs every minute');

console.log('marketplace sales cache and stock match static checks passed');
