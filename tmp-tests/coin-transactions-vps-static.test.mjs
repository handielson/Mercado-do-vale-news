import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/cashbackService.ts', 'utf8');
const saleModal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const customerDetails = readFileSync('pages/customers/CustomerDetailsPage.tsx', 'utf8');
const purchaseHistory = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');
const cashbackPage = readFileSync('pages/admin/CashbackPage.tsx', 'utf8');

for (const source of [service, saleModal, customerDetails, purchaseHistory, cashbackPage]) {
  assert.doesNotMatch(source, /\.from\('coin_transactions'\)|supabase\.from\('coin_transactions'\)/, 'coin_transactions must not be queried through Supabase');
}

assert.match(service, /vpsClient/, 'cashback service must use the VPS client for coin transaction reads');
assert.match(service, /\/table-data\/coin_transactions\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'coin transactions must be listed through paged VPS table-data');
assert.match(service, /loadTableRows<CustomerSummary>\('customers'\)/, 'admin transaction list must enrich customers through VPS table-data');
assert.match(service, /getCoinsEarnedForReference/, 'cashback service must expose a receipt helper for earned coins');
assert.match(saleModal, /getCoinsEarnedForReference/, 'sale details receipt must use the VPS-backed receipt helper');
assert.match(customerDetails, /getCoinsEarnedForReference/, 'customer details receipt must use the VPS-backed receipt helper');
assert.match(purchaseHistory, /getCoinsEarnedForReference/, 'purchase history receipt must use the VPS-backed receipt helper');
assert.match(cashbackPage, /listAllTransactions/, 'cashback admin page should keep using the centralized transaction service');

console.log('coin transactions VPS static checks passed');
