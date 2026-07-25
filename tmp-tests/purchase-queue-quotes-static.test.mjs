import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/purchaseQueueService.js', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const quotePage = readFileSync('pages/admin/purchases/PurchaseQuotePage.tsx', 'utf8');
const suppliersPage = readFileSync('pages/admin/purchases/PurchaseSuppliersPage.tsx', 'utf8');
const queuePage = readFileSync('components/admin/dashboard/DashboardPurchaseQueue.tsx', 'utf8');
const api = readFileSync('vps_server.js', 'utf8');

for (const text of [service, api]) assert.match(text, /purchase_quotes/, 'purchase quotes must have persistent VPS storage');
assert.match(service, /createManualPurchaseRequest/, 'manual requests must be supported');
assert.match(service, /createPurchaseQuote/, 'quotes must be saved');
assert.match(service, /markPurchaseQueueItemAsPurchased/, 'purchases must preserve the chosen quote');
assert.match(service, /PURCHASE_SUPPLIERS_TABLE/, 'suppliers must use their own VPS table');
assert.match(service, /createPurchaseSupplier/, 'suppliers must be persistently registered');
assert.match(routes, /\/admin\/compras\/:itemId\/orcamentos/, 'quote page must have its own route');
assert.match(routes, /\/admin\/compras\/fornecedores/, 'supplier management must have its own route');
assert.match(quotePage, /Menor preço/, 'quote page must identify the lowest price');
assert.match(quotePage, /Abrir site/, 'selected supplier website must be an actionable shortcut');
assert.match(quotePage, /WhatsApp/, 'selected supplier WhatsApp must be actionable');
assert.match(suppliersPage, /Cadastrar fornecedor/, 'supplier registration page must exist');
assert.match(queuePage, /Retirados/, 'removed items must have their own list');
console.log('purchase queue quotes static checks passed');
