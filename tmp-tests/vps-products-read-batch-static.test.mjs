import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectations = [
  {
    path: 'pages/admin/CashbackPage.tsx',
    expected: /vpsApiService\.getProducts\(\{\s*status:\s*'active'[\s\S]*compact:\s*true/,
  },
  {
    path: 'pages/admin/orders/OnlineOrdersPage.tsx',
    expected: /vpsApiService\.getProductsByIds\(productIds\)/,
  },
  {
    path: 'components/shipping/FreightCalculator.tsx',
    expected: /vpsApiService\.getProducts\(\{\s*status:\s*'active'[\s\S]*limit:\s*2000/,
  },
];

for (const item of expectations) {
  const source = readFileSync(resolve(item.path), 'utf8');

  assert(
    item.expected.test(source),
    `${item.path} should load products from VPS`,
  );

  assert(
    !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
    `${item.path} must not read products directly from Supabase`,
  );
}

console.log('VPS product read batch static checks passed');
