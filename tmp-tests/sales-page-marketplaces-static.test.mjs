import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const service = readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
const modal = readFileSync('components/admin/sales/MarketplaceSaleDetailsModal.tsx', 'utf8');
const mercadoLivre = readFileSync('services/mercadoLivreServer.cjs', 'utf8');
const servers = [
  readFileSync('vps_server.js', 'utf8'),
  readFileSync('vps_server.cjs', 'utf8'),
];

for (const label of ['PDV', 'Shopee MV', 'Shopee G', 'Mercado Livre', 'TikTok Shop']) {
  assert.match(page + service, new RegExp(label), `sales list must identify ${label}`);
}
assert.match(page, /filteredRows\.map/, 'sales table must render the unified channel rows');
assert.match(page, />Canal</, 'sales table must expose the channel column');
assert.match(page, /table-fixed/, 'sales table must distribute columns inside the available width');
assert.match(page, /<colgroup>/, 'sales table must define a stable width for all columns');
assert.doesNotMatch(page, /<div className="overflow-x-auto">\s*<table/, 'sales table must not require horizontal scrolling');
assert.match(page, /AUTO_REFRESH_MS = 60_000/, 'sales from every channel must refresh automatically every minute');
assert.match(page, /setInterval\(refreshWhenVisible, AUTO_REFRESH_MS\)/, 'automatic refresh must reuse the unified sales loader');
assert.match(page, /visibilityState !== 'visible'/, 'background tabs must not keep polling marketplace APIs');
assert.match(page, /addEventListener\('focus', refreshWhenVisible\)/, 'sales must refresh as soon as the operator returns to the tab');
assert.match(page, /backgroundRefreshInFlight\.current/, 'focus and visibility events must not duplicate marketplace requests');
assert.match(page, /activeLoads\.current > 0/, 'automatic refresh must wait for the initial or filtered load to finish');
assert.match(page, /recentMarketplaceOnly: true/, 'automatic refresh must request only the recent marketplace window');
assert.match(page, /AUTO_REFRESH_LOOKBACK_MS/, 'the incremental marketplace refresh must have an explicit lookback window');
assert.match(page, /mergeMarketplaceSales/, 'recent marketplace results must merge into the already loaded history');
assert.match(page, /const marketplaceRequest = getMarketplaceSales[\s\S]*const salesData = await getSales[\s\S]*setSales\(salesData\)[\s\S]*await marketplaceRequest/, 'PDV rows must be released before the slower marketplace history finishes');
assert.doesNotMatch(page, /const \[salesData, marketplaceData\] = await Promise\.all/, 'the table must not wait for every marketplace before showing PDV sales');
assert.match(page, /Atualizando marketplaces\.\.\./, 'the page must explain that marketplace history is still loading after PDV rows appear');
assert.match(page, /disabled=\{isMarketplaceLoading\}/, 'manual refresh must not start a competing marketplace load');
assert.match(page, /MarketplaceSaleDetailsModal/, 'marketplace details must be read-only and separate from PDV actions');
assert.match(modal, /Consulta somente leitura do marketplace/, 'marketplace modal must declare its read-only behavior');
assert.match(service, /Promise\.allSettled/, 'one unavailable marketplace must not hide the other channels');
assert.match(service, /listShopeeConnections/, 'Shopee G must come from the configured secondary connection');
assert.match(mercadoLivre, /registerAliases\(fastify, 'get', '\/mercado-livre\/orders'/, 'Mercado Livre must expose its sales reader');
for (const server of servers) {
  assert.match(server, /connection_id/, 'Shopee sales reader must select the requested shop connection');
  assert.match(server, /next_page_token/, 'TikTok sales reader must paginate the official order response');
  assert.match(server, /windowSeconds = \(14 \* 24 \* 60 \* 60\) - 1/, 'Shopee history must be queried in supported time windows');
}

console.log('sales page marketplace aggregation static checks passed');
