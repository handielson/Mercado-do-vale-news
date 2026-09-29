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
