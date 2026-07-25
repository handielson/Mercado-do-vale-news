import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/purchaseQueueService.js', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const quotePage = readFileSync('pages/admin/purchases/PurchaseQuotePage.tsx', 'utf8');
const api = readFileSync('vps_server.js', 'utf8');

for (const text of [service, api]) assert.match(text, /purchase_quotes/, 'purchase quotes must have persistent VPS storage');
assert.match(service, /createManualPurchaseRequest/, 'manual requests must be supported');
assert.match(service, /createPurchaseQuote/, 'quotes must be saved');
assert.match(service, /markPurchaseQueueItemAsPurchased/, 'purchases must preserve the chosen quote');
assert.match(routes, /\/admin\/compras\/:itemId\/orcamentos/, 'quote page must have its own route');
assert.match(quotePage, /Menor preço/, 'quote page must identify the lowest price');
console.log('purchase queue quotes static checks passed');
