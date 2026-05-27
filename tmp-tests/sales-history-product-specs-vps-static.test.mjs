import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  {
    path: 'components/admin/sales/SaleDetailsModal.tsx',
    expected: /vpsApiService\.getProductsByIds/,
  },
  {
    path: 'components/customer/profile/PurchaseHistoryTab.tsx',
    expected: /vpsApiService\.getProductsByIds/,
  },
  {
    path: 'pages/customers/CustomerDetailsPage.tsx',
    expected: /vpsApiService\.getProductById[\s\S]*vpsApiService\.getProductsByIds/,
  },
];

for (const file of files) {
  const source = readFileSync(resolve(file.path), 'utf8');

  assert(
    file.expected.test(source),
    `${file.path} should load product specs from VPS`,
  );

  assert(
    !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
    `${file.path} must not read products directly from Supabase`,
  );
}

console.log('sales history product specs VPS static checks passed');
