import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quickAccess = readFileSync('components/admin/dashboard/AdminQuickAccessGrid.tsx', 'utf8');
const purchaseQueue = readFileSync('components/admin/dashboard/DashboardPurchaseQueue.tsx', 'utf8');
const dashboard = readFileSync('pages/admin/dashboard/AdminDashboardPage.tsx', 'utf8');
const purchasePage = readFileSync('pages/admin/purchases/PurchaseQueuePage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');

assert.match(quickAccess, /label: 'Compras'/, 'dashboard must expose a Compras shortcut');
assert.match(quickAccess, /path: '\/admin\/compras'/, 'Compras shortcut must point to its own page');
assert.doesNotMatch(dashboard, /DashboardPurchaseQueue/, 'dashboard must not render the purchase queue');
assert.match(routes, /path: "\/admin\/compras"/, 'router must expose the purchase queue page');
assert.match(purchasePage, /DashboardPurchaseQueue/, 'purchase page must render the queue');
assert.match(purchasePage, /Como a fila e alimentada/, 'purchase page must explain how the queue is fed');
assert.match(purchaseQueue, /syncPurchaseQueueFromSummary/, 'queue must synchronize from the daily sales digest');

console.log('dashboard purchase shortcut static checks passed');
