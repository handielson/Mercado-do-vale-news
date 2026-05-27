import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cases = [
  {
    path: 'pages/admin/settings/ModelsPage.tsx',
    expected: /vpsApiService\.getProducts\(\{\s*model_id:\s*model\.id[\s\S]*status:\s*'active'/,
  },
  {
    path: 'pages/admin/products/ProductCombosPage.tsx',
    expected: /vpsApiService\.getProductById\(combo\.id,\s*true\)/,
  },
];

for (const item of cases) {
  const source = readFileSync(resolve(item.path), 'utf8');

  assert(
    item.expected.test(source),
    `${item.path} should use VPS product reads for the migrated flow`,
  );

  assert(
    !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
    `${item.path} must not read products directly from Supabase`,
  );
}

console.log('models and combos VPS product static checks passed');
