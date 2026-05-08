import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = readFileSync(resolve('components/customer/profile/PurchaseHistoryTab.tsx'), 'utf8');

const requiredSnippets = [
  'const [statusFilter, setStatusFilter]',
  'const purchaseSummary',
  'const filteredSales',
  'Central de compras',
  'Todos os pedidos',
  'Pedidos recentes',
  'Total investido',
  'Acompanhar entrega',
  'Comprar novamente',
  'aria-pressed={statusFilter === filter.id}',
];

for (const snippet of requiredSnippets) {
  if (!file.includes(snippet)) {
    throw new Error(`Missing purchase history redesign snippet: ${snippet}`);
  }
}

if (file.includes('max-w-4xl')) {
  throw new Error('Purchase history should use the full profile content width instead of max-w-4xl.');
}

if (file.includes('rounded-3xl')) {
  throw new Error('Purchase history should avoid oversized rounded cards.');
}

console.log('customer purchase history redesign static checks passed');
