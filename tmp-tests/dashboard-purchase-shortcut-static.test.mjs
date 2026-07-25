import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quickAccess = readFileSync('components/admin/dashboard/AdminQuickAccessGrid.tsx', 'utf8');
const purchaseQueue = readFileSync('components/admin/dashboard/DashboardPurchaseQueue.tsx', 'utf8');
const dashboard = readFileSync('pages/admin/dashboard/AdminDashboardPage.tsx', 'utf8');

assert.match(quickAccess, /label: 'Compras'/, 'dashboard must expose a Compras shortcut');
assert.match(quickAccess, /path: '\/admin#fila-de-compras'/, 'Compras shortcut must point to the purchase queue');
assert.match(purchaseQueue, /id="fila-de-compras"/, 'purchase queue must expose the shortcut anchor');
assert.match(dashboard, /location\.hash !== '#fila-de-compras'/, 'dashboard must react to the purchase queue hash');
assert.match(dashboard, /scrollIntoView/, 'dashboard must scroll to the purchase queue');

console.log('dashboard purchase shortcut static checks passed');
